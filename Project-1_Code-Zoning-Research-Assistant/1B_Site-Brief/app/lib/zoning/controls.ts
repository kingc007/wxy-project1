import type { Assumption, LotEdge, PValue } from "../types";
import type { BulkRow, Calculation, Controls, IntendedUse, RuleContext, SetbackPlane, SkyExposurePlane, StreetKind } from "./model";
import { coverageArea, maxFloorArea, rearStepSetback, sepPlane, streetSetbackPlane } from "./calc";
import { dedupeCitations, fieldUnit, fmtNum, notApplicable, needsInput, uniq } from "./pvalue";
import { resolveField } from "./resolve";
import {
  districtHasRules, isDistrictCovered, isManufacturingDistrict, normDistrict, overlayBulkCitation, residentialEquivalent,
} from "./rules";

export interface ControlsArgs {
  district: string | null;
  ctx: RuleContext;
  assumptions: Assumption[];
  edges: LotEdge[];
  primaryEdgeIndex: number | null;
  lotArea: PValue;
  intendedUse: IntendedUse;
  programs: string[];
  /** PLUTO / layer commercial overlay codes on the lot */
  overlays?: string[];
}

const NO_STORY_LIMIT = "ZR §23-432 sets heights, not a story limit";
const SEP_NA_NOTE = "ZR 23-731: applies to R6 through R10 Districts without a letter suffix";
const SEP_R6_NOTE =
  "Elective alternative (ZR 23-731); when elected, FAR per ZR 23-732 (not in rule set) supersedes 23-22";
const SEP_M1_NOTE = "Sky exposure plane per the M1 district rule (ZR 43-43)";

function fieldUnitOf(field: string): PValue["unit"] {
  return fieldUnit(field);
}

function edgeStreet(edge: LotEdge, primaryIndex: number | null, assumptions: Assumption[]): StreetKind | undefined {
  if (edge.index === primaryIndex) {
    const a = assumptions.find((x) => x.key === "street");
    if (a && (a.value === "wide" || a.value === "narrow")) return a.value;
    return undefined;
  }
  return edge.street?.wide === true ? "wide" : edge.street?.wide === false ? "narrow" : undefined;
}

function edgeAssumptions(assumptions: Assumption[], edge: LotEdge, primaryIndex: number | null, kind: StreetKind | undefined): Assumption[] {
  if (edge.index === primaryIndex) return assumptions;
  return assumptions.map((a) =>
    a.key === "street" ? { ...a, value: kind ?? "unknown", confidence: kind ? ("inferred" as const) : ("unverified" as const) } : a,
  );
}

export const M1_RESIDENTIAL_NOTE = "Residential use in M1 not covered by this prototype's rule set";

