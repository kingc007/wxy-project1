// Pure calculation functions. All arithmetic for derived values lives here; inputs are PValues so
// provenance/null-propagation is handled uniformly.
import type { PValue, Unit } from "../types";
import type { SetbackPlane, SkyExposurePlane, StreetKind } from "./model";
import { cloneRef, combineConfidence, fmtFar, fmtNum, needsInput, round2, uniq } from "./pvalue";

function computed(
  unit: Unit,
  inputs: { pv: PValue; path: string; name: string }[],
  fn: (vals: number[]) => { value: number; formula: string },
  note?: string,
): PValue {
  const missing = inputs.filter((i) => i.pv.value === null).map((i) => i.name);
  if (missing.length) {
    return needsInput(unit, `Missing input: ${missing.join(", ")}`, {
      inputs: inputs.map((i) => i.path),
    });
  }
  const { value, formula } = fn(inputs.map((i) => i.pv.value as number));
  const assumptionIds = uniq(inputs.flatMap((i) => i.pv.assumptionIds ?? []));
  const out: PValue = {
    value,
    unit,
    status: "computed",
    confidence: combineConfidence(inputs.map((i) => i.pv.confidence)),
    formula,
    inputs: inputs.map((i) => i.path),
    note: note ?? null,
  };
  if (assumptionIds.length) out.assumptionIds = assumptionIds;
  return out;
}

export function maxFloorArea(
  lotArea: PValue,
  far: PValue,
  paths: { lotArea?: string; far?: string } = {},
): PValue {
  return computed(
    "sf",
    [
      { pv: lotArea, path: paths.lotArea ?? "lot.area", name: "lot area" },
      { pv: far, path: paths.far ?? "controls.maxFar.residential", name: "FAR" },
    ],
    ([a, f]) => {
      const v = round2(a * f);
      return { value: v, formula: `${fmtNum(a)} sf × ${fmtFar(f)} FAR = ${fmtNum(v)} sf` };
    },
  );
}

export function coverageArea(
  lotArea: PValue,
  coveragePct: PValue,
  paths: { lotArea?: string; coverage?: string } = {},
): PValue {
  return computed(
    "sf",
    [
      { pv: lotArea, path: paths.lotArea ?? "lot.area", name: "lot area" },
      { pv: coveragePct, path: paths.coverage ?? "controls.lotCoverage.max", name: "lot coverage" },
    ],
    ([a, c]) => {
      const v = round2((a * c) / 100);
      return { value: v, formula: `${fmtNum(a)} sf × ${fmtNum(c)}% = ${fmtNum(v)} sf` };
    },
  );
}

/** Portion of a lot area: lot area × share (share is a fraction 0..1 computed in code upstream). */
export function areaShare(lotArea: PValue, share: number | null, path = "lot.area"): PValue {
  if (share === null) return needsInput("sf", "Missing input: portion share", { inputs: [path] });
  return computed(
    "sf",
    [{ pv: lotArea, path, name: "lot area" }],
    ([a]) => {
      const v = round2(a * share);
      return { value: v, formula: `${fmtNum(a)} sf × ${fmtNum(share * 100)}% = ${fmtNum(v)} sf` };
    },
  );
}

export function planeApplies(street: StreetKind | undefined): "wide_street_frontage" | "narrow_street_frontage" | "street_frontage" {
  return street === "wide" ? "wide_street_frontage" : street === "narrow" ? "narrow_street_frontage" : "street_frontage";
}

/** Rear yard step: required extra setback above the height break = rearAbove75 − rear. */
export function rearStepSetback(args: {
  rear: PValue;
  rearAbove75: PValue;
  heightBreak: PValue;
  edgeIndices?: number[];
}): SetbackPlane {
  const depth = computed(
    "ft",
    [
      { pv: args.rearAbove75, path: "rules.yards.rearAbove75", name: "rear yard above height break" },
      { pv: args.rear, path: "controls.yards.rear", name: "rear yard" },
    ],
    ([above, rear]) => ({
      value: round2(above - rear),
      formula: `${fmtNum(above)} ft − ${fmtNum(rear)} ft = ${fmtNum(round2(above - rear))} ft`,
    }),
  );
  const plane: SetbackPlane = {
    id: "rear-step",
    appliesTo: "rear",
    startHeight: cloneRef(args.heightBreak, "Rear yard step modelled as a setback plane starting at the height break."),
    depth,
  };
  if (args.edgeIndices?.length) plane.edgeIndices = args.edgeIndices;
  return plane;
}

export const BASE_HEIGHT_SETBACK_NOTE =
  "Modelled at the maximum base height; the text allows the setback at a height not lower than the minimum base height or higher than the maximum base height.";

/** Street setback plane for one front edge: depth by that edge's street width, starting at max base height. */
export function streetSetbackPlane(args: {
  edgeIndex: number;
  street: StreetKind | undefined;
  baseMax: PValue;
  depth: PValue;
}): SetbackPlane {
  return {
    id: `street-setback-edge${args.edgeIndex}`,
    appliesTo: planeApplies(args.street),
    edgeIndices: [args.edgeIndex],
    startHeight: cloneRef(args.baseMax, BASE_HEIGHT_SETBACK_NOTE),
    depth: args.depth,
  };
}

/** Sky exposure plane (R6 elective alternative) for one front edge. */
export function sepPlane(args: {
  edgeIndex: number;
  street: StreetKind | undefined;
  initialSetback: PValue;
  startHeight: PValue;
  slope: PValue;
}): SkyExposurePlane {
  return {
    id: `sep-edge${args.edgeIndex}`,
    appliesTo: planeApplies(args.street),
    edgeIndices: [args.edgeIndex],
    startHeight: args.startHeight,
    initialSetback: args.initialSetback,
    slopeVerticalPerHorizontal: args.slope,
  };
}
