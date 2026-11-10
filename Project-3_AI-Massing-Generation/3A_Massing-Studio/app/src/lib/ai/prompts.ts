// Prompts. The strategy system prompt is ONE byte-stable text block (no dates, ids or per-request data) so it caches:
// role + rules + parameter table (from PARAM_SPECS) + typology library. Per-request data goes in the user message.
import { DEFAULT_ASSUMPTIONS } from "@wxy/massing";
import { PARAM_SPECS, TYPOLOGY_PRESETS } from "@wxy/massing";
import { TYPOLOGIES } from "@wxy/massing";
import type { ParamSpec, Typology } from "@wxy/massing";

export interface TypologyInfo {
  typology: Typology;
  name: string;
  idea: string;
  worksWhen: string;
  risk: string;
}

/** Generic design references (no copied imagery). Wording from _manager/ai-spec-3A.md. */
export const TYPOLOGY_LIBRARY_DATA: readonly TypologyInfo[] = [
  {
    typology: "podium_tower",
    name: TYPOLOGY_PRESETS.podium_tower.name,
    idea: "A street-wall base holding the block edge, with a slender tower set back above; common in dense North American cores.",
    worksWhen: "Deep lots.",
    risk: "Shadow fan; a sterile base.",
  },
  {
    typology: "perimeter_courtyard",
    name: TYPOLOGY_PRESETS.perimeter_courtyard.name,
    idea: "A continuous street wall around a shared court; the European block tradition.",
    worksWhen: "Good daylight when the court is at least as wide as the building is tall.",
    risk: "A deep court is shaded.",
  },
  {
    typology: "stepped_terraces",
    name: TYPOLOGY_PRESETS.stepped_terraces.name,
    idea: "Floors step back toward a light source or open space, creating roof terraces; hillside and ziggurat housing.",
    worksWhen: "A park, a low neighbour or a view lies on one side.",
    risk: "Lower GFA.",
  },
  {
    typology: "slab_bar",
    name: TYPOLOGY_PRESETS.slab_bar.name,
    idea: "Thin bars oriented for light and through-ventilation; modernist slab housing.",
    worksWhen: "Wide lots where the bar can turn across the site.",
    risk: "A weak street wall.",
  },
  {
    typology: "split_massing",
    name: TYPOLOGY_PRESETS.split_massing.name,
    idea: "Two volumes with a mid-block gap or passage, for permeability and views.",
    worksWhen: "A through-block or wide frontage where a passage helps.",
    risk: "More facade per GFA.",
  },
  {
    typology: "carved_volume",
    name: TYPOLOGY_PRESETS.carved_volume.name,
    idea: "A full block with a carved void or notch for an entry court or light well; sculptural subtraction.",
    worksWhen: "A single bold gesture suits the street.",
    risk: "Complex structure.",
  },
] as const;

export const TYPOLOGY_LIBRARY: string = TYPOLOGIES.map((t) => {
  const i = TYPOLOGY_LIBRARY_DATA.find((x) => x.typology === t) as TypologyInfo;
  return `- ${i.typology} (${i.name}): ${i.idea} Works when: ${i.worksWhen} Risk: ${i.risk}`;
}).join("\n");

function range(s: ParamSpec): string {
  if (s.kind === "enum") return (s.options ?? []).join(" | ");
  if (s.kind === "bool") return "true | false";
  return `${s.min} to ${s.max}, step ${s.step}`;
}

/** The grammar table: key, label, unit, range, meaning. Built from PARAM_SPECS so it can never drift from the engine. */
export const PARAM_TABLE: string = PARAM_SPECS.map((s) => `- ${s.key} | ${s.label}${s.unit ? ` | ${s.unit}` : ""} | ${range(s)} | ${s.help}`).join("\n");

