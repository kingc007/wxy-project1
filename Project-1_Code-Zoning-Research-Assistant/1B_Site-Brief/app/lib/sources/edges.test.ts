import { describe, expect, it } from "vitest";
import type { Ring } from "@/lib/types";
import { classifyEdges, lotEdges } from "./edges";
import { normalizeRing } from "./geom";
import { parseStreetWidth, type StreetHit } from "./streets";
import { intersectionArea } from "./geom";

// SAMPLE geometry: a 25 x 100 ft rectangle with its short south edge on a street at y=0.
const lot: Ring = [[0, 0], [25, 0], [25, 100], [0, 100], [0, 0]]; // CCW, closed
const street = (d: number, dir: [number, number] = [1, 0]): StreetHit => ({
  name: "SAMPLE ST", widthRaw: "60", widthFt: 60, wide: false, distanceFt: d, direction: dir,
  provenance: { dataset: "SAMPLE", version: null, field: null, url: null, fetchedAt: "2026-01-01T00:00:00Z" },
});
const left: Ring = [[-25, 0], [0, 0], [0, 100], [-25, 100]];
const right: Ring = [[25, 0], [50, 0], [50, 100], [25, 100]];
const behind: Ring = [[0, 100], [25, 100], [25, 200], [0, 200]];

describe("lotEdges", () => {
  it("SAMPLE: normalises CW closed ring to CCW unclosed", () => {
    const cw: Ring = [[0, 0], [0, 100], [25, 100], [25, 0], [0, 0]];
    const r = normalizeRing(cw);
    expect(r).toHaveLength(4);
    expect(lotEdges(cw).reduce((s, e) => s + e.lengthFt, 0)).toBeCloseTo(250);
  });
});

describe("classifyEdges", () => {
  const edgeStreets = (idx: number, s: StreetHit): StreetHit[][] => [0, 1, 2, 3].map((i) => (i === idx ? [s] : []));

  it("SAMPLE: interior lot -> one front, one rear, two sides", () => {
    const edges = classifyEdges(lot, [left, right, behind], edgeStreets(0, street(30)));
    expect(edges.map((e) => e.kind)).toEqual(["front", "side", "rear", "side"]);
    expect(edges[0].street?.name).toBe("SAMPLE ST");
  });

  it("SAMPLE: corner lot -> two fronts, no rear", () => {
    // no lot to the east, cross street east of the lot (edge 1 runs along y)
    const streets = [[street(30)], [street(30, [0, 1])], [], []];
    const edges = classifyEdges(lot, [left, behind], streets);
    expect(edges.filter((e) => e.kind === "front")).toHaveLength(2);
    expect(edges.some((e) => e.kind === "rear")).toBe(false);
  });

  it("SAMPLE: street farther than the threshold is not a front", () => {
    const edges = classifyEdges(lot, [left, right, behind], edgeStreets(0, street(80)));
    expect(edges.every((e) => e.kind === "unknown")).toBe(true);
  });

  it("SAMPLE: perpendicular street does not make a front", () => {
    const edges = classifyEdges(lot, [left, right, behind], edgeStreets(0, street(30, [0, 1])));
    expect(edges.every((e) => e.kind === "unknown")).toBe(true);
  });
});

describe("parseStreetWidth", () => {
  it.each([
    ["100", 100, true], ["60", 60, false], ["90.2", 90.2, true], [">75", null, true], [">60", null, null],
    ["73-100", null, null], ["100-105", null, true], ["35.9-40", null, false], ["Unknown", null, null], ["~45", null, null],
  ])("%s", (raw, w, wide) => {
    expect(parseStreetWidth(raw)).toEqual({ widthFt: w, wide });
  });
});

describe("intersectionArea", () => {
  it("SAMPLE: half-covered lot", () => {
    const half: number[][][] = [[[0, 0], [12.5, 0], [12.5, 100], [0, 100], [0, 0]]];
    expect(intersectionArea(lot, half, false)).toBeCloseTo(1250);
  });
});
