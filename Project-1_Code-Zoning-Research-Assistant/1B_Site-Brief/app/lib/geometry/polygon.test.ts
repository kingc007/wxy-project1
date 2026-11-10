import { describe, expect, it } from "vitest";
import {
  bbox, ensureCCW, hatchSegments, insetPolygonEdges, isConvex, mergeCollinearEdges, polygonArea, signedArea, toLocal, type Pt,
} from "./polygon";

// SAMPLE geometry: 25 ft x 100 ft rectangle, CCW, edge 0 = south (front) edge. Not a real lot.
const RECT: Pt[] = [[0, 0], [25, 0], [25, 100], [0, 100]];

describe("polygon helpers (SAMPLE rectangles)", () => {
  it("computes area with the shoelace formula", () => {
    expect(polygonArea(RECT)).toBe(2500);
    expect(signedArea(RECT)).toBe(2500);
    expect(signedArea([...RECT].reverse())).toBe(-2500);
  });

  it("ignores a repeated closing vertex", () => {
    expect(polygonArea([...RECT, [0, 0]])).toBe(2500);
  });

  it("ensureCCW reverses clockwise rings and leaves CCW alone", () => {
    expect(ensureCCW(RECT)).toEqual(RECT);
    const cw = [...RECT].reverse();
    expect(signedArea(ensureCCW(cw))).toBe(2500);
  });

  it("bbox", () => {
    expect(bbox(RECT)).toEqual({ minX: 0, minY: 0, maxX: 25, maxY: 100 });
  });

  it("toLocal subtracts the origin and drops the closing vertex", () => {
    const ring: Pt[] = [[1000, 2000], [1025, 2000], [1025, 2100], [1000, 2100], [1000, 2000]];
    expect(toLocal(ring, { x: 1000, y: 2000 })).toEqual(RECT);
  });

  it("isConvex", () => {
    expect(isConvex(RECT)).toBe(true);
    expect(isConvex([[0, 0], [10, 0], [10, 10], [5, 3], [0, 10]])).toBe(false);
  });
});

describe("insetPolygonEdges (SAMPLE rectangles)", () => {
  it("insets the rear edge only", () => {
    // edge 2 = north/rear edge
    const r = insetPolygonEdges(RECT, [0, 0, 30, 0]);
    expect(r).toEqual([[0, 0], [25, 0], [25, 70], [0, 70]]);
  });

  it("insets front and rear, then sides", () => {
    const r = insetPolygonEdges(RECT, [15, 0, 30, 0]);
    expect(r).toEqual([[0, 15], [25, 15], [25, 70], [0, 70]]);
    const s = insetPolygonEdges(RECT, [15, 5, 30, 5])!;
    expect(polygonArea(s)).toBeCloseTo(15 * 55, 6);
  });

  it("zero inset returns the same ring", () => {
    expect(insetPolygonEdges(RECT, [])).toEqual(RECT);
  });

  it("handles a clockwise input by normalising to CCW", () => {
    const r = insetPolygonEdges([...RECT].reverse(), [0, 0, 30, 0]);
    expect(polygonArea(r!)).toBeCloseTo(25 * 70, 6);
  });

  it("handles a convex quad (trapezoid)", () => {
    const trap: Pt[] = [[0, 0], [20, 0], [15, 10], [5, 10]];
    const r = insetPolygonEdges(trap, [1, 0, 0, 0])!;
    expect(r).not.toBeNull();
    // front edge moved up 1 ft: bottom vertices at y = 1
    expect(r[0][1]).toBeCloseTo(1, 9);
    expect(r[1][1]).toBeCloseTo(1, 9);
    expect(r[2]).toEqual(trap[2]);
    expect(polygonArea(r)).toBeLessThan(polygonArea(trap));
  });

  it("returns null when the inset collapses the polygon", () => {
    expect(insetPolygonEdges(RECT, [60, 0, 60, 0])).toBeNull();
    expect(insetPolygonEdges(RECT, [0, 13, 0, 13])).toBeNull();
  });

  it("returns null for non-convex polygons and bad insets", () => {
    const L: Pt[] = [[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]];
    expect(insetPolygonEdges(L, [1, 0, 0, 0, 0, 0])).toBeNull();
    expect(insetPolygonEdges(RECT, [-1, 0, 0, 0])).toBeNull();
    expect(insetPolygonEdges(RECT, [Number.NaN, 0, 0, 0])).toBeNull();
    expect(insetPolygonEdges([[0, 0], [1, 1]], [])).toBeNull();
  });

  it("handles a collinear extra vertex with consistent insets", () => {
    const r = insetPolygonEdges([[0, 0], [12, 0], [25, 0], [25, 100], [0, 100]], [0, 0, 0, 30, 0]);
    expect(r).not.toBeNull();
    expect(polygonArea(r!)).toBeCloseTo(25 * 70, 6);
  });
});