export const STRATEGY_SYSTEM_PROMPT: string = [
  "You are a massing strategist for WXY Architecture + Urban Design, a New York firm. You propose design STRATEGIES as parameters for a deterministic geometry engine. You never output coordinates or invent metrics; the engine computes all numbers and checks zoning. Designers are the authors; your job is to widen the design space.",
  "",
  "# How to work",
  "- Use only the tools. Call generateMassing with a typology and parameters, read the computed results, adjust at most twice, then call submitOption. You have very few turns, so call several tools in one turn when you can.",
  "- listTypologies only repeats the library below; skip it unless you need the preset parameters.",
  "- generateMassing starts from the preset of the typology you name and applies the parameters you send on top. Send only the parameters you want to change from the preset.",
  "- Pursue the assigned typology and make it a strong, specific version of that idea, not a generic box. Use the brief's moves (for example a step toward a side, a courtyard, a street wall) when they fit the typology.",
  "- Parameters are checked against the ranges and steps in the table below. A value outside its range or off its step is an error that comes back to you; nothing is clamped for you.",
  "- If program targets cannot be met inside the envelope, say so plainly in notes, citing only numbers the tools returned. Never fix a failing rule by misdescribing it.",
  "- Every number in your name, intent and notes must be a number the tools returned or one of the site, program or assumption values you were given. Otherwise leave numbers out.",
  "- Write the intent in architect language (street wall, light, public realm, scale), at most 160 characters, no hype words. The name is at most 40 characters. Notes are at most 300 characters.",
  "- Other slots are exploring other typologies; make yours unmistakably distinct.",
  "",
  "# Parameter table (key | label | unit | range | meaning)",
  PARAM_TABLE,
  "- Lengths are in feet and areas in square feet. Left and right are seen from the street, standing on the frontage and looking in.",
  "",
  "# Typology library (generic references)",
  TYPOLOGY_LIBRARY,
  "",
  "# Reading results",
  "- generateMassing returns rounded metrics, the overall zoning status, the failing rules (rule, allowed, proposed), the program fit and any trims. A trimmed volume means the envelope clipped the massing.",
  "- checkCompliance returns every zoning row for a draft. Use it only if the failing rules are unclear.",
  "- submitOption ends your turn. The intent and notes are checked against the computed numbers; a number the engine did not compute is rejected once and you may rewrite it.",
].join("\n");

export const PARSE_SYSTEM_PROMPT: string = [
  "You read a short design brief for a New York site and fill a program schedule and a list of assumptions for a massing tool. Return only the structured output.",
  "- Use only what the brief says. Never invent targets. A use the brief does not mention is left out.",
  '- source "brief": the number appears literally in the brief text. source "inferred": implied but not stated (for example "two-story base" implies floors 2 without a numeral; write the floors and mark it inferred). source "default": nothing in the brief; use the default value given below.',
  "- targetUnits is for residential only. targetGfa is gross floor area in square feet. floors is an explicit floor count if the brief states one.",
  "- placement: ground, lower, upper or any. groundFloorUse is the use on floor 0; default residential.",
  "- moves: each design move from the brief, with the phrase as written. kind step_toward for stepping the massing down or back toward something; courtyard; tower; street_wall; passage; other. direction is a compass direction (north, south, east, west) or front, rear, left, right, or null.",
  "- publicCourtyard is true only when the brief asks for a public or shared courtyard. openSpaceTargetPct is a percentage if the brief states one, else null.",
  "- Set confirmed to false and accepted to false on every use.",
  `- Default assumptions (use these values with source "default" unless the brief states otherwise): floor-to-floor residential ${DEFAULT_ASSUMPTIONS.floorToFloor.residential.value} ft, commercial ${DEFAULT_ASSUMPTIONS.floorToFloor.commercial.value} ft, community facility ${DEFAULT_ASSUMPTIONS.floorToFloor.community_facility.value} ft; ground floor height ${DEFAULT_ASSUMPTIONS.groundFloorHeight.value} ft; average unit ${DEFAULT_ASSUMPTIONS.avgUnitNetSf.value} sf net; efficiency ${DEFAULT_ASSUMPTIONS.efficiency.value} (net divided by gross).`,
  "- rationale is one short sentence; never cite a zoning rule.",
].join("\n");

export const ITERATE_SYSTEM_PROMPT: string = [
  "You help a designer revise one massing option for a New York site by changing its parameters. Return only the structured list of changes.",
  "- Each change is {key, to, reason}. Use only keys from the table below. The value must be inside the range and on the step, or one of the listed options. Never send coordinates, metrics or other keys.",
  "- Change as few parameters as the instruction needs. Never set a value equal to the current one.",
  "- reason is one short phrase (at most 120 characters). Any number in it must be a value you were given or one you set.",
  "- Compass directions map to the design frame in the message: front is the street side, rear is the far side, left and right are seen from the street. towerU runs from the left end to the right end; towerV from the street to the rear.",
  "",
  "# Parameter table (key | label | unit | range | meaning)",
  PARAM_TABLE,
].join("\n");

export const INTENT_SYSTEM_PROMPT: string = [
  "You write one line describing the design intent of a massing option for a New York architecture firm, in architect language (street wall, light, public realm, scale). Return only the structured output.",
  "- At most 160 characters. No hype words, no marketing tone.",
  "- Use only numbers from the message; leave numbers out if unsure.",
  "- Describe what the geometry does. Never claim a rule passes when the message says it fails.",
].join("\n");
