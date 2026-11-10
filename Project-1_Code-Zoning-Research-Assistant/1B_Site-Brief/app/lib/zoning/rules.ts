import { ruleFiles } from "./rules/index";
import type { Citation } from "../types";
import type { ExtRule, RuleContext, RuleWhenExt } from "./model";

const allRules: ExtRule[] = ruleFiles.flatMap((f) => f.rules);
const covered = new Set(ruleFiles.flatMap((f) => f.districtsCovered));

export function getAllRules(): ExtRule[] {
  return allRules;
}
export function districtsCovered(): string[] {
  return [...covered];
}
export function isDistrictCovered(code: string): boolean {
  return covered.has(normDistrict(code));
}
export function normDistrict(code: string): string {
  return code.trim().toUpperCase();
}

function asArray<T>(x: T | T[]): T[] {
  return Array.isArray(x) ? x : [x];
}

/** True when every condition in `when` is satisfied by the context. Unknown context values never match. */
export function whenMatches(when: RuleWhenExt, ctx: RuleContext): boolean {
  if (when.lotType !== undefined && (ctx.lotType === undefined || !when.lotType.includes(ctx.lotType))) return false;
  if (when.street !== undefined && ctx.street !== when.street) return false;
  if (when.within100ftWideStreet !== undefined && ctx.within100ftWideStreet !== when.within100ftWideStreet) return false;
  if (when.program !== undefined && ctx.program !== when.program) return false;
  if (when.siteCategory !== undefined && ctx.siteCategory !== when.siteCategory) return false;
  if (when.underlyingDistrict !== undefined) {
    if (ctx.underlyingDistrict === undefined || !when.underlyingDistrict.includes(ctx.underlyingDistrict)) return false;
  }
  if (when.buildingType !== undefined) {
    if (ctx.buildingType === undefined || !asArray(when.buildingType).includes(ctx.buildingType)) return false;
  }
  if (when.lotWidthLt !== undefined && !(typeof ctx.lotWidth === "number" && ctx.lotWidth < when.lotWidthLt)) return false;
  if (when.lotWidthGte !== undefined && !(typeof ctx.lotWidth === "number" && ctx.lotWidth >= when.lotWidthGte)) return false;
  return true;
}

export function findRules(district: string, field: string, ctx: RuleContext): ExtRule[] {
  const d = normDistrict(district);
  return allRules.filter((r) => r.field === field && r.districts.includes(d) && whenMatches(r.when, ctx));
}

/** True when the district has any rule whose field starts with `fieldPrefix`. */
export function districtHasRules(district: string, fieldPrefix: string): boolean {
  const d = normDistrict(district);
  return allRules.some((r) => r.districts.includes(d) && r.field.startsWith(fieldPrefix));
}

/** True when the rule set has any rule for this district code (e.g. a commercial overlay). */
export function districtHasAnyRule(code: string): boolean {
  const d = normDistrict(code);
  return allRules.some((r) => r.districts.includes(d));
}

export function residentialEquivalent(code: string): { to: string; citation: Citation } | null {
  const d = normDistrict(code);
  for (const f of ruleFiles) {
    const e = f.residentialEquivalents?.find((x) => normDistrict(x.district) === d);
    if (e) return { to: normDistrict(e.residentialEquivalent), citation: e.citation };
  }
  return null;
}

/** Citation for "residential bulk of the underlying Residence District applies" when `code` is a listed commercial overlay. */
export function overlayBulkCitation(code: string): Citation | null {
  const d = normDistrict(code);
  for (const f of ruleFiles) {
    if (f.commercialOverlays?.overlays.map(normDistrict).includes(d)) return f.commercialOverlays.citation;
  }
  return null;
}

export function splitLotRules(): { farCitation: Citation; heightSetbackCitation: Citation | null } | null {
  for (const f of ruleFiles) {
    if (f.splitLot) return { farCitation: f.splitLot.citation, heightSetbackCitation: f.splitLot.heightSetback?.citation ?? null };
  }
  return null;
}

export function isManufacturingDistrict(code: string): boolean {
  return /^M\d/.test(normDistrict(code)) && isDistrictCovered(code);
}