describe("hatchSegments", () => {
  it("clips diagonal lines to the polygon", () => {
    const segs = hatchSegments(RECT, 5);
    expect(segs.length).toBeGreaterThan(10);
    for (const [a, b] of segs) {
      for (const [x, y] of [a, b]) {
        expect(x).toBeGreaterThanOrEqual(-1e-9);
        expect(x).toBeLessThanOrEqual(25 + 1e-9);
        expect(y).toBeGreaterThanOrEqual(-1e-9);
        expect(y).toBeLessThanOrEqual(100 + 1e-9);
      }
    }
  });
  it("returns nothing for degenerate input", () => {
    expect(hatchSegments([[0, 0], [1, 1]], 1)).toEqual([]);
    expect(hatchSegments(RECT, 0)).toEqual([]);
  });
});

describe("near-collinear vertices (SAMPLE rectangles)", () => {
  // SAMPLE: 25 x 100 ft rectangle whose east side is split into 3 segments with tiny kinks (about 0.01 ft).
  const SPLIT: Pt[] = [[0, 0], [25, 0], [25.004, 50.99], [24.996, 77.83], [25, 100], [0, 100]];
  // SAMPLE: same rectangle with a genuine 5 ft x 20 ft notch cut into the east side.
  const NOTCH: Pt[] = [[0, 0], [25, 0], [25, 40], [20, 40], [20, 60], [25, 60], [25, 100], [0, 100]];

  it("isConvex tolerates near-zero cross products but rejects a real notch", () => {
    expect(isConvex(SPLIT)).toBe(true);
    expect(isConvex(NOTCH)).toBe(false);
  });

  it("mergeCollinearEdges folds same-key near-collinear edges and maps indices", () => {
    const keys = ["front", "side", "side", "side", "rear", "side"];
    const m = mergeCollinearEdges(SPLIT, keys);
    expect(m.polygon).toHaveLength(4);
    expect(m.mergedToOriginal).toEqual([[0], [1, 2, 3], [4], [5]]);
    expect(m.originalToMerged).toEqual([0, 1, 1, 1, 2, 3]);
    expect(polygonArea(m.polygon)).toBeCloseTo(2500, 0);
  });

  it("does not merge edges with different keys", () => {
    const m = mergeCollinearEdges(SPLIT, ["front", "side", "rear", "side", "rear", "side"]);
    expect(m.polygon).toHaveLength(6);
  });

  it("does not merge a real corner or a notch", () => {
    const m = mergeCollinearEdges(NOTCH, NOTCH.map(() => "side"));
    expect(m.polygon).toHaveLength(8);
  });

  it("merges across the ring start (last + first edge)", () => {
    const ring: Pt[] = [[12, 0], [25, 0], [25, 100], [0, 100], [0, 0]]; // edge 4 (0,0)->(12,0) continues edge 0
    const m = mergeCollinearEdges(ring, ["front", "side", "rear", "side", "front"]);
    expect(m.polygon).toHaveLength(4);
    expect(m.originalToMerged[0]).toBe(m.originalToMerged[4]);
  });

  it("insetPolygonEdges works on the split rectangle directly and returns null for the notch", () => {
    expect(insetPolygonEdges(SPLIT, [0, 0, 0, 0, 10, 0])).not.toBeNull();
    expect(insetPolygonEdges(NOTCH, [0, 0, 0, 0, 0, 0, 30, 0])).toBeNull();
  });
});
