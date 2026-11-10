import { describe, expect, it } from "vitest";
import { initGeometry } from "../geom2d";
import { prismToMesh } from "../solids";
import type { Prism } from "../types";
import { squareLot } from "./fixtures/envelopes";
import { gen } from "./fixtures/helpers";

await initGeometry();

function signedVolume(pos: Float32Array, idx: Uint32Array): number {
  let v = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3;
    const b = idx[i + 1] * 3;
    const c = idx[i + 2] * 3;
    v +=
      (pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1]) -
        pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c]) +
        pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c])) /
      6;
  }
  return v;
}

/** Every directed edge must appear once and its reverse once (watertight, consistently oriented). */
function watertight(pos: Float32Array, idx: Uint32Array): boolean {
  const key = (i: number) => `${pos[i * 3].toFixed(3)},${pos[i * 3 + 1].toFixed(3)},${pos[i * 3 + 2].toFixed(3)}`;
  const edges = new Map<string, number>();
  for (let i = 0; i < idx.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const e = `${key(idx[i + k])}>${key(idx[i + ((k + 1) % 3)])}`;
      edges.set(e, (edges.get(e) ?? 0) + 1);
    }
  }
  for (const [e, n] of edges) {
    const [a, b] = e.split(">");
    if (n !== 1 || edges.get(`${b}>${a}`) !== 1) return false;
  }
  return true;
}

describe("prismToMesh", () => {
  it("plain extrusion: volume, watertight, normals", () => {
    const o = gen(squareLot(), { baseFloors: 3 });
    const m = prismToMesh(o.prisms[0]);
    expect(signedVolume(m.positions, m.indices)).toBeCloseTo(7000 * 35, 0);
    expect(watertight(m.positions, m.indices)).toBe(true);
    expect(m.normals).toHaveLength(m.positions.length);
  });
  it("polygon with a hole triangulates correctly", () => {
    const o = gen(squareLot(), { baseFloors: 3, ringDepth: 25 });
    const prism = o.prisms[0];
    expect(prism.polygon.holes).toHaveLength(1);
    const m = prismToMesh(prism);
    expect(signedVolume(m.positions, m.indices)).toBeCloseTo(6000 * 35, 0);
    expect(watertight(m.positions, m.indices)).toBe(true);
  });
  it("rotated tower prism", () => {
    const o = gen(squareLot(), { baseFloors: 1, upperMode: "tower", upperFloors: 2, towerRotation: 30, towerAspect: 2 });
    for (const pr of o.prisms as Prism[]) {
      const m = prismToMesh(pr);
      expect(watertight(m.positions, m.indices)).toBe(true);
      expect(signedVolume(m.positions, m.indices)).toBeGreaterThan(0);
    }
  });
});
