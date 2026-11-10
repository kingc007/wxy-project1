// Brief parsing. Offline: regex parser (deterministic, labelled builtin). AI: haiku structured output + a code post-check
// that downgrades any "brief" number that does not literally appear in the brief text.
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AssumptionsSchema, DEFAULT_ASSUMPTIONS, ProgramScheduleSchema } from "@wxy/massing";
import type { Assumptions, DesignMove, Program, ProgramSchedule, ProgramUse } from "@wxy/massing";
import { MODELS, REQUEST_TIMEOUT_MS, type AiClient } from "./client";
import type { SlotUsage } from "./contracts";
import { usageFromResponse, usdFor } from "./cost";
import { aiFailed } from "./errors";
import { PARSE_SYSTEM_PROMPT } from "./prompts";

export interface ParsedBrief {
  schedule: ProgramSchedule;
  assumptions: Partial<Assumptions>;
}

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const num = (s: string): number => {
  const w = WORDS[s.toLowerCase()];
  return w !== undefined ? w : Number(s.replace(/,/g, ""));
};
const NUMBER_WORD = Object.keys(WORDS).join("|");

function programOf(word: string): Program | null {
  const w = word.toLowerCase();
  if (/^(housing|residential|apartments?|homes|dwellings?|living)$/.test(w)) return "residential";
  if (/^(retail|commercial|office|offices|shops?|store|stores|restaurant|restaurants)$/.test(w)) return "commercial";
  if (/^(community|library|school|civic|clinic|daycare|cultural|institutional)$/.test(w)) return "community_facility";
  return null;
}
const COMPASS = ["north", "south", "east", "west"] as const;

const emptyUse = (use: Program): ProgramUse => ({ use, targetGfa: null, targetUnits: null, floors: null, placement: "any", source: "brief", accepted: false });

/** Offline regex parser. Understands: "~N units", "N sf of <use>", "ground-floor retail/commercial", "community",
 *  "courtyard", "toward the <direction|park>", "N-story <use> base", "on the lower N floors", open space "N%". */