export function buildControls(args: ControlsArgs): { controls: Controls; calculations: Calculation[] } {
  const { district, ctx: baseCtx, assumptions, edges, primaryEdgeIndex, lotArea, intendedUse, programs } = args;
  const calculations: Calculation[] = [];
  const d = district ? normDistrict(district) : null;
  const isMfg = !!d && isManufacturingDistrict(d);
  const equiv = d ? residentialEquivalent(d) : null;
  // Residential-type bulk regulations come from the residence district: the equivalent (ZR 34-112) or the district itself.
  const resDistrict = equiv ? equiv.to : d;
  const overlayCodes = (args.overlays ?? []).map(normDistrict).filter((o) => overlayBulkCitation(o));
  const overlayCite = overlayCodes.length && !isMfg && !equiv ? overlayBulkCitation(overlayCodes[0]) : null;
  const ctx: RuleContext = { ...baseCtx, underlyingDistrict: resDistrict ?? undefined };

  /** residential-bulk resolver: applies equivalence / overlay provenance, and M1 -> needs_input */
  const r = (field: string, c: RuleContext = ctx, a: Assumption[] = assumptions): PValue => {
    if (isMfg) return needsInput(fieldUnitOf(field), M1_RESIDENTIAL_NOTE);
    const pv = resolveField(resDistrict, field, c, a);
    if (pv.status !== "cited") return pv;
    const out: PValue = { ...pv };
    if (equiv && d) {
      const label = `${d} → residential equivalent ${equiv.to} (ZR ${equiv.citation.section})`;
      out.appliesBecause = (pv.appliesBecause ?? "").replace(equiv.to, label);
      out.citations = dedupeCitations([...(pv.citations ?? []), equiv.citation]);
    } else if (overlayCite) {
      out.appliesBecause = `${pv.appliesBecause ?? ""} · commercial overlay ${overlayCodes[0]}: residential bulk of the underlying district (ZR ${overlayCite.section})`;
      out.citations = dedupeCitations([...(pv.citations ?? []), overlayCite]);
    }
    return out;
  };
  /** resolver against the lot's own (non-equivalent) district */
  const own = (field: string, c: RuleContext = ctx): PValue => resolveField(d, field, c, assumptions);

  // FAR + floor area
  const maxFar: Record<string, PValue> = { residential: r("maxFar.residential") };
  if (intendedUse === "community_facility" || intendedUse === "mixed") maxFar.community_facility = own("maxFar.community_facility");
  if (intendedUse === "commercial" || intendedUse === "mixed") {
    // overlay rule (underlying district) first, then the district's own commercial FAR
    let com: PValue | null = null;
    for (const o of overlayCodes) {
      const pv = resolveField(o, "maxFar.commercial", ctx, assumptions);
      if (pv.status === "cited") {
        com = { ...pv, appliesBecause: `${o} overlay · mapped within ${ctx.underlyingDistrict ?? "?"}` };
        break;
      }
    }
    maxFar.commercial = com ?? own("maxFar.commercial");
  }
  if (intendedUse === "manufacturing" || isMfg) maxFar.manufacturing = own("maxFar.manufacturing");
  if (programs.includes("qualifying_affordable")) maxFar.residential_qualifying_affordable = r("maxFar.residential_qualifying_affordable");
  if (programs.includes("qualifying_residential_site")) {
    maxFar.residential_qualifying_residential_site = r("maxFar.residential_qualifying_residential_site");
  }
  const maxFloor: Record<string, PValue> = {};
  for (const [k, far] of Object.entries(maxFar)) {
    maxFloor[k] = maxFloorArea(lotArea, far, { far: `controls.maxFar.${k}` });
    calculations.push({ id: `maxFloorArea.${k}`, label: `Max floor area (${k.replace(/_/g, " ")})`, pvalue: maxFloor[k] });
  }

  // Coverage
  const coverage =
    intendedUse === "community_facility" ? (isMfg ? own("lotCoverage.community_facility") : r("lotCoverage.community_facility")) : r("lotCoverage.max");
  calculations.push({ id: "coverageArea", label: "Max lot coverage area", pvalue: coverageArea(lotArea, coverage) });

  // Height
  const baseMin = r("baseHeight.min");
  const baseMax = r("baseHeight.max");
  const maxHeight = r("maxBuildingHeight");

  // Yards
  const rear = r("yards.rear");
  const yards = { front: r("yards.front"), rear, side: r("yards.side") };

  // Setbacks
  const setbacks: SetbackPlane[] = [];
  const rearAbove = r("yards.rearAbove75");
  const heightBreak = r("yards.rearHeightBreak");
  if (rearAbove.status !== "needs_input" && heightBreak.status !== "needs_input") {
    const rearEdges = edges.filter((e) => e.kind === "rear").map((e) => e.index);
    const plane = rearStepSetback({ rear, rearAbove75: rearAbove, heightBreak, edgeIndices: rearEdges });
    setbacks.push(plane);
    calculations.push({ id: "rearYardStep", label: "Rear yard step above height break", pvalue: plane.depth });
  } else if (rear.status === "cited" && heightBreak.status === "needs_input" && rearAbove.status === "needs_input") {
    calculations.push({
      id: "rearYardStep",
      label: "Rear yard step above height break",
      pvalue: notApplicable("ft", "No rear-yard height break rule applies under current assumptions; the rear yard is modelled as constant at every height (no rear setback plane)."),
    });
  } else {
    calculations.push({ id: "rearYardStep", label: "Rear yard step above height break", pvalue: needsInput("ft", rearAbove.note ?? heightBreak.note ?? "Rear yard step cannot be determined") });
  }
  const fronts = edges.filter((e) => e.kind === "front");
  for (const e of fronts) {
    const kind = edgeStreet(e, primaryEdgeIndex, assumptions);
    const ctxE: RuleContext = { ...ctx, street: kind };
    const depth = r("setback.depth", ctxE, edgeAssumptions(assumptions, e, primaryEdgeIndex, kind));
    setbacks.push(streetSetbackPlane({ edgeIndex: e.index, street: kind, baseMax, depth }));
  }

  // Sky exposure
  const sep = (field: string, c: RuleContext, a: Assumption[]): PValue => (isMfg ? resolveField(d, field, c, a) : r(field, c, a));
  let skyExposure: Controls["skyExposure"];
  const sepDistrict = isMfg ? d : resDistrict;
  if (!d || !isDistrictCovered(d)) {
    skyExposure = { status: "manual", note: "District not covered by this prototype's rule set; sky exposure plane not determined", planes: [] };
  } else if (sepDistrict && districtHasRules(sepDistrict, "sep.")) {
    const planes: SkyExposurePlane[] = fronts.map((e) => {
      const kind = edgeStreet(e, primaryEdgeIndex, assumptions);
      const ctxE: RuleContext = { ...ctx, street: kind };
      const ea = edgeAssumptions(assumptions, e, primaryEdgeIndex, kind);
      return sepPlane({
        edgeIndex: e.index,
        street: kind,
        initialSetback: sep("sep.initialSetback", ctxE, ea),
        startHeight: sep("sep.startHeight", ctxE, ea),
        slope: sep("sep.slope", ctxE, ea),
      });
    });
    const fw = sep("sep.frontWallMaxHeight", ctx, assumptions);
    calculations.push({ id: "sep.frontWallMaxHeight", label: "Sky exposure: max front wall height within initial setback", pvalue: fw });
    skyExposure = { status: "implemented", note: isMfg ? SEP_M1_NOTE : SEP_R6_NOTE, planes };
  } else {
    skyExposure = { status: "not_applicable", note: SEP_NA_NOTE, planes: [] };
  }

  const controls: Controls = {
    intendedUse,
    programs: uniq(programs),
    maxFar,
    maxFloorArea: maxFloor,
    baseHeight: { min: baseMin, max: baseMax },
    maxBuildingHeight: maxHeight,
    maxStories: notApplicable("stories", NO_STORY_LIMIT),
    setbacks,
    yards,
    lotCoverage: { max: coverage },
    skyExposure,
  };
  return { controls, calculations };
}

