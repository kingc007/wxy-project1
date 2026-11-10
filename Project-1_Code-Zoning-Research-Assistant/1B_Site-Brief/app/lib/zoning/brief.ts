import type { Citation, PValue, SiteData } from "../types";
import type {
  BriefInput, Calculation, Controls, SetbackPlane, SplitPortion, ZoningBrief,
} from "./model";
import {
  assumptionContext, deriveAssumptions, effectivePrograms, effectiveUse,
} from "./assumptions";
import { areaShare, maxFloorArea } from "./calc";
import { bulkTable, buildControls } from "./controls";
import { buildEnvelope, validateEnvelope } from "./envelope";
import { computeFlags } from "./flags";
import { buildLocalGeometry } from "./geometry";
import { dedupeCitations, manualValue, needsInput, fmtNum, fmtFar, uniq } from "./pvalue";
import { splitLotRules } from "./rules";
import {
  PLUTO_KEYS, basePortions, isSplitLot, plutoValue, primaryDistrict, primaryFrontEdge,
} from "./site-helpers";

function sameValue(a: PValue, b: PValue): boolean {
  return a.value === b.value && a.status === b.status;
}

function show(pv: PValue): string {
  return pv.value === null ? pv.status.replace(/_/g, " ") : `${fmtNum(pv.value)} ${pv.unit}`;
}

/** Merge one value across split-lot portions: identical -> kept (citations unioned); otherwise status "manual". */
export function mergePValues(pvs: PValue[], labels: string[]): PValue {
  const first = pvs[0];
  if (pvs.every((p) => sameValue(p, first))) {
    if (first.value === null) return first;
    return {
      ...first,
      citations: dedupeCitations(pvs.flatMap((p) => p.citations ?? [])),
      ruleIds: uniq(pvs.flatMap((p) => p.ruleIds ?? [])),
      assumptionIds: uniq(pvs.flatMap((p) => p.assumptionIds ?? [])).length ? uniq(pvs.flatMap((p) => p.assumptionIds ?? [])) : undefined,
    };
  }
  return manualValue(
    first.unit,
    `Differs between split-lot portions (${pvs.map((p, i) => `${labels[i]}: ${show(p)}`).join("; ")}); requires professional analysis.`,
  );
}

function mergeRecords(recs: Record<string, PValue>[], labels: string[], unit: PValue["unit"]): Record<string, PValue> {
  const keys = uniq(recs.flatMap((r) => Object.keys(r)));
  const out: Record<string, PValue> = {};
  for (const k of keys) {
    out[k] = mergePValues(recs.map((r) => r[k] ?? needsInput(unit, `No ${k} value for this portion`)), labels);
  }
  return out;
}

function planeSig(s: SetbackPlane): string {
  return JSON.stringify([s.id, s.appliesTo, s.edgeIndices, s.startHeight.value, s.depth.value, s.startHeight.status, s.depth.status]);
}

export function mergeControls(list: Controls[], labels: string[]): Controls {
  const f = list[0];
  const m = (sel: (c: Controls) => PValue) => mergePValues(list.map(sel), labels);
  const setbackSame = list.every((c) => c.setbacks.map(planeSig).join("|") === f.setbacks.map(planeSig).join("|"));
  const skySig = (c: Controls) => JSON.stringify([c.skyExposure.status, c.skyExposure.planes.map((p) => [p.id, p.startHeight.value, p.initialSetback.value, p.slopeVerticalPerHorizontal.value])]);
  const skySame = list.every((c) => skySig(c) === skySig(f));
  const setbacks: SetbackPlane[] = setbackSame
    ? f.setbacks
    : [{
        id: "setbacks-manual-split",
        appliesTo: "street_frontage",
        startHeight: manualValue("ft", "Setbacks differ between split-lot portions; requires professional analysis."),
        depth: manualValue("ft", "Setbacks differ between split-lot portions; requires professional analysis."),
      }];
  return {
    intendedUse: f.intendedUse,
    programs: f.programs,
    maxFar: mergeRecords(list.map((c) => c.maxFar), labels, "ratio"),
    maxFloorArea: mergeRecords(list.map((c) => c.maxFloorArea), labels, "sf"),
    baseHeight: { min: m((c) => c.baseHeight.min), max: m((c) => c.baseHeight.max) },
    maxBuildingHeight: m((c) => c.maxBuildingHeight),
    maxStories: f.maxStories,
    setbacks,
    yards: { front: m((c) => c.yards.front), rear: m((c) => c.yards.rear), side: m((c) => c.yards.side) },
    lotCoverage: { max: m((c) => c.lotCoverage.max) },
    skyExposure: skySame
      ? f.skyExposure
      : { status: "manual", note: "Sky exposure rules differ between split-lot portions; requires professional analysis.", planes: [] },
  };
}

