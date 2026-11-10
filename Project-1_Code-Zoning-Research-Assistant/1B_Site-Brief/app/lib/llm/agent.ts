// Rule-selection agent (1B). Sonnet drives typed tools via the SDK Tool Runner; Opus is used only to resolve a
// split lot or a disagreement with the engine. The model NEVER supplies zoning numbers: it picks rule IDs from
// the engine's rules table (with reasons) as a cross-check, and all arithmetic goes through lib/zoning/calc.
import * as z from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { PValue, Unit } from "@/lib/types";
import type { ZoningBrief, ExtRule } from "@/lib/zoning/model";
import type { SiteData } from "@/lib/types";
import { areaShare, coverageArea, maxFloorArea } from "@/lib/zoning/calc";
import { getAllRules } from "@/lib/zoning/rules";
import { basePortions } from "@/lib/zoning/site-helpers";
import { search as geosearch } from "@/lib/sources/geosearch";
import { getPluto } from "@/lib/sources/pluto";
import { getSection } from "@/lib/zr/corpus";
import {
  MODELS, addUsage, costFromUsage, getClient, normUsage, ZERO_USAGE,
  type LlmClient, type ModelId, type NormUsage,
} from "./client";
import { compareSelections, type AgentSelection, type CrossCheckResult } from "./crosscheck";
import { searchZr } from "./search";

export interface AgentFlag { kind: "landmark" | "historic_district" | "special_district" | "split_lot" | "irregular_lot" | "pending_rezoning" | "unsupported_district" | "manual_geometry" | "data_conflict" | "other"; message: string }

export interface AgentPass { model: ModelId; usage: NormUsage; cost: number; stopReason: string | null; toolCalls: number }
export interface AgentResult {
  selections: AgentSelection[];
  flags: AgentFlag[];
  usage: NormUsage;
  cost: number;
  /** model of the pass whose selections are returned */
  model: ModelId;
  escalated: boolean;
  passes: AgentPass[];
}

export interface AgentDeps {
  client?: LlmClient | null;
  geocode?: typeof geosearch;
  pluto?: typeof getPluto;
  searchText?: typeof searchZr;
  section?: typeof getSection;
  rules?: ExtRule[];
  maxIterations?: number;
}

const FLAG_KINDS = [
  "landmark", "historic_district", "special_district", "split_lot", "irregular_lot",
  "pending_rezoning", "unsupported_district", "manual_geometry", "data_conflict", "other",
] as const;

export const AGENT_SYSTEM = `You are a zoning rule-selection assistant for a pre-design site brief in New York City.
You do NOT know any zoning values. Never use prior knowledge for a floor area ratio, height, setback, yard or coverage value.
Your job: for this lot, decide which rule from the engine's rules table applies to each field, using only tool results.
- Call listCandidateRules first. Only rule IDs returned by listCandidateRules may be passed to selectRule.
- Use searchZoningText and getClause to confirm the conditions (lot type, street width, program, building type) against the Zoning Resolution text before selecting.
- Use calculate for any arithmetic. Never compute numbers yourself.
- Call selectRule once per field (and once per rule for a field that differs between portions of a split lot), with a one-sentence reason that names the condition you matched.
- If the conditions are ambiguous, a rule is missing, a special district or landmark may modify the result, or you are unsure for any reason, call flagForReview instead of guessing.
- When finished, reply with one short sentence. Do not restate numbers.`;

const asJson = (x: unknown) => JSON.stringify(x);

/** Rules for the lot's districts, in compact form. */
export function candidateRules(districts: string[], rules: ExtRule[] = getAllRules()) {
  const set = new Set(districts.map((d) => d.trim().toUpperCase()));
  return rules
    .filter((r) => r.districts.some((d) => set.has(d)))
    .map((r) => ({ id: r.id, field: r.field, value: r.value, unit: r.unit, districts: r.districts, when: r.when, section: r.citation.section, note: r.note ?? null }));
}

export function lotDistricts(site: SiteData): string[] {
  const codes = basePortions(site).map((p) => p.code);
  const extra = [...(site.pluto?.overlays ?? [])];
  return [...new Set([...codes, ...(codes.length ? [] : site.pluto?.zoneDist ?? []), ...extra])];
}

function pv(value: number, unit: Unit): PValue {
  return { value, unit, status: "data", confidence: "cited" };
}

const CALC_SCHEMA = z.object({
  op: z.enum(["maxFloorArea", "coverageArea", "areaShare"]).describe("maxFloorArea = lotArea x far; coverageArea = lotArea x coveragePercent/100; areaShare = lotArea x share"),
  lotArea: z.number().positive().describe("square feet"),
  far: z.number().nonnegative().optional().describe("for maxFloorArea"),
  coveragePercent: z.number().nonnegative().optional().describe("for coverageArea, e.g. 65 means 65 percent"),
  share: z.number().min(0).max(1).optional().describe("for areaShare, a fraction 0..1"),
});

