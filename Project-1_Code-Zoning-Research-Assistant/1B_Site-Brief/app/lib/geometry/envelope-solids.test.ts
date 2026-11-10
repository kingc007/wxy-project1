import { describe, expect, it } from "vitest";
import type { EnvelopeLike } from "./envelope-input";
import { buildEnvelopeSolids, NO_HEIGHTS_EMPTY_MESSAGE, SPLIT_LOT_EMPTY_MESSAGE } from "./envelope-solids";
import { polygonArea } from "./polygon";

// SAMPLE geometry: 25 x 100 ft rectangle, edge 0 = front (narrow street). Not a real lot.
const v = (value: number | null) => ({ value, unit: "ft" });
function sample(over: Partial<EnvelopeLike["controls"]> = {}): EnvelopeLike {
  return {
    lot: {
      polygonLocal: [[0, 0], [25, 0], [25, 100], [0, 100]],
      edges: [
        { index: 0, kind: "front", street: { width: "narrow" } },
        { index: 1, kind: "side" },
        { index: 2, kind: "rear" },
        { index: 3, kind: "side" },
      ],
    },
    controls: {
      baseHeight: { min: v(40), max: v(75) },
      maxBuildingHeight: v(85),
      setbacks: [{ id: "street-setback", appliesTo: "narrow_street_frontage", startHeight: v(75), depth: v(15) }],
      yards: { front: v(null), rear: v(30), side: v(null) },
      skyExposure: { status: "not_applicable" },
      ...over,
    },
  };
}

describe("buildEnvelopeSolids (SAMPLE)", () => {
  it("builds base and upper volumes and lists unset yards", () => {
    const s = buildEnvelopeSolids(sample());
    expect(s.stages).toHaveLength(2);
    expect(s.stages[0]).toMatchObject({ z0: 0, z1: 75 });
    expect(polygonArea(s.stages[0].footprint)).toBeCloseTo(25 * 70, 6);
    expect(s.stages[1]).toMatchObject({ z0: 75, z1: 85 });
    expect(polygonArea(s.stages[1].footprint)).toBeCloseTo(25 * 55, 6);
    expect(s.notDrawn).toEqual(["Front yard", "Side yard"]);
    expect(s.manualGeometry).toBeNull();
  });

  it("does not draw controls with null values", () => {
    const s = buildEnvelopeSolids(sample({
      maxBuildingHeight: v(null),
      setbacks: [{ id: "x", appliesTo: "narrow_street_frontage", startHeight: v(75), depth: v(null) }],
    }));
    expect(s.notDrawn).toContain("Max building height");
    expect(s.notDrawn).toContain("Setback x depth");
    expect(s.stages).toHaveLength(1);
    expect(s.stages[0].z1).toBe(75);
  });

  it("draws nothing when both heights are null", () => {
    const s = buildEnvelopeSolids(sample({ baseHeight: { min: v(null), max: v(null) }, maxBuildingHeight: v(null) }));
    expect(s.stages).toHaveLength(0);
  });

  it("flags manual geometry for non-convex lots", () => {
    const e = sample();
    e.lot.polygonLocal = [[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]];
    e.lot.edges = e.lot.polygonLocal.map((_, index) => ({ index, kind: index === 4 ? "rear" : "side" }));
    const s = buildEnvelopeSolids(e);
    expect(s.manualGeometry).not.toBeNull();
    expect(s.stages).toHaveLength(0);
  });

  it("builds a SIMPLIFIED sky exposure plane clipped to lot depth", () => {
    const s = buildEnvelopeSolids(sample({
      skyExposure: {
        status: "implemented",
        planes: [{ id: "sep", appliesTo: "narrow_street_frontage", startHeight: v(60), initialSetback: v(10), slopeVerticalPerHorizontal: v(2) }],
      },
    }));
    expect(s.skyPlanes).toHaveLength(1);
    const [a, , c] = s.skyPlanes[0].corners;
    expect(a).toEqual([0, 10, 60]);
    // reaches top 85 ft at t = 10 + 25/2 = 22.5 ft in
    expect(c[1]).toBeCloseTo(22.5, 6);
    expect(c[2]).toBeCloseTo(85, 6);
  });

  it("skips sky exposure with manual status and notes it", () => {
    const s = buildEnvelopeSolids(sample({ skyExposure: { status: "manual" } }));
    expect(s.skyPlanes).toHaveLength(0);
    expect(s.notDrawn.some((m) => m.startsWith("Sky exposure plane"))).toBe(true);
  });
});