export function parseBriefOffline(brief: string): ParsedBrief {
  const uses = new Map<Program, ProgramUse>();
  const get = (u: Program) => {
    let x = uses.get(u);
    if (!x) {
      x = emptyUse(u);
      uses.set(u, x);
    }
    return x;
  };
  const moves: DesignMove[] = [];
  const assumptions: Partial<Assumptions> = {};
  let groundFloorUse: Program = "residential";
  let groundExplicit = false;

  // units
  const unitsRe = /(\d[\d,]*)\s*[-\s]?(?:units?|apartments?|dwelling units?|homes)\b/gi;
  for (const m of brief.matchAll(unitsRe)) {
    const n = num(m[1]);
    if (n > 0) {
      get("residential").targetUnits = Math.round(n);
      break;
    }
  }

  // "N sf of <use>" (use word within a few words of the unit)
  const sfRe = /(\d[\d,]*(?:\.\d+)?)\s*(?:g?sf|sq\.?\s*ft\.?|square\s+(?:feet|foot))\b(?:\s+of)?\s+(?:new\s+|ground[- ]floor\s+)?([a-z]+)/gi;
  const mentions: { use: Program; end: number }[] = [];
  for (const m of brief.matchAll(sfRe)) {
    const u = programOf(m[2]);
    if (!u) continue;
    const x = get(u);
    x.targetGfa = num(m[1]);
    mentions.push({ use: u, end: (m.index ?? 0) + m[0].length });
  }
  // "on the lower two floors" attaches to the nearest preceding use mention
  const floorsRe = new RegExp(
    `(?:\\b(?:on|in|across|within)\\s+)?(?:the\\s+)?(?:lower|first|bottom|ground)\\s+(\\d+|${NUMBER_WORD})\\s+(?:floors?|stor(?:y|ies|eys))|\\bground\\s+(?:floor\\s+)?and\\s+(?:the\\s+)?(?:second|2nd)\\s+(?:floors?|stor(?:y|ies))`,
    "gi",
  );
  for (const m of brief.matchAll(floorsRe)) {
    const at = m.index ?? 0;
    const prior = [...mentions].reverse().find((x) => x.end <= at);
    if (prior) {
      const x = get(prior.use);
      x.floors = m[1] ? num(m[1]) : 2;
      x.placement = "lower";
    }
  }
  // "a two-story commercial base"
  const baseRe = new RegExp(`(\\d+|${NUMBER_WORD})[-\\s]stor(?:y|ey|ies)\\s+([a-z]+)(?:\\s+facility)?\\s+base`, "gi");
  for (const m of brief.matchAll(baseRe)) {
    const u = programOf(m[2]);
    if (!u) continue;
    const x = get(u);
    x.floors = num(m[1]);
    x.placement = "lower";
    if (/^\d+$/.test(m[1]) === false) x.source = "brief";
    if (u !== "residential") {
      groundFloorUse = u;
      groundExplicit = true;
    }
  }
  // ground-floor use
  const gfRe = /ground[- ]floor\s+(retail|commercial|shops?|stores?|community(?:\s+facility)?|library|residential|lobby)/gi;
  for (const m of brief.matchAll(gfRe)) {
    const w = m[1].toLowerCase();
    const u = w === "lobby" ? "residential" : (programOf(w.split(/\s+/)[0]) as Program | null);
    if (!u) continue;
    const x = get(u);
    if (x.placement === "any") x.placement = "ground";
    if (!groundExplicit && u !== "residential") {
      groundFloorUse = u;
      groundExplicit = true;
    }
    break;
  }
  // community without a number
  if (/\bcommunity\s+(?:facility|space|room|center|centre)/i.test(brief) && !uses.has("community_facility")) {
    const x = get("community_facility");
    x.placement = "lower";
  }
  // a non-residential use placed low with no explicit ground-floor use becomes the ground-floor use
  if (!groundExplicit) {
    for (const u of uses.values()) {
      if (u.use !== "residential" && u.placement === "lower") {
        groundFloorUse = u.use;
        break;
      }
    }
  }

  // open space
  let openSpaceTargetPct: number | null = null;
  const os = /open\s+space[^.%]*?(\d+(?:\.\d+)?)\s*(?:%|percent)/i.exec(brief);
  if (os) openSpaceTargetPct = Number(os[1]);

  // courtyard
  const publicCourtyard = /\b(?:public|shared|communal)\s+(?:courtyard|court|garden)/i.test(brief);
  const cy = /courtyard/i.exec(brief);
  if (cy) moves.push({ text: sentenceAround(brief, cy.index), kind: "courtyard", direction: null });

  // "toward the <dir|park> [to the <dir>]"
  const towardRe = /\btoward(?:s)?\s+the\s+([a-z]+)(?:\s+(?:to|on|at)\s+the\s+(north|south|east|west))?/gi;
  for (const m of brief.matchAll(towardRe)) {
    const first = m[1].toLowerCase();
    let direction: DesignMove["direction"] = null;
    if (m[2]) direction = m[2].toLowerCase() as DesignMove["direction"];
    else if ((COMPASS as readonly string[]).includes(first)) direction = first as DesignMove["direction"];
    else if (first === "street" || first === "front") direction = "front";
    else if (first === "rear" || first === "back") direction = "rear";
    else if (first !== "park") continue;
    const before = brief.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0);
    const kind: DesignMove["kind"] = /step|down|terrace|lower|slope/i.test(before) ? "step_toward" : "other";
    const at = m.index ?? 0;
    const from = Math.max(brief.lastIndexOf(",", at) + 1, brief.lastIndexOf(".", at) + 1, 0);
    moves.push({ text: brief.slice(from, at + m[0].length).replace(/^\s*(?:and|then)\s+/i, "").trim().slice(0, 200), kind, direction });
  }
  const sw = /street\s+wall/i.exec(brief);
  if (sw) moves.push({ text: sentenceAround(brief, sw.index), kind: "street_wall", direction: null });
  const tw = /\b(?:tower|slender)\b/i.exec(brief);
  if (tw) moves.push({ text: sentenceAround(brief, tw.index), kind: "tower", direction: null });
  const ps = /\b(?:passage|mid-block|through-block)\b/i.exec(brief);
  if (ps) moves.push({ text: sentenceAround(brief, ps.index), kind: "passage", direction: null });

  // assumptions stated in the brief
  const um = /(\d[\d,]*)\s*(?:sf|sq\.?\s*ft)\s*(?:net\s+)?(?:average|avg)\s+unit|(?:average|avg)\s+unit(?:\s+size)?\s+(?:of\s+)?(\d[\d,]*)/i.exec(brief);
  if (um) assumptions.avgUnitNetSf = { value: num(um[1] ?? um[2]), source: "brief", rationale: "Stated in your brief" };
  const ff = /(\d+(?:\.\d+)?)[-\s]?(?:ft|foot|feet)\s+floor[- ]to[- ]floor/i.exec(brief);
  if (ff) assumptions.floorToFloor = { ...DEFAULT_ASSUMPTIONS.floorToFloor, residential: { value: Number(ff[1]), source: "brief", rationale: "Stated in your brief" } };
  const ef = /(\d+(?:\.\d+)?)\s*%\s*efficien/i.exec(brief);
  if (ef && Number(ef[1]) > 0 && Number(ef[1]) <= 100) assumptions.efficiency = { value: Number(ef[1]) / 100, source: "brief", rationale: "Stated in your brief" };

  const list = [...uses.values()];
  if (!list.length) list.push({ ...emptyUse("residential"), source: "default" });
  const schedule: ProgramSchedule = { uses: list, groundFloorUse, openSpaceTargetPct, publicCourtyard, moves: moves.slice(0, 10), confirmed: false };
  return { schedule: ProgramScheduleSchema.parse(schedule), assumptions };
}

