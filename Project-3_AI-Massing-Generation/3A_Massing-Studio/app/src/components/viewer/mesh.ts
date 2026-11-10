// Pure geometry helpers for the viewer. No React, no WebGL: safe to unit test in node.
// Frame: engine local (x east, y north, z up, feet). Geometry is emitted in the ENGINE frame;
// the scene graph rotates the whole model group so engine z maps to three y (see SceneContent.tsx).
import * as THREE from "three";
import type { MultiPolygon, Polygon, Prism, Vec2 } from "@wxy/massing";

function signedArea(ring: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

/** Drop a repeated closing vertex if a caller passes a closed ring. */
function open(ring: Vec2[]): Vec2[] {
  if (ring.length > 1) {
    const f = ring[0];
    const l = ring[ring.length - 1];
    if (f[0] === l[0] && f[1] === l[1]) return ring.slice(0, -1);
  }
  return ring;
}

/** Outer ring CCW, holes CW, whatever the caller sent (defensive; contract says it already is). */
function normalizePolygon(p: Polygon): Polygon {
  const outer = open(p.outer);
  const o = signedArea(outer) < 0 ? [...outer].reverse() : outer;
  const holes = p.holes
    .map(open)
    .filter((h) => h.length >= 3)
    .map((h) => (signedArea(h) > 0 ? [...h].reverse() : h));
  return { outer: o, holes };
}

/**
 * Triangulate caps (earcut via THREE.ShapeUtils, holes supported) and extrude side walls.
 * Non-indexed with one normal per face, so flat shading and EdgesGeometry read crisply.
 * Returns an empty geometry for degenerate input (fewer than 3 vertices or z1 <= z0).
 */
export function prismToGeometry(prism: Prism): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const { z0, z1 } = prism;
  if (prism.polygon.outer.length < 3 || !(z1 > z0)) {
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(0), 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(0), 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(0), 2));
    return geometry;
  }
  const poly = normalizePolygon(prism.polygon);
  const pos: number[] = [];
  const nrm: number[] = [];
  const uvs: number[] = []; // feet-based planar UVs (hatch textures scale them via texture.repeat)

  const pushTri = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    uv?: [number, number][],
  ) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    [a, b, c].forEach((p, n) => {
      pos.push(p[0], p[1], p[2]);
      nrm.push(nx, ny, nz);
      if (uv) uvs.push(uv[n][0], uv[n][1]);
      else uvs.push(p[0], p[1]);
    });
  };

  // Caps
  const contour = poly.outer.map(([x, y]) => new THREE.Vector2(x, y));
  const holes = poly.holes.map((h) => h.map(([x, y]) => new THREE.Vector2(x, y)));
  const tris = THREE.ShapeUtils.triangulateShape(contour, holes);
  const pts: Vec2[] = [...poly.outer, ...poly.holes.flat()];
  for (const [i, j, k] of tris) {
    const a = pts[i];
    let b = pts[j];
    let c = pts[k];
    // Force CCW seen from +z for the top cap.
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (area < 0) [b, c] = [c, b];
    pushTri([a[0], a[1], z1], [b[0], b[1], z1], [c[0], c[1], z1]); // top, +z
    pushTri([a[0], a[1], z0], [c[0], c[1], z0], [b[0], b[1], z0]); // bottom, -z
  }

  // Walls: outward from solid is to the right of travel for CCW outer and CW holes.
  for (const ring of [poly.outer, ...poly.holes]) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      if (a[0] === b[0] && a[1] === b[1]) continue;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      pushTri([a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [[0, z0], [len, z0], [len, z1]]);
      pushTri([a[0], a[1], z0], [b[0], b[1], z1], [a[0], a[1], z1], [[0, z0], [len, z1], [0, z1]]);
    }
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(nrm), 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Triangle count of a (non-indexed) geometry. */
export function triangleCount(g: THREE.BufferGeometry): number {
  return g.getAttribute("position").count / 3;
}

/** Closed prism list for a MultiPolygon band (used by the translucent envelope). */
export function bandPrisms(id: string, polygons: MultiPolygon, z0: number, z1: number): Prism[] {
  return polygons.map((polygon, i) => ({ id: `${id}:${i}`, polygon, z0, z1, program: "residential", floors: [] }));
}

/**
 * Polylines (flat xyz segment pairs) for the outline of every prism cut by the plane z = cutZ.
 * Because prisms are vertical extrusions, the cut outline equals the footprint at that height.
 */
export function sectionCutSegments(prisms: Prism[], cutZ: number): Float32Array {
  const out: number[] = [];
  for (const pr of prisms) {
    if (!(cutZ > pr.z0 && cutZ < pr.z1)) continue;
    const poly = normalizePolygon(pr.polygon);
    for (const ring of [poly.outer, ...poly.holes]) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        out.push(a[0], a[1], cutZ, b[0], b[1], cutZ);
      }
    }
  }
  return new Float32Array(out);
}

/** Axis-aligned bounds over prisms and extra polygons, in engine feet. */
export function boundsOf(
  prisms: Prism[],
  extraPolygons: Polygon[] = [],
): { min: [number, number, number]; max: [number, number, number] } | null {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const visit = (p: Polygon, z0: number, z1: number) => {
    for (const [x, y] of p.outer) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    minZ = Math.min(minZ, z0); maxZ = Math.max(maxZ, z1);
  };
  for (const pr of prisms) visit(pr.polygon, pr.z0, pr.z1);
  for (const p of extraPolygons) visit(p, 0, 0);
  if (!isFinite(minX)) return null;
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

function inRing(x: number, y: number, ring: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToRing(x: number, y: number, ring: Vec2[]): number {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % ring.length];
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return best;
}

/** A point inside the polygon (outside its holes) far from its edges: where a label sits. */
export function labelAnchor(p: Polygon): { x: number; y: number; clearance: number } {
  const xs = p.outer.map((v) => v[0]);
  const ys = p.outer.map((v) => v[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const N = 15;
  let best = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, clearance: 0 };
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const x = x0 + ((x1 - x0) * i) / N;
      const y = y0 + ((y1 - y0) * j) / N;
      if (!inRing(x, y, p.outer) || p.holes.some((h) => inRing(x, y, h))) continue;
      const c = Math.min(distToRing(x, y, p.outer), ...p.holes.map((h) => distToRing(x, y, h)));
      if (c > best.clearance) best = { x, y, clearance: c };
    }
  }
  return best;
}
