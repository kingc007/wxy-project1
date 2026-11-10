// Cross-check of the model's rule selections against the deterministic engine. Values are never changed here:
// a disagreement only adds a review flag and demotes the field's confidence to "conflicting".
import type { PValue, ReviewFlag } from "@/lib/types";
import type { Controls, ZoningBrief } from "@/lib/zoning/model";

export interface AgentSelection { field: string; ruleId: string; reason: string }

export type CrossStatus = "agree" | "disagree" | "agent_missing" | "engine_missing";
export interface FieldComparison {
  field: string;
  status: CrossStatus;
  engineRuleIds: string[];
  engineValue: number | null;
  agentRuleIds: string[];
}
export interface CrossCheckResult {
  comparisons: FieldComparison[];
  /** data_conflict flags, one per disagreement */
  flags: ReviewFlag[];
  /** copy of brief.controls with confidence "conflicting" on disagreeing fields; values untouched */
  controls: Controls;
  disagreements: string[];
}

/** Resolve a rule-table field name ("maxFar.residential", "yards.rear") to the PValue in a Controls object. */
export function pvalueForField(c: Controls, field: string): PValue | undefined {
  if (field.startsWith("maxFar.")) return c.maxFar[field.slice("maxFar.".length)];
  switch (field) {
    case "baseHeight.min": return c.baseHeight.min;
    case "baseHeight.max": return c.baseHeight.max;
    case "maxBuildingHeight": return c.maxBuildingHeight;
    case "yards.front": return c.yards.front;
    case "yards.rear": return c.yards.rear;
    case "yards.side": return c.yards.side;
    case "lotCoverage.max": return c.lotCoverage.max;
    default: return undefined;
  }
}

/** Fields the cross-check covers (those with exactly one PValue per field in Controls). */
export function crossCheckFields(c: Controls): string[] {
  return [
    ...Object.keys(c.maxFar).map((k) => `maxFar.${k}`),
    "baseHeight.min", "baseHeight.max", "maxBuildingHeight", "yards.front", "yards.rear", "yards.side", "lotCoverage.max",
  ];
}

const fmt = (v: number | null) => (v === null ? "no value" : String(v));

export function compareSelections(agent: AgentSelection[], brief: ZoningBrief): CrossCheckResult {
  const controls: Controls = structuredClone(brief.controls);
  const portionControls = brief.splitLot.portions.map((p) => p.controls);
  const fields = new Set<string>(crossCheckFields(brief.controls));
  for (const pc of portionControls) crossCheckFields(pc).forEach((f) => fields.add(f));
  for (const s of agent) fields.add(s.field);

  const comparisons: FieldComparison[] = [];
  const flags: ReviewFlag[] = [];
  const disagreements: string[] = [];

  for (const field of fields) {
    const merged = pvalueForField(brief.controls, field);
    const engineIds = new Set<string>(merged?.ruleIds ?? []);
    // split lots: the merged value may be "manual" with no ruleIds; the portions carry the rules
    for (const pc of portionControls) for (const id of pvalueForField(pc, field)?.ruleIds ?? []) engineIds.add(id);
    const agentIds = [...new Set(agent.filter((s) => s.field === field).map((s) => s.ruleId))];
    const engineRuleIds = [...engineIds];
    if (engineRuleIds.length === 0 && agentIds.length === 0) continue;

    let status: CrossStatus;
    if (engineRuleIds.length === 0) status = "engine_missing";
    else if (agentIds.length === 0) status = "agent_missing";
    else status = agentIds.every((id) => engineIds.has(id)) ? "agree" : "disagree";

    const engineValue = merged?.value ?? null;
    comparisons.push({ field, status, engineRuleIds, engineValue, agentRuleIds: agentIds });
    if (status === "disagree") {
      disagreements.push(field);
      flags.push({
        kind: "data_conflict",
        message: `Model and rule engine disagree on ${field}: engine ${engineRuleIds.join(", ")}/${fmt(engineValue)}, model ${agentIds.join(", ")}`,
        citations: merged?.citations,
      });
      const pv = pvalueForField(controls, field);
      if (pv) pv.confidence = "conflicting";
    }
  }
  comparisons.sort((a, b) => a.field.localeCompare(b.field));
  return { comparisons, flags, controls, disagreements };
}