function mergeCalcs(lists: Calculation[][], labels: string[]): Calculation[] {
  return lists[0].map((c, i) => ({
    id: c.id,
    label: c.label,
    pvalue: mergePValues(lists.map((l) => l[i]?.pvalue ?? needsInput(c.pvalue.unit, "Not computed for this portion")), labels),
  }));
}

function fmtFarResult(v: number): string {
  return Math.abs(v * 100 - Math.round(v * 100)) < 1e-9 ? v.toFixed(2) : v.toFixed(4);
}

function withCitation(pv: PValue, c: Citation | undefined): PValue {
  return c ? { ...pv, citations: dedupeCitations([...(pv.citations ?? []), c]) } : pv;
}

/**
 * Split-lot rules (shared/rules splitLot): FAR area-weighted by portion share (ZR 77-22) when every portion has a
 * known FAR; height and setbacks are pro-rated by street frontage (ZR 77-28) and therefore left manual.
 */
function applySplitRules(
  controls: Controls,
  calculations: Calculation[],
  shares: (number | null)[],
  portionControls: Controls[],
  lotArea: PValue,
): void {
  const rules = splitLotRules();
  const sumOk = shares.every((s) => s !== null) && Math.abs((shares as number[]).reduce((a, b) => a + b, 0) - 1) <= 0.02;
  if (rules) {
    for (const key of Object.keys(controls.maxFar)) {
      const fars = portionControls.map((c) => c.maxFar[key]);
      if (!sumOk || fars.some((f) => !f || f.value === null)) continue;
      const terms = fars.map((f, i) => ({ far: f.value as number, share: shares[i] as number }));
      const total = Math.round(terms.reduce((a, t) => a + t.far * t.share, 0) * 1e4) / 1e4;
      const far: PValue = {
        value: total,
        unit: "ratio",
        status: "computed",
        confidence: "inferred",
        formula: `${terms.map((t) => `${fmtNum(t.share, 4)} × ${fmtFar(t.far)}`).join(" + ")} = ${fmtFarResult(total)}`,
        inputs: terms.flatMap((_, i) => [`splitLot.portions[${i}].controls.maxFar.${key}`, `splitLot.portions[${i}].share`]),
        citations: [rules.farCitation],
        note: "Adjusted maximum FAR for a zoning lot in more than one district (area-weighted by portion share).",
      };
      controls.maxFar[key] = far;
      controls.maxFloorArea[key] = maxFloorArea(lotArea, far, { far: `controls.maxFar.${key}` });
      const i = calculations.findIndex((c) => c.id === `maxFloorArea.${key}`);
      if (i >= 0) calculations[i] = { ...calculations[i], pvalue: controls.maxFloorArea[key] };
    }
  }
  const hs = rules?.heightSetbackCitation ?? undefined;
  const note = "Height and setback on split lots are pro-rated by street frontage (ZR 77-28); not modelled.";
  const man = (u: PValue["unit"]) => withCitation(manualValue(u, note), hs);
  controls.baseHeight = { min: man("ft"), max: man("ft") };
  controls.maxBuildingHeight = man("ft");
  controls.setbacks = [{ id: "setbacks-manual-split", appliesTo: "street_frontage", startHeight: man("ft"), depth: man("ft") }];
  controls.skyExposure = { status: "manual", note, planes: [] };
}

