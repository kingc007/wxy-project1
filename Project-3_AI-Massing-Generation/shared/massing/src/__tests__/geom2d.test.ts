import { beforeAll, describe, expect, it } from "vitest";
import {
  area,
  bbox,
  difference,
  fromFrame,
  initGeometry,
  inset,
  intersect,
  liveGeometryObjects,
  makeFrame,
  perimeter,
  polygonArea,
  rectFromFrame,
  rectPolygon,
  strip,
  toFrame,
  union,
} from "../geom2d";
import type { Polygon } from "../types";

beforeAll(async () => {
  await initGeometry();
});

const sq = (x0: number, y0: number, x1: number, y1: number): Polygon => rectPolygon(x0, y0, x1, y1);
const withHole: Polygon = {
  outer: [[0, 0], [100, 0], [100, 100], [0, 100]],
  holes: [[[20, 20], [20, 40], [40, 40], [40, 20]]],
};

describe("geom2d", () => {
  it("areas and perimeters", () => {
    expect(polygonArea(sq(0, 0, 100, 100))).toBe(10000);
    expect(polygonArea(withHole)).toBe(9600);
    expect(perimeter([withHole])).toBeCloseTo(400 + 80, 9);
  });

  it("union / intersect / difference areas", () => {
    const a = [sq(0, 0, 10, 10)];
    const b = [sq(5, 0, 15, 10)];
    expect(area(union(a, b))).toBeCloseTo(150, 6);
    expect(area(intersect(a, b))).toBeCloseTo(50, 6);
    expect(area(difference(a, b))).toBeCloseTo(50, 6);
    expect(intersect(a, [sq(50, 50, 60, 60)])).toEqual([]);
    expect(difference([], b)).toEqual([]);
  });

  it("difference that makes a hole keeps outer + hole in one polygon", () => {
    const r = difference([sq(0, 0, 100, 100)], [sq(20, 20, 40, 40)]);
    expect(r).toHaveLength(1);
    expect(r[0].holes).toHaveLength(1);
    expect(area(r)).toBeCloseTo(9600, 6);
  });

  it("normalises winding (CW outer, CCW hole)", () => {
    const cw: Polygon = { outer: [[0, 0], [0, 100], [100, 100], [100, 0]], holes: [[[20, 20], [40, 20], [40, 40], [20, 40]]] };
    expect(area(union([cw]))).toBeCloseTo(9600, 6);
  });

  it("inset: 100x100 by 10 is 6400; holes grow; too deep is empty", () => {
    expect(area(inset([sq(0, 0, 100, 100)], 10))).toBeCloseTo(6400, 6);
    expect(area(inset([withHole], 5))).toBeCloseTo(90 * 90 - 30 * 30, 6);
    expect(inset([sq(0, 0, 100, 100)], 60)).toEqual([]);
    expect(area(inset([sq(0, 0, 100, 100)], 0))).toBe(10000);
  });

  it("inset of an L keeps the sharp reflex corner (mitre)", () => {
    const L: Polygon = { outer: [[0, 0], [100, 0], [100, 50], [50, 50], [50, 100], [0, 100]], holes: [] };
    expect(area(inset([L], 10))).toBeCloseTo(3900, 6);
  });

  it("strip on convex (extended) and reflex (not extended) corners", () => {
    const convex = strip([0, 0], [100, 0], 10, 10, 10);
    expect(polygonArea(convex)).toBeCloseTo(1200, 9);
    expect(bbox([convex])).toEqual({ minX: -10, minY: 0, maxX: 110, maxY: 10 });
    const reflex = strip([0, 0], [100, 0], 10, 0, 0);
    expect(polygonArea(reflex)).toBeCloseTo(1000, 9);
    // inward side is the left of a->b
    expect(bbox([strip([100, 0], [100, 100], 10)])).toEqual({ minX: 90, minY: 0, maxX: 100, maxY: 100 });
  });

  it("frames round-trip and rectFromFrame is CCW world geometry", () => {
    const f = makeFrame([10, 10], [10, 110]); // frontage runs north, inward = west
    expect(f.v[0]).toBeCloseTo(-1, 12);
    const p = fromFrame(f, [30, 5]);
    expect(p[0]).toBeCloseTo(5, 9);
    expect(p[1]).toBeCloseTo(40, 9);
    const q = toFrame(f, p);
    expect(q[0]).toBeCloseTo(30, 9);
    expect(q[1]).toBeCloseTo(5, 9);
    expect(polygonArea(rectFromFrame(f, 0, 20, 0, 5))).toBeCloseTo(100, 9);
  });

  it("does not leak WASM objects", () => {
    for (let i = 0; i < 200; i++) {
      const a = [sq(0, 0, 10 + i, 10)];
      union(a, [sq(5, 0, 15, 10)]);
      intersect(a, [sq(5, 0, 15, 10)]);
      difference(a, [sq(2, 2, 4, 4)]);
      inset(a, 1);
    }
    expect(liveGeometryObjects()).toBe(0);
  });
});