export function makeTools(site: SiteData, deps: AgentDeps = {}) {
  const geocodeFn = deps.geocode ?? geosearch;
  const plutoFn = deps.pluto ?? getPluto;
  const searchFn = deps.searchText ?? searchZr;
  const sectionFn = deps.section ?? getSection;
  const candidates = candidateRules(lotDistricts(site), deps.rules);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const selections: AgentSelection[] = [];
  const flags: AgentFlag[] = [];
  const calls = { n: 0 };
  const count = <A, R>(f: (a: A) => R) => (a: A): R => { calls.n++; return f(a); };

  const tools = [
    betaZodTool({
      name: "geocode",
      description: "Look up a NYC address or 10-digit BBL via NYC GeoSearch. Returns up to 3 matches with BBL and provenance.",
      inputSchema: z.object({ query: z.string().min(1) }),
      strict: true,
      run: count(async ({ query }) => {
        const r = await geocodeFn(query);
        return asJson(r.slice(0, 3).map((g) => ({ label: g.label, bbl: g.bbl, provenance: g.provenance })));
      }),
    }),
    betaZodTool({
      name: "getPluto",
      description: "Fetch the PLUTO lot record for a BBL (lot area, frontage, depth, districts, overlays, special districts, landmark, lot type) with provenance.",
      inputSchema: z.object({ bbl: z.string().regex(/^\d{10}$/) }),
      strict: true,
      run: count(async ({ bbl }) => {
        const p = site.pluto && site.pluto.bbl === bbl ? site.pluto : await plutoFn(bbl);
        const { provenance, ...rest } = p;
        const first = Object.values(provenance)[0];
        return asJson({ ...rest, provenance: first ? { dataset: first.dataset, version: first.version, url: first.url, fetchedAt: first.fetchedAt } : null });
      }),
    }),
    betaZodTool({
      name: "getZoningLayers",
      description: "Zoning districts, overlays and special districts that intersect this site's lot (share of lot area computed in code) with provenance.",
      inputSchema: z.object({ bbl: z.string().regex(/^\d{10}$/) }),
      strict: true,
      run: count(({ bbl }) => {
        if (site.geocode && site.geocode.bbl !== bbl) throw new Error(`Only the site's own BBL ${site.geocode.bbl} is available`);
        return asJson(site.districts.map((d) => ({ code: d.code, kind: d.kind, share: d.share, dataset: d.provenance.dataset, version: d.provenance.version, fetchedAt: d.provenance.fetchedAt })));
      }),
    }),
    betaZodTool({
      name: "searchZoningText",
      description: "BM25 search over the NYC Zoning Resolution corpus. Returns the top 5 chunks with section ids and anchors.",
      inputSchema: z.object({ query: z.string().min(2) }),
      strict: true,
      run: count(({ query }) => asJson(searchFn(query, 5))),
    }),
    betaZodTool({
      name: "getClause",
      description: "Return the text of one Zoning Resolution section by id, e.g. '23-22'.",
      inputSchema: z.object({ sectionId: z.string().min(1) }),
      strict: true,
      run: count(({ sectionId }) => {
        const s = sectionFn(sectionId);
        if (!s) throw new Error(`Section ${sectionId} not found in corpus`);
        return asJson({ id: s.id, title: s.title, lastAmended: s.lastAmended, url: s.url, text: s.text.slice(0, 9000), truncated: s.text.length > 9000 });
      }),
    }),
    betaZodTool({
      name: "calculate",
      description: "Deterministic arithmetic via the engine's calculators. Returns value and the formula string.",
      inputSchema: CALC_SCHEMA,
      strict: true,
      run: count((a) => {
        const lot = pv(a.lotArea, "sf");
        let r: PValue;
        if (a.op === "maxFloorArea") {
          if (a.far === undefined) throw new Error("far is required for maxFloorArea");
          r = maxFloorArea(lot, pv(a.far, "ratio"));
        } else if (a.op === "coverageArea") {
          if (a.coveragePercent === undefined) throw new Error("coveragePercent is required for coverageArea");
          r = coverageArea(lot, pv(a.coveragePercent, "percent"));
        } else {
          if (a.share === undefined) throw new Error("share is required for areaShare");
          r = areaShare(lot, a.share);
        }
        return asJson({ value: r.value, unit: r.unit, formula: r.formula });
      }),
    }),
    betaZodTool({
      name: "listCandidateRules",
      description: "Rules from the engine's rules table for this lot's districts: id, field, value, unit, conditions (when) and the ZR section. The only source of selectable rule IDs.",
      inputSchema: z.object({ field: z.string().optional().describe("optional exact field filter, e.g. 'maxFar.residential'") }),
      strict: true,
      run: count(({ field }) => asJson(field ? candidates.filter((c) => c.field === field) : candidates)),
    }),
    betaZodTool({
      name: "selectRule",
      description: "Record that a candidate rule applies to a field. ruleId must come from listCandidateRules and its field must match.",
      inputSchema: z.object({ field: z.string(), ruleId: z.string(), reason: z.string().min(3) }),
      strict: true,
      run: count(({ field, ruleId, reason }) => {
        const c = byId.get(ruleId);
        if (!c) throw new Error(`Unknown ruleId ${ruleId}: choose only IDs returned by listCandidateRules`);
        if (c.field !== field) throw new Error(`Rule ${ruleId} is for field ${c.field}, not ${field}`);
        if (!selections.some((s) => s.field === field && s.ruleId === ruleId)) selections.push({ field, ruleId, reason });
        return "recorded";
      }),
    }),
    betaZodTool({
      name: "flagForReview",
      description: "Flag something a human must review instead of guessing.",
      inputSchema: z.object({ kind: z.enum(FLAG_KINDS), message: z.string().min(3) }),
      strict: true,
      run: count(({ kind, message }) => {
        flags.push({ kind, message });
        return "flagged";
      }),
    }),
  ];
  return { tools, selections, flags, calls };
}

