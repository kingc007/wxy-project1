import { describe, expect, it } from "vitest";
import { boundsOf, labelAnchor, prismToGeometry, sectionCutSegments, triangleCount } from "../mesh";
import type { Prism } from "@wxy/massing";

const box = (id = "b"): Prism => ({
  id,
  polygon: {
    outer: [[0, 0], [10, 0], [10, 10], [0, 10]],
    holes: [],
  },
  z0: 0,
  z1: 3,
  program: "residential",
  floors: [0],
});

const ring: Prism = {
  id: "ring",
  polygon: {
    outer: [[0, 0], [10, 0], [10, 10], [0, 10]],
    holes: [[[3, 3], [3, 7], [7, 7], [7, 3]]], // CW
  },
  z0: 0,
  z1: 3,
  program: "commercial",
  floors: [0],
};

/** Divergence-theorem volume: positive iff triangles wind outward. */
function signedVolume(pos: ArrayLike<number>): number {
  let v = 0;
  for (let i = 0; i < pos.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = Array.from({ length: 9 }, (_, k) => pos[i + k]);
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return v;
}

describe("prismToGeometry", () => {
  it("10x10x3 box has 12 triangles and exact bounds", () => {
    const g = prismToGeometry(box());
    expect(triangleCount(g)).toBe(12);
    const bb = g.boundingBox!;
    expect([bb.min.x, bb.min.y, bb.min.z]).toEqual([0, 0, 0]);
    expect([bb.max.x, bb.max.y, bb.max.z]).toEqual([10, 10, 3]);
    expect(signedVolume(g.getAttribute("position").array)).toBeCloseTo(300, 4);
  });

  it("flat normals: top +z, bottom -z, walls horizontal unit vectors", () => {
    const g = prismToGeometry(box());
    const n = g.getAttribute("normal");
    const p = g.getAttribute("position");
    for (let t = 0; t < 12; t++) {
      const nx = n.getX(t * 3), ny = n.getY(t * 3), nz = n.getZ(t * 3);
      expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 6);
      // all three vertices of a face share one normal
      expect(n.getX(t * 3 + 2)).toBe(nx);
      const zs = [p.getZ(t * 3), p.getZ(t * 3 + 1), p.getZ(t * 3 + 2)];
      if (zs.every((z) => z === 3)) expect(nz).toBeCloseTo(1, 6);
      if (zs.every((z) => z === 0)) expect(nz).toBeCloseTo(-1, 6);
    }
  });

  it("polygon with a hole: caps use V+2H-2 triangles, no NaN, outward winding", () => {
    const g = prismToGeometry(ring);
    // caps: (8 + 2*1 - 2) = 8 per cap; walls: 8 edges * 2
    expect(triangleCount(g)).toBe(8 * 2 + 16);
    const arr = g.getAttribute("position").array;
    expect(Array.from(arr).every(Number.isFinite)).toBe(true);
    expect(Array.from(g.getAttribute("normal").array).every(Number.isFinite)).toBe(true);
    expect(signedVolume(arr)).toBeCloseTo((100 - 16) * 3, 3);
  });

  it("tolerates reversed ring orientation", () => {
    const flipped: Prism = {
      ...ring,
      polygon: {
        outer: [...ring.polygon.outer].reverse(),
        holes: ring.polygon.holes.map((h) => [...h].reverse()),
      },
    };
    expect(signedVolume(prismToGeometry(flipped).getAttribute("position").array)).toBeCloseTo(252, 3);
  });

  it("degenerate input yields an empty geometry", () => {
    expect(triangleCount(prismToGeometry({ ...box(), z1: 0 }))).toBe(0);
    expect(triangleCount(prismToGeometry({ ...box(), polygon: { outer: [[0, 0], [1, 1]], holes: [] } }))).toBe(0);
  });
});

describe("sectionCutSegments / boundsOf", () => {
  it("outlines prisms crossed by the plane only", () => {
    expect(sectionCutSegments([box()], 1.5).length).toBe(4 * 6);
    expect(sectionCutSegments([ring], 1.5).length).toBe(8 * 6);
    expect(sectionCutSegments([box()], 5).length).toBe(0);
    expect(sectionCutSegments([box()], 0).length).toBe(0);
  });
  it("bounds", () => {
    expect(boundsOf([box()])).toEqual({ min: [0, 0, 0], max: [10, 10, 3] });
    expect(boundsOf([])).toBeNull();
  });
});

describe("labelAnchor / uv", () => {
  it("anchor of a ring lies in the solid, not the courtyard", () => {
    const a = labelAnchor(ring.polygon);
    const inHole = a.x > 3 && a.x < 7 && a.y > 3 && a.y < 7;
    expect(inHole).toBe(false);
    expect(a.clearance).toBeGreaterThan(0.5);
  });
  it("uv count matches vertex count", () => {
    const g = prismToGeometry(ring);
    expect(g.getAttribute("uv").count).toBe(g.getAttribute("position").count);
  });
});
