// Inputs for the narrative: which ZR sections the brief cites, and the plain-text summary of computed values.
import type { Citation, PValue, SiteData } from "@/lib/types";
import type { ZoningBrief } from "@/lib/zoning/model";

function walk(x: unknown, fn: (o: Record<string, unknown>) => void, depth = 0): void {
  if (!x || typeof x !== "object" || depth > 12) return;
  if (Array.isArray(x)) { x.forEach((v) => walk(v, fn, depth + 1)); return; }
  const o = x as Record<string, unknown>;
  fn(o);
  for (const v of Object.values(o)) walk(v, fn, depth + 1);
}

/** Section ids cited anywhere in the brief (controls, calculations, flags, assumptions), most-cited first, max `limit`. */
export function citedSectionIds(brief: ZoningBrief, limit = 12): string[] {
  const counts = new Map<string, number>();
  const add = (cs: unknown) => {
    if (!Array.isArray(cs)) return;
    for (const c of cs as Citation[]) if (c && typeof c.section === "string") counts.set(c.section, (counts.get(c.section) ?? 0) + 1);
  };
  walk([brief.controls, brief.calculations, brief.flags, brief.assumptions], (o) => add(o.citations));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([id]) => id);
}

const pvLine = (label: string, p: PValue) => ({
  label, value: p.value, unit: p.unit, status: p.status, confidence: p.confidence,
  sections: [...new Set((p.citations ?? []).map((c) => c.section))],
});

export function computedSummary(brief: ZoningBrief, site: SiteData) {
  const c = brief.controls;
  const p = site.pluto;
  return {
    note: "Computed by deterministic code. Do not state any number that is not present here.",
    bbl: site.geocode?.bbl ?? p?.bbl ?? null,
    address: site.geocode?.label ?? p?.address ?? null,
    districts: site.districts.map((d) => d.code),
    lot: { lotAreaSf: p?.lotArea ?? null, frontageFt: p?.lotFront ?? null, depthFt: p?.lotDepth ?? null },
    intendedUse: c.intendedUse,
    programs: c.programs,
    splitLot: brief.splitLot.isSplit,
    maxFar: Object.entries(c.maxFar).map(([k, v]) => pvLine(`maxFar.${k}`, v)),
    maxFloorArea: Object.entries(c.maxFloorArea).map(([k, v]) => ({ ...pvLine(`maxFloorArea.${k}`, v), formula: v.formula ?? null })),
    baseHeightMin: pvLine("baseHeight.min", c.baseHeight.min),
    baseHeightMax: pvLine("baseHeight.max", c.baseHeight.max),
    maxBuildingHeight: pvLine("maxBuildingHeight", c.maxBuildingHeight),
    yards: { front: pvLine("yards.front", c.yards.front), rear: pvLine("yards.rear", c.yards.rear), side: pvLine("yards.side", c.yards.side) },
    lotCoverage: pvLine("lotCoverage.max", c.lotCoverage.max),
    assumptions: brief.assumptions.map((a) => a.statement),
    flags: brief.flags.map((f) => ({ kind: f.kind, message: f.message })),
  };
}