export function computeBrief(site: SiteData, input: BriefInput): ZoningBrief {
  const now = input.now ?? new Date().toISOString();
  const geometry = site.geometry ? buildLocalGeometry(site.geometry.ring2263, site.edges) : null;
  const edges = geometry?.edges ?? site.edges;
  const primaryEdgeIndex = primaryFrontEdge(edges)?.index ?? null;

  const assumptions = deriveAssumptions(site, input, edges);
  const flags = computeFlags(site, edges);
  const use = effectiveUse(assumptions);
  const programs = effectivePrograms(assumptions, input.programs);

  const p = site.pluto;
  const lot = {
    area: plutoValue(p, p?.lotArea, "sf", PLUTO_KEYS.lotArea, "lot area"),
    frontage: plutoValue(p, p?.lotFront, "ft", PLUTO_KEYS.lotFront, "lot frontage"),
    depth: plutoValue(p, p?.lotDepth, "ft", PLUTO_KEYS.lotDepth, "lot depth"),
  };
  const ctx = assumptionContext(assumptions, lot.frontage.value);

  const portionsRaw = basePortions(site);
  const isSplit = isSplitLot(site) && portionsRaw.length > 1;
  const overlays = uniq([...(p?.overlays ?? []), ...site.districts.filter((d) => d.kind === "commercial_overlay").map((d) => d.code)]);
  const common = { ctx, assumptions, edges, primaryEdgeIndex, intendedUse: use, programs, overlays };

  let controls: Controls;
  let calculations: Calculation[];
  const portions: SplitPortion[] = [];
  if (isSplit) {
    const built = portionsRaw.map((pt) =>
      buildControls({ ...common, district: pt.code, lotArea: areaShare(lot.area, pt.share) }),
    );
    built.forEach((b, i) =>
      portions.push({ districtCodes: [portionsRaw[i].code], share: portionsRaw[i].share, controls: b.controls, calculations: b.calculations }),
    );
    const labels = portionsRaw.map((x) => x.code);
    controls = mergeControls(built.map((b) => b.controls), labels);
    calculations = mergeCalcs(built.map((b) => b.calculations), labels);
    applySplitRules(controls, calculations, portionsRaw.map((x) => x.share), built.map((b) => b.controls), lot.area);
  } else {
    const b = buildControls({ ...common, district: primaryDistrict(site), lotArea: lot.area });
    controls = b.controls;
    calculations = b.calculations;
  }

  // Manager rule: on special-district lots the underlying-district values may be modified by the special district,
  // which this prototype does not model. Keep the values (they are cited) but demote confidence to "inferred".
  if ((p?.specialDistricts.length ?? 0) > 0) {
    const sd = p!.specialDistricts.join(", ");
    const demote = (v: unknown): void => {
      if (!v || typeof v !== "object") return;
      if (Array.isArray(v)) { v.forEach(demote); return; }
      const o = v as Record<string, unknown>;
      if ("status" in o && "confidence" in o && "unit" in o) {
        if ((o.status === "cited" || o.status === "computed") && o.confidence === "cited") {
          o.confidence = "inferred";
          o.note = [o.note, `Underlying-district value; special district ${sd} may modify it (not modelled).`].filter(Boolean).join(" ");
        }
        return;
      }
      Object.values(o).forEach(demote);
    };
    demote(controls);
    demote(calculations);
  }

  const envelope = buildEnvelope({
    site, geometry, edges, primaryEdgeIndex, lot, assumptions, flags, controls,
    split: { isSplit, portions }, now, sample: input.sample ?? false, verifiedBy: input.verifiedBy,
  });
  return {
    assumptions,
    flags,
    controls,
    calculations,
    bulkTable: bulkTable(controls, calculations, edges),
    splitLot: { isSplit, ...(isSplit ? { farMethod: "area_weighted" as const } : {}), portions },
    envelope,
    validation: validateEnvelope(envelope),
  };
}