describe("buildEnvelopeSolids with split lot sides (SAMPLE)", () => {
  // SAMPLE: 25 x 100 ft rectangle; east side (kind side) is three segments, tiny kinks.
  function split(): EnvelopeLike {
    const e = sample();
    e.lot.polygonLocal = [[0, 0], [25, 0], [25.004, 50.99], [24.996, 77.83], [25, 100], [0, 100]];
    e.lot.edges = [
      { index: 0, kind: "front", street: { width: "narrow" } },
      { index: 1, kind: "side" }, { index: 2, kind: "side" }, { index: 3, kind: "side" },
      { index: 4, kind: "rear" }, { index: 5, kind: "side" },
    ];
    return e;
  }
  it("renders the split rectangle instead of falling back to manual geometry", () => {
    const s = buildEnvelopeSolids(split());
    expect(s.manualGeometry).toBeNull();
    expect(s.stages).toHaveLength(2);
    expect(s.lot).toHaveLength(4);
    expect(polygonArea(s.stages[0].footprint)).toBeCloseTo(25 * 70, 0);
    expect(polygonArea(s.stages[1].footprint)).toBeCloseTo(25 * 55, 0);
  });
  it("remaps explicit edgeIndices onto merged edges", () => {
    const e = split();
    e.controls.setbacks = [{ id: "sb", appliesTo: "street_frontage", edgeIndices: [4], startHeight: v(75), depth: v(10) }];
    e.controls.yards = { front: v(null), rear: v(null), side: v(null) };
    const s = buildEnvelopeSolids(e);
    // original edge 4 is the rear edge: after merging it must still be the rear edge
    expect(polygonArea(s.stages[1].footprint)).toBeCloseTo(25 * 90, 0);
  });
  it("still reports manual geometry for a genuinely concave lot", () => {
    const e = sample();
    e.lot.polygonLocal = [[0, 0], [25, 0], [25, 40], [20, 40], [20, 60], [25, 60], [25, 100], [0, 100]];
    e.lot.edges = e.lot.polygonLocal.map((_, index) => ({ index, kind: index === 0 ? "front" : index === 6 ? "rear" : "side" }));
    expect(buildEnvelopeSolids(e).manualGeometry).not.toBeNull();
  });
});

describe("empty-state message (SAMPLE)", () => {
  const noHeights = { baseHeight: { min: v(null), max: v(null) }, maxBuildingHeight: v(null) };
  it("uses the split-lot message when splitLot.isSplit is true", () => {
    const e = { ...sample(noHeights), splitLot: { isSplit: true } };
    const s = buildEnvelopeSolids(e);
    expect(s.stages).toHaveLength(0);
    expect(s.emptyMessage).toBe(SPLIT_LOT_EMPTY_MESSAGE);
    expect(s.emptyMessage).toContain("ZR 77-28");
  });
  it("uses the generic message otherwise, and none when volumes are drawn", () => {
    expect(buildEnvelopeSolids(sample(noHeights)).emptyMessage).toBe(NO_HEIGHTS_EMPTY_MESSAGE);
    expect(buildEnvelopeSolids({ ...sample(noHeights), splitLot: { isSplit: false } }).emptyMessage).toBe(NO_HEIGHTS_EMPTY_MESSAGE);
    expect(buildEnvelopeSolids(sample()).emptyMessage).toBeNull();
  });
});