function siteContext(site: SiteData, brief: ZoningBrief): string {
  return asJson({
    bbl: site.geocode?.bbl ?? site.pluto?.bbl ?? null,
    address: site.geocode?.label ?? site.pluto?.address ?? null,
    districts: lotDistricts(site),
    splitLot: brief.splitLot.isSplit,
    assumptions: brief.assumptions.map((a) => a.statement),
    intendedUse: brief.controls.intendedUse,
    programs: brief.controls.programs,
  });
}

async function runPass(
  client: LlmClient, model: ModelId, effort: "low" | "medium", site: SiteData, brief: ZoningBrief,
  deps: AgentDeps, extra?: string,
): Promise<{ selections: AgentSelection[]; flags: AgentFlag[]; pass: AgentPass }> {
  const t = makeTools(site, deps);
  const params: Anthropic.Beta.Messages.BetaToolRunnerParams = {
    model,
    max_tokens: 8000,
    system: [{ type: "text", text: AGENT_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: t.tools,
    tool_choice: { type: "auto" },
    output_config: { effort },
    max_iterations: deps.maxIterations ?? 14,
    messages: [{
      role: "user",
      content: `Select the applicable rule for each control field of this lot and flag anything uncertain.\nLot context (JSON): ${siteContext(site, brief)}${extra ? `\n\n${extra}` : ""}`,
    }],
  };
  let usage = ZERO_USAGE;
  let stop: string | null = null;
  for await (const msg of client.beta.messages.toolRunner(params)) {
    usage = addUsage(usage, normUsage(msg.usage));
    stop = msg.stop_reason;
  }
  const flags = [...t.flags];
  if (stop === "refusal" || stop === "max_tokens") flags.push({ kind: "other", message: `Model rule-selection stopped early (${stop}); its cross-check is incomplete.` });
  return { selections: t.selections, flags, pass: { model, usage, cost: costFromUsage(model, usage), stopReason: stop, toolCalls: t.calls.n } };
}

function describeDisagreements(x: CrossCheckResult): string {
  const lines = x.comparisons.filter((c) => c.status === "disagree").map((c) => `- ${c.field}: engine ${c.engineRuleIds.join(", ")}; first pass chose ${c.agentRuleIds.join(", ")}`);
  return lines.join("\n");
}

/**
 * Run the rule-selection agent. Pass 1: Sonnet. Escalation (Opus, result.escalated = true) when the lot is split
 * or pass 1 disagrees with the engine. Returns null when no API key is configured.
 */
export async function runRuleAgent(site: SiteData, brief: ZoningBrief, deps: AgentDeps = {}): Promise<AgentResult | null> {
  const client = deps.client === undefined ? getClient() : deps.client;
  if (!client) return null;

  const first = await runPass(client, MODELS.synth, "medium", site, brief, deps);
  const x = compareSelections(first.selections, brief);
  const needsEscalation = brief.splitLot.isSplit || x.disagreements.length > 0;
  if (!needsEscalation) {
    return { selections: first.selections, flags: first.flags, usage: first.pass.usage, cost: first.pass.cost, model: MODELS.synth, escalated: false, passes: [first.pass] };
  }
  const extra = [
    "ESCALATION: a first pass with a smaller model produced the selections below. Re-derive them independently from the tools.",
    brief.splitLot.isSplit ? "This lot is split between districts: select rules for each portion's district and flag anything the table does not cover." : "",
    x.disagreements.length ? `The rule engine disagreed on these fields; resolve each, or flagForReview:\n${describeDisagreements(x)}` : "",
    `First-pass selections: ${asJson(first.selections.map((s) => ({ field: s.field, ruleId: s.ruleId })))}`,
  ].filter(Boolean).join("\n");
  const second = await runPass(client, MODELS.hard, "medium", site, brief, deps, extra);
  const usage = addUsage(first.pass.usage, second.pass.usage);
  return {
    selections: second.selections,
    flags: second.flags,
    usage,
    cost: Math.round((first.pass.cost + second.pass.cost) * 1e6) / 1e6,
    model: MODELS.hard,
    escalated: true,
    passes: [first.pass, second.pass],
  };
}
