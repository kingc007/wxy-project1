// Iterate: instruction -> ParamDiff. The AI (or the built-in keyword rules) proposes; code fills `from`, validates
// range/step, and the engine computes before/after previews. Nothing is applied server-side.
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type Anthropic from "@anthropic-ai/sdk";
import {
  PARAM_SPEC_BY_KEY,
  ParamDiffSchema,
  allowedNumbersFromOption,
  checkGrounding,
  generateOption,
  snapParam,
  validateParams,
} from "@wxy/massing";
import type { Assumptions, EnvelopeModel, MassingOption, MassingParams, ProgramSchedule } from "@wxy/massing";
import { MODELS, REQUEST_TIMEOUT_MS, type AiClient } from "./client";
import type { ChangePreview, IterateResponse, SlotUsage } from "./contracts";
import { usageFromResponse, usdFor } from "./cost";
import { aiFailed } from "./errors";
import { failingRulesOf, toPayload } from "./generate";
import { ITERATE_SYSTEM_PROMPT } from "./prompts";
import { compassInFrame, compassToSide, contextAllowed, optionCounts, type Compass } from "./site";

type Value = number | string | boolean;
export interface RawChange {
  key: keyof MassingParams;
  to: Value;
  reason: string;
}

const COMPASS_WORDS: Compass[] = ["north", "south", "east", "west"];

// ---------- built-in keyword rules ----------
export function iterateOffline(instruction: string, model: EnvelopeModel, params: MassingParams): RawChange[] | { error: string } {
  const t = instruction.toLowerCase();
  const changes: RawChange[] = [];
  const set = <K extends keyof MassingParams>(key: K, to: MassingParams[K], reason: string) => {
    if (to !== params[key] && !changes.some((c) => c.key === key)) changes.push({ key, to, reason });
  };
  const snap = (key: keyof MassingParams, v: number) => snapParam(key, v);
  const dir = COMPASS_WORDS.find((d) => new RegExp(`\\b${d}\\b`).test(t));

  if (/\btaller\b|\bhigher\b|add floors|more floors/.test(t)) {
    if (params.upperMode === "none") set("baseFloors", snap("baseFloors", params.baseFloors + 1), "Built-in rule: taller adds one floor.");
    else set("upperFloors", snap("upperFloors", params.upperFloors + 2), "Built-in rule: taller adds two floors above the base.");
  }
  if (/\bshorter\b|\blower\b|fewer floors|reduce height/.test(t)) {
    if (params.upperMode === "none") set("baseFloors", snap("baseFloors", params.baseFloors - 1), "Built-in rule: shorter removes one floor.");
    else set("upperFloors", snap("upperFloors", params.upperFloors - 2), "Built-in rule: shorter removes two floors above the base.");
  }
  if (dir) {
    if (/tower|bar|slab/.test(t) && params.upperMode === "tower") {
      const { du, dv } = compassInFrame(model, dir);
      if (Math.abs(du) >= Math.abs(dv)) set("towerU", snap("towerU", params.towerU + Math.sign(du) * 0.2), `Built-in rule: ${dir} is along the street frontage.`);
      else set("towerV", snap("towerV", params.towerV + Math.sign(dv) * 0.2), `Built-in rule: ${dir} is into the block.`);
    } else if (/step|terrace|toward|down|light/.test(t) || params.stepEvery > 0) {
      set("stepFrom", compassToSide(model, dir), `Built-in rule: ${dir} is the ${compassToSide(model, dir)} side.`);
    }
  }
  if (/more light|more daylight|brighter|open (?:up )?the court/.test(t)) {
    if (params.ringDepth > 25) set("ringDepth", snap("ringDepth", params.ringDepth - 5), "Built-in rule: more light thins the courtyard ring.");
    if (params.stepEvery > 0) set("stepDepth", snap("stepDepth", params.stepDepth + 5), "Built-in rule: more light deepens the steps.");
  }
  if (!changes.length) return { error: "The built-in rules didn't recognise that instruction. Try: taller, shorter, a compass direction (east, west, north, south) for the tower or steps, or more light." };
  return changes;
}

// ---------- AI ----------
function optionSummary(o: MassingOption): string {
  const m = o.metrics;
  return JSON.stringify({
    gfa: Math.round(m.gfa / 10) * 10,
    far: Math.round(m.far * 100) / 100,
    floors: m.floors,
    height: Math.round(m.height * 10) / 10,
    overall: o.overall.label,
    failingRules: failingRulesOf(o),
  });
}

