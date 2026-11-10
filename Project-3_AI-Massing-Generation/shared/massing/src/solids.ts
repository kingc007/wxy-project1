// Floors -> prisms -> meshes (spec §4). No CSG: each prism is an extruded polygon-with-holes.
// earcut API confirmed in node_modules/earcut/src/earcut.d.ts: earcut(data, holeIndices?, dim?) => number[] (triangle indices).
import earcut from "earcut";
import { polygonKey } from "./geom2d";
import type { FloorPlate, Polygon, Prism, Vec2 } from "./types";

/** Merge consecutive floors with identical polygon and program into prisms. */
export function buildPrisms(floors: readonly FloorPlate[]): Prism[] {
  const prisms: Prism[] = [];
  let open = new Map<string, Prism>();
  for (const f of floors) {
    const next = new Map<string, Prism>();
    const used = new Set<string>();
    for (const poly of f.polygons) {
      let key = `${f.program}|${polygonKey(poly)}`;
      // duplicate identical polygons in one floor (should not happen) get distinct keys
      while (used.has(key)) key += "+";
      used.add(key);
      const prev = open.get(key);
      if (prev) {
        prev.z1 = f.z + f.height;
        prev.floors.push(f.index);
        next.set(key, prev);
      } else {
        const p: Prism = { id: `prism-${prisms.length}`, polygon: poly, z0: f.z, z1: f.z + f.height, program: f.program, floors: [f.index] };
        prisms.push(p);
        next.set(key, p);
      }
    }
    open = next;
  }
  return prisms;
}

export interface PrismMesh {
  positions: Float32Array;
  indices: Uint32Array;
  normals?: Float32Array;
}

/** Flat-shaded mesh: caps triangulated with earcut, one quad per ring edge; CCW triangles with outward normals. */
export function prismToMesh(prism: Prism): PrismMesh {
  const { polygon, z0, z1 } = prism;
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  const pushV = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
    pos.push(x, y, z);
    nor.push(nx, ny, nz);
    return pos.length / 3 - 1;
  };

  // caps
  const flat: number[] = [];
  const holeStarts: number[] = [];
  const addRing = (r: readonly Vec2[], hole: boolean) => {
    if (hole) holeStarts.push(flat.length / 2);
    for (const [x, y] of r) flat.push(x, y);
  };
  addRing(polygon.outer, false);
  for (const h of polygon.holes) addRing(h, true);
  const tris = earcut(flat, holeStarts.length ? holeStarts : null, 2);
  const topBase = pos.length / 3;
  for (let i = 0; i < flat.length; i += 2) pushV(flat[i], flat[i + 1], z1, 0, 0, 1);
  const botBase = pos.length / 3;
  for (let i = 0; i < flat.length; i += 2) pushV(flat[i], flat[i + 1], z0, 0, 0, -1);
  for (let t = 0; t < tris.length; t += 3) {
    let a = tris[t];
    let b = tris[t + 1];
    const c = tris[t + 2];
    const cr = (flat[2 * b] - flat[2 * a]) * (flat[2 * c + 1] - flat[2 * a + 1]) - (flat[2 * b + 1] - flat[2 * a + 1]) * (flat[2 * c] - flat[2 * a]);
    if (cr < 0) [a, b] = [b, a]; // make CCW seen from +z
    idx.push(topBase + a, topBase + b, topBase + c);
    idx.push(botBase + a, botBase + c, botBase + b); // reversed for the bottom
  }

  // sides: outer CCW and holes CW => outward normal is (dy, -dx) for every ring
  const side = (r: readonly Vec2[]) => {
    for (let i = 0; i < r.length; i++) {
      const [ax, ay] = r[i];
      const [bx, by] = r[(i + 1) % r.length];
      const dx = bx - ax;
      const dy = by - ay;
      const l = Math.hypot(dx, dy);
      if (l === 0) continue;
      const nx = dy / l;
      const ny = -dx / l;
      const a0 = pushV(ax, ay, z0, nx, ny, 0);
      const b0 = pushV(bx, by, z0, nx, ny, 0);
      const b1 = pushV(bx, by, z1, nx, ny, 0);
      const a1 = pushV(ax, ay, z1, nx, ny, 0);
      idx.push(a0, b0, b1, a0, b1, a1);
    }
  };
  side(polygon.outer);
  for (const h of polygon.holes) side(h);

  return { positions: new Float32Array(pos), indices: new Uint32Array(idx), normals: new Float32Array(nor) };
}

export function polygonVertexCount(p: Polygon): number {
  return p.outer.length + p.holes.reduce((t, h) => t + h.length, 0);
}