function sentenceAround(text: string, at: number): string {
  const start = Math.max(text.lastIndexOf(".", at - 1) + 1, text.lastIndexOf(",", at - 1) + 1, 0);
  let end = text.indexOf(".", at);
  const comma = text.indexOf(",", at);
  if (end === -1 || (comma !== -1 && comma < end)) end = comma === -1 ? text.length : comma;
  return text.slice(start, end).trim().slice(0, 200) || text.slice(0, 200);
}

// ---------- post-check ----------
/** Numbers written in the brief: digits (commas removed), "60k", and number words. */
export function numbersInBrief(brief: string): Set<number> {
  const s = new Set<number>();
  for (const m of brief.matchAll(/(\d[\d,]*(?:\.\d+)?)(\s*k\b)?/gi)) {
    const v = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(v)) {
      s.add(v);
      if (m[2]) s.add(v * 1000);
    }
  }
  for (const m of brief.toLowerCase().matchAll(new RegExp(`\\b(${NUMBER_WORD})\\b`, "g"))) s.add(WORDS[m[1]]);
  return s;
}
const near = (set: Set<number>, v: number) => [...set].some((x) => Math.abs(x - v) < 1e-9);

/** Downgrade "brief" to "inferred" when a number is not literally in the brief; force confirmed/accepted false;
 *  replace "default" assumptions with the code defaults; keep only brief/inferred assumptions. */
export function postCheckParsed(parsed: { schedule: ProgramSchedule; assumptions: Assumptions }, brief: string): ParsedBrief {
  const nums = numbersInBrief(brief);
  const uses = parsed.schedule.uses.map((u) => {
    const vals = [u.targetGfa, u.targetUnits, u.floors].filter((v): v is number => v !== null);
    const literal = vals.every((v) => near(nums, v));
    return { ...u, accepted: false, source: u.source === "brief" && !literal ? ("inferred" as const) : u.source };
  });
  const schedule: ProgramSchedule = { ...parsed.schedule, uses, confirmed: false };
  const out: Partial<Assumptions> = {};
  const check = (v: { value: number; source: "brief" | "inferred" | "default" | "user"; rationale: string }) => {
    if (v.source === "brief" && !(near(nums, v.value) || near(nums, v.value * 100))) return { ...v, source: "inferred" as const };
    return v;
  };
  const a = parsed.assumptions;
  const ftf = { residential: check(a.floorToFloor.residential), commercial: check(a.floorToFloor.commercial), community_facility: check(a.floorToFloor.community_facility) };
  if (Object.values(ftf).some((v) => v.source === "brief" || v.source === "inferred"))
    out.floorToFloor = {
      residential: ftf.residential.source === "default" ? DEFAULT_ASSUMPTIONS.floorToFloor.residential : ftf.residential,
      commercial: ftf.commercial.source === "default" ? DEFAULT_ASSUMPTIONS.floorToFloor.commercial : ftf.commercial,
      community_facility: ftf.community_facility.source === "default" ? DEFAULT_ASSUMPTIONS.floorToFloor.community_facility : ftf.community_facility,
    };
  for (const k of ["groundFloorHeight", "avgUnitNetSf", "efficiency"] as const) {
    const c = check(a[k]);
    if (c.source === "brief" || c.source === "inferred") out[k] = c;
  }
  return { schedule, assumptions: out };
}

// ---------- AI parser ----------
const ParseOutputSchema = z.object({ schedule: ProgramScheduleSchema, assumptions: AssumptionsSchema }).strict();

export async function parseBriefAi(
  client: AiClient,
  brief: string,
  envelopeSummary: unknown,
): Promise<{ parsed: ParsedBrief; usage: SlotUsage } | { error: string }> {
  const summary = envelopeSummary === undefined ? "" : `\n\nSite summary (context only):\n${typeof envelopeSummary === "string" ? envelopeSummary : JSON.stringify(envelopeSummary)}`.slice(0, 4000);
  const r = await client.messages.parse(
    {
      model: MODELS.parse,
      max_tokens: 4000,
      system: PARSE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Brief:\n${brief}${summary}` }],
      output_config: { format: zodOutputFormat(ParseOutputSchema), effort: "low" },
    },
    { timeout: REQUEST_TIMEOUT_MS },
  );
  const u = usageFromResponse(r.usage);
  const usage: SlotUsage = { ...u, usd: usdFor(MODELS.parse, u) };
  if (r.stop_reason === "refusal") return { error: "The AI declined this request; used the built-in parser." };
  const out = r.parsed_output as z.infer<typeof ParseOutputSchema> | null;
  if (!out) return { error: aiFailed("the reply wasn't valid structured output") };
  return { parsed: postCheckParsed(out, brief), usage };
}
