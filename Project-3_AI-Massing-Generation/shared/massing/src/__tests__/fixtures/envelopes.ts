// TEST FIXTURES ONLY. Every value below is an arbitrary test number chosen to make geometry easy to check.
// None of them is a zoning fact. All envelopes are flagged "sample": true and use ids starting "test-fixture-".

type Edge = { index: number; kind: "front" | "side" | "rear" | "unknown"; street?: { name: null; width: "wide" | "narrow" | "unknown" } | null };

const cite = [{ source: "TEST FIXTURE", section: "n/a", url: null, quote: "arbitrary test number, not a zoning fact" }];

export function pv(value: number | null, unit: string, status = "cited"): Record<string, unknown> {
  if (value === null) return { value: null, unit, status, confidence: "unverified" };
  return { value, unit, status, confidence: "cited", citations: cite };
}

function envelope(id: string, polygonLocal: [number, number][], edges: Edge[], controls: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  // structuredClone: tests mutate the returned JSON, so nothing may be shared between calls
  return structuredClone({
    schemaVersion: "1.0.0",
    envelopeId: id,
    generatedAt: "2026-01-01T00:00:00Z",
    flags: { draft: true, sample: true, simplified: true, simplifications: ["TEST FIXTURE: arbitrary values"] },
    lot: { crs: { reference: "TEST", lengthUnit: "ft" }, origin: { x: 0, y: 0 }, polygonLocal, area: { value: null, unit: "sf", status: "needs_input", confidence: "unverified" }, lotType: { value: null, status: "needs_input" }, edges, ...extra },
    controls,
  });
}

export interface SquareOpts {
  maxHeight?: number | null;
  rearYard?: number;
  setback?: { start: number; depth: number } | null;
  sep?: { start: number; slope: number; initial: number | null } | null;
  maxFar?: number;
}

const squareEdges: Edge[] = [
  { index: 0, kind: "front", street: { name: null, width: "wide" } },
  { index: 1, kind: "side" },
  { index: 2, kind: "rear" },
  { index: 3, kind: "side" },
];

/** 100 x 100 ft interior lot, front edge on y = 0. */
export function squareLot(o: SquareOpts = {}) {
  const sb = o.setback === undefined ? { start: 60, depth: 15 } : o.setback;
  return envelope("test-fixture-square", [[0, 0], [100, 0], [100, 100], [0, 100]], squareEdges, {
    maxFar: { residential: pv(o.maxFar ?? 4.0, "ratio") },
    maxFloorArea: {},
    baseHeight: { min: pv(null, "ft", "needs_input"), max: pv(null, "ft", "needs_input") },
    maxBuildingHeight: o.maxHeight === null ? pv(null, "ft", "needs_input") : pv(o.maxHeight ?? 100, "ft"),
    maxStories: pv(null, "stories", "manual"),
    setbacks: sb ? [{ id: "sb-front", appliesTo: "street_frontage", startHeight: pv(sb.start, "ft"), depth: pv(sb.depth, "ft") }] : [],
    yards: { front: pv(0, "ft"), rear: pv(o.rearYard ?? 30, "ft"), side: pv(0, "ft") },
    lotCoverage: { max: pv(80, "percent") },
    skyExposure: o.sep
      ? {
          status: "implemented",
          planes: [
            {
              id: "sep-front",
              appliesTo: "street_frontage",
              startHeight: pv(o.sep.start, "ft"),
              slopeVerticalPerHorizontal: pv(o.sep.slope, "ratio"),
              ...(o.sep.initial !== null ? { initialSetback: pv(o.sep.initial, "ft") } : {}),
            },
          ],
        }
      : { status: "not_applicable", note: "TEST FIXTURE: no sky exposure plane on this lot" },
  });
}

/** Square lot with a sky exposure plane (start 40 ft, slope 2, initial setback 5) and no setback/rear yard. */
export function squareLotWithSep() {
  return squareLot({ setback: null, rearYard: 0, maxHeight: 200, sep: { start: 40, slope: 2, initial: 5 } });
}

/** L-shaped (concave) lot, area 7500 sf. Front edge 0 (bottom), rear edges 2 and 4, rear yard 10. */
export function lShapedLot(frontEdge: 0 | 5 = 0) {
  const kinds: Edge["kind"][] = ["front", "side", "rear", "side", "rear", "side"];
  const edges: Edge[] = kinds.map((kind, i) => ({ index: i, kind: i === frontEdge ? "front" : i === 0 || i === 5 ? "side" : kind, ...(i === frontEdge ? { street: { name: null, width: "narrow" as const } } : {}) }));
  return envelope("test-fixture-lshape", [[0, 0], [100, 0], [100, 50], [50, 50], [50, 100], [0, 100]], edges, {
    maxFar: { residential: pv(4.0, "ratio") },
    maxFloorArea: {},
    baseHeight: { min: pv(null, "ft", "needs_input"), max: pv(null, "ft", "needs_input") },
    maxBuildingHeight: pv(200, "ft"),
    setbacks: [],
    yards: { front: pv(0, "ft"), rear: pv(10, "ft"), side: pv(0, "ft") },
    lotCoverage: { max: pv(100, "percent") },
    skyExposure: { status: "not_applicable" },
  });
}
