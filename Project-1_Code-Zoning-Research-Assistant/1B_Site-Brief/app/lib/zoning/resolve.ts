import type { Assumption, PValue } from "../types";
import type { ExtRule, RuleContext } from "./model";
import { findRules, normDistrict } from "./rules";
import { dedupeCitations, fieldUnit, fmtNum, needsInput, uniq } from "./pvalue";

const WHEN_TO_ASSUMPTION: Record<string, string> = {
  lotType: "lotType",
  street: "street",
  within100ftWideStreet: "within100ftWideStreet",
  program: "program",
  buildingType: "buildingType",
  siteCategory: "siteCategory",
};

function describe(rules: ExtRule[], district: string, ctx: RuleContext, assumptions: Assumption[]): string {
  const keys = new Set<string>();
  const widthLt = new Set<number>();
  const widthGte = new Set<number>();
  for (const r of rules) {
    Object.keys(r.when).forEach((k) => keys.add(k));
    if (r.when.lotWidthLt !== undefined) widthLt.add(r.when.lotWidthLt);
    if (r.when.lotWidthGte !== undefined) widthGte.add(r.when.lotWidthGte);
  }
  const parts: string[] = [district];
  if (keys.has("lotType") && ctx.lotType) {
    const raw = assumptions.find((a) => a.key === "lotType")?.provenance?.[0]?.rawValue;
    parts.push(`${ctx.lotType} lot${raw !== undefined && raw !== null ? ` (PLUTO lottype ${String(raw)})` : ""}`);
  }
  if (keys.has("street") && ctx.street) parts.push(`${ctx.street} street`);
  if (keys.has("within100ftWideStreet") && ctx.within100ftWideStreet !== undefined) {
    parts.push(ctx.within100ftWideStreet ? "within 100 ft of a wide street" : "not within 100 ft of a wide street");
  }
  if (keys.has("program") && ctx.program) parts.push(`${ctx.program.replace(/_/g, " ")} program`);
  if (keys.has("buildingType") && ctx.buildingType) parts.push(`${ctx.buildingType.replace(/_/g, " ")} building`);
  if (keys.has("siteCategory") && ctx.siteCategory) parts.push(`${ctx.siteCategory.replace(/_/g, " ")} site`);
  if (typeof ctx.lotWidth === "number") {
    for (const t of widthLt) parts.push(`lot width ${fmtNum(ctx.lotWidth)} ft < ${fmtNum(t)} ft`);
    for (const t of widthGte) parts.push(`lot width ${fmtNum(ctx.lotWidth)} ft ≥ ${fmtNum(t)} ft`);
  }
  return parts.join(" · ");
}

/**
 * Resolve one control value for a district from the rules table.
 * 0 matches -> needs_input; 1 (or identical values) -> cited; differing values -> needs_input + conflicting.
 */
export function resolveField(
  district: string | null,
  field: string,
  ctx: RuleContext,
  assumptions: Assumption[],
): PValue {
  const unit = fieldUnit(field);
  const d = district ? normDistrict(district) : "(no district)";
  const rules = district ? findRules(d, field, ctx) : [];
  if (rules.length === 0) {
    return needsInput(unit, `No rule in this prototype's rule set for ${d}/${field} under current assumptions`);
  }
  const citations = dedupeCitations(rules.map((r) => r.citation));
  const ruleIds = rules.map((r) => r.id);
  const values = uniq(rules.map((r) => r.value));
  if (values.length > 1) {
    return {
      value: null,
      unit,
      status: "needs_input",
      confidence: "conflicting",
      citations,
      ruleIds,
      note: `Conflicting rules for ${d}/${field}: ${rules.map((r) => `${r.id} = ${fmtNum(r.value)}`).join("; ")}`,
    };
  }
  const depKeys = uniq(
    rules.flatMap((r) => Object.keys(r.when)).map((k) => WHEN_TO_ASSUMPTION[k]).filter((k): k is string => !!k),
  );
  const deps = depKeys
    .map((k) => assumptions.find((a) => a.key === k && a.state !== "rejected"))
    .filter((a): a is Assumption => !!a);
  const notes = uniq(rules.map((r) => r.note).filter((n): n is string => !!n));
  const pv: PValue = {
    value: values[0],
    unit: rules[0].unit,
    status: "cited",
    confidence: deps.every((a) => a.confidence === "cited") ? "cited" : "inferred",
    citations,
    ruleIds,
    appliesBecause: describe(rules, d, ctx, assumptions),
    note: notes.length ? notes.join(" ") : null,
  };
  if (deps.length) pv.assumptionIds = deps.map((a) => a.id);
  return pv;
}