export async function iterateAi(
  client: AiClient,
  model: EnvelopeModel,
  option: MassingOption,
  instruction: string,
  history: { instruction: string }[],
): Promise<{ changes: RawChange[]; usage: SlotUsage } | { error: string }> {
  const compass = COMPASS_WORDS.map((d) => `${d} = ${compassToSide(model, d)}`).join(", ");
  const base = [
    `Current parameters: ${JSON.stringify(Object.fromEntries(Object.entries(option.params).sort(([a], [b]) => (a < b ? -1 : 1))))}`,
    `Computed: ${optionSummary(option)}`,
    `Compass to design frame: ${compass}.`,
    history.length ? `Earlier instructions: ${history.slice(-5).map((h) => h.instruction).join(" | ")}` : "",
    `Instruction: ${instruction}`,
  ]
    .filter(Boolean)
    .join("\n");
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: base }];
  const usage: SlotUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, usd: 0 };
  let lastErrors: string[] = [];

  for (let round = 0; round < 2; round++) {
    const r = await client.messages.parse(
      {
        model: MODELS.iterate,
        max_tokens: 3000,
        system: ITERATE_SYSTEM_PROMPT,
        messages,
        output_config: { format: zodOutputFormat(ParamDiffSchema), effort: "low" },
      },
      { timeout: REQUEST_TIMEOUT_MS },
    );
    const u = usageFromResponse(r.usage);
    usage.input += u.input;
    usage.output += u.output;
    usage.cacheRead += u.cacheRead;
    usage.cacheWrite += u.cacheWrite;
    usage.usd += usdFor(MODELS.iterate, u);
    if (r.stop_reason === "refusal") return { error: "The AI declined this request." };
    const out = r.parsed_output as z.infer<typeof ParamDiffSchema> | null;
    if (!out) {
      lastErrors = ["the reply wasn't valid structured output"];
    } else {
      const checked = checkChanges(out.changes, option.params);
      if (checked.errors.length === 0) return { changes: checked.changes, usage };
      lastErrors = checked.errors;
    }
    messages.push({ role: "assistant", content: r.content as Anthropic.ContentBlockParam[] });
    messages.push({ role: "user", content: `Those changes were rejected: ${lastErrors.join("; ")}. Return a corrected list.` });
  }
  return { error: aiFailed(lastErrors.join("; ").slice(0, 200)) };
}

/** Range / step validation per change (never clamps) and removal of no-ops and duplicate keys. */
export function checkChanges(changes: RawChange[], params: MassingParams): { changes: RawChange[]; errors: string[] } {
  const errors: string[] = [];
  const kept = new Map<keyof MassingParams, RawChange>();
  for (const c of changes) {
    const spec = PARAM_SPEC_BY_KEY[c.key];
    if (!spec) {
      errors.push(`${String(c.key)}: unknown parameter`);
      continue;
    }
    const v = validateParams({ [c.key]: c.to } as Partial<MassingParams>);
    if (!v.ok) {
      errors.push(...v.errors);
      continue;
    }
    if (c.to === params[c.key]) continue;
    kept.set(c.key, c);
  }
  if (!errors.length && kept.size === 0) errors.push("no change was needed: every value already matches");
  return { changes: [...kept.values()], errors };
}

// ---------- shared: preview ----------
const labelOf = (key: keyof MassingParams) => PARAM_SPEC_BY_KEY[key].label;

/** Fill `from`, ground each reason (AI prose) against computed values, and compute before/after with the engine. */
export function buildResponse(
  source: "ai" | "builtin",
  usage: SlotUsage | null,
  changes: RawChange[],
  model: EnvelopeModel,
  schedule: ProgramSchedule,
  assumptions: Assumptions,
  params: MassingParams,
): IterateResponse | { error: string } {
  const next: MassingParams = { ...params };
  for (const c of changes) (next as unknown as Record<string, unknown>)[c.key] = c.to;
  let before: MassingOption;
  let after: MassingOption;
  try {
    before = generateOption(model, schedule, assumptions, params);
    after = generateOption(model, schedule, assumptions, next);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The engine rejected the parameters." };
  }
  const allowed = [
    ...allowedNumbersFromOption(before, [...contextAllowed(model, schedule, assumptions), ...optionCounts(before)]),
    ...allowedNumbersFromOption(after, optionCounts(after)),
    ...changes.flatMap((c) =>
      [params[c.key], c.to]
        .filter((v): v is number => typeof v === "number")
        .map((value) => ({ label: `change.${c.key}`, value, decimals: 2 })),
    ),
  ];
  const out: ChangePreview[] = changes.map((c) => {
    const grounded = checkGrounding(c.reason, allowed).ok;
    return {
      key: c.key,
      from: params[c.key],
      to: c.to,
      reason: grounded ? c.reason : `Set ${labelOf(c.key)} to ${String(c.to)}.`,
    };
  });
  const ov = (o: MassingOption) => toPayload(o, { assigned: "podium_tower", name: "", intent: "", notes: [], agentLog: [], source }).overall;
  return {
    source,
    diff: { changes: out },
    preview: { metricsBefore: before.metrics, metricsAfter: after.metrics, overallBefore: ov(before), overallAfter: ov(after) },
    usage,
  };
}