function ruleLabel(pv: PValue): string {
  if (pv.citations?.length) return uniq(pv.citations.map((c) => `ZR ${c.section}`)).join(", ");
  if (pv.status === "computed") return "computed";
  if (pv.status === "data") return "PLUTO";
  return "—";
}

const KIND_WORD: Record<string, string> = { wide_street_frontage: "wide", narrow_street_frontage: "narrow" };

/** Human label for a frontage plane: "Attorney Street (narrow)"; falls back to "Edge N". */
function frontageName(appliesTo: string, edgeIndices: number[] | undefined, edges: LotEdge[]): string {
  const i = edgeIndices?.[0];
  const e = i === undefined ? undefined : edges.find((x) => x.index === i);
  const name = e?.street?.name?.trim() || (i === undefined ? "street frontage" : `Edge ${i}`);
  const w = KIND_WORD[appliesTo];
  return w ? `${name} (${w})` : name;
}

export function bulkTable(c: Controls, calculations: Calculation[] = [], edges: LotEdge[] = []): BulkRow[] {
  const rows: BulkRow[] = [];
  const add = (label: string, value: PValue) => rows.push({ rule: ruleLabel(value), label, value });
  for (const [k, v] of Object.entries(c.maxFar)) add(`Max FAR (${k.replace(/_/g, " ")})`, v);
  for (const [k, v] of Object.entries(c.maxFloorArea)) add(`Max floor area (${k.replace(/_/g, " ")})`, v);
  add("Lot coverage (max)", c.lotCoverage.max);
  const cov = calculations.find((x) => x.id === "coverageArea");
  if (cov) add("Lot coverage area", cov.pvalue);
  add("Base height (min)", c.baseHeight.min);
  add("Base height (max)", c.baseHeight.max);
  add("Max building height", c.maxBuildingHeight);
  add("Front yard", c.yards.front);
  add("Rear yard", c.yards.rear);
  add("Side yard", c.yards.side);
  const counts = new Map<string, number>();
  const unique = (label: string, edgeIndices?: number[]) => {
    const n = (counts.get(label) ?? 0) + 1;
    counts.set(label, n);
    return n > 1 && edgeIndices?.length ? `${label} [edge ${edgeIndices[0]}]` : label;
  };
  for (const s of c.setbacks) {
    if (s.appliesTo === "rear") {
      const h = s.startHeight.value;
      add("Rear setback — start height", s.startHeight);
      add(h === null ? "Rear setback above the height break" : `Rear setback above ${fmtNum(h)} ft`, s.depth);
    } else if (s.id === "setbacks-manual-split") {
      add("Street setbacks (split lot) — start height", s.startHeight);
      add("Street setbacks (split lot) — depth", s.depth);
    } else {
      const base = unique(`Street setback — ${frontageName(s.appliesTo, s.edgeIndices, edges)}`, s.edgeIndices);
      add(`${base} — start height`, s.startHeight);
      add(`${base} — depth`, s.depth);
    }
  }
  for (const p of c.skyExposure.planes) {
    const base = unique(`Sky exposure plane — ${frontageName(p.appliesTo, p.edgeIndices, edges)}`, p.edgeIndices);
    add(`${base} — initial setback`, p.initialSetback);
    add(`${base} — start height`, p.startHeight);
    add(`${base} — slope`, p.slopeVerticalPerHorizontal);
  }
  const fw = calculations.find((x) => x.id === "sep.frontWallMaxHeight");
  if (fw) add("Sky exposure front wall max height", fw.pvalue);
  add("Max stories", c.maxStories);
  return rows;
}
