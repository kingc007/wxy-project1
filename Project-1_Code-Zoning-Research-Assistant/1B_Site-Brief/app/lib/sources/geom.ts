// Planar geometry helpers (EPSG:2263 feet). Pure functions.
import * as pcNs from "polygon-clipping";
import type { Ring } from "@/lib/types";

type Pair = [number, number];
type PCPolygon = Pair[][];
type PCMulti = Pair[][][];
interface PCApi {
  intersection: (a: PCPolygon | PCMulti, ...b: (PCPolygon | PCMulti)[]) => PCMulti;
}
// polygon-clipping ships a CJS main (module.exports = {...}) and an ESM build with only a default export,
// while its .d.ts declares named exports; resolve whichever shape the runtime gives us.
const pc: PCApi = ((pcNs as unknown as { default?: PCApi }).default ?? (pcNs as unknown as PCApi));

/** Signed area (shoelace). Positive = counter-clockwise. Works for closed or unclosed rings. */
export function signedArea(ring: Ring): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

export function ringArea(ring: Ring): number {
  return Math.abs(signedArea(ring));
}

/** Unclosed, de-duplicated, counter-clockwise copy of a ring. */
export function normalizeRing(ring: Ring): Ring {
  const out: Ring = [];
  for (const p of ring) {
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push([p[0], p[1]]);
  }
  if (out.length > 1) {
    const f = out[0];
    const l = out[out.length - 1];
    if (f[0] === l[0] && f[1] === l[1]) out.pop();
  }
  return signedArea(out) < 0 ? out.reverse() : out;
}

export function closeRing(ring: Ring): Ring {
  if (ring.length === 0) return ring;
  const f = ring[0];
  const l = ring[ring.length - 1];
  return f[0] === l[0] && f[1] === l[1] ? ring : [...ring, [f[0], f[1]]];
}

export function bbox(rings: Ring[]): { xmin: number; ymin: number; xmax: number; ymax: number } {
  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
  for (const r of rings) for (const [x, y] of r) {
    if (x < xmin) xmin = x;
    if (x > xmax) xmax = x;
    if (y < ymin) ymin = y;
    if (y > ymax) ymax = y;
  }
  return { xmin, ymin, xmax, ymax };
}

/** Ray-casting point-in-polygon (boundary points are unspecified). */
export function pointInRing(pt: Pair, ring: Ring): boolean {
  let inside = false;
  const [x, y] = pt;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export interface SegmentDistance {
  distance: number;
  /** unit direction of the closest segment */
  direction: Pair;
}

export function distancePointToSegment(p: Pair, a: Pair, b: Pair): SegmentDistance {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = a[0] + t * dx;
  const cy = a[1] + t * dy;
  const len = Math.sqrt(len2) || 1;
  return { distance: Math.hypot(p[0] - cx, p[1] - cy), direction: [dx / len, dy / len] };
}

/** Closest approach of a point to a set of polylines. */
export function distancePointToLines(p: Pair, lines: Ring[]): SegmentDistance | null {
  let best: SegmentDistance | null = null;
  for (const line of lines) {
    for (let i = 0; i + 1 < line.length; i++) {
      const d = distancePointToSegment(p, line[i], line[i + 1]);
      if (!best || d.distance < best.distance) best = d;
    }
  }
  return best;
}

function multiArea(mp: PCMulti): number {
  let total = 0;
  for (const poly of mp) {
    poly.forEach((r, i) => {
      const a = ringArea(r);
      total += i === 0 ? a : -a; // outer ring, then holes
    });
  }
  return total;
}

/** Area (sq ft) of lotRing ∩ geometry, where geometry is a GeoJSON Polygon/MultiPolygon coordinates array. */
export function intersectionArea(lotRing: Ring, geomCoords: number[][][] | number[][][][], isMulti: boolean): number {
  const subject: PCPolygon = [closeRing(lotRing)];
  const clip = (isMulti ? geomCoords : [geomCoords]) as unknown as PCMulti;
  if (clip.length === 0) return 0;
  const result = pc.intersection(subject, clip);
  return multiArea(result);
}

export const dist = (a: Pair, b: Pair): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Outer rings of geometry ∩ axis-aligned box (any CRS; used to trim big district polygons for map display). */
export function clipToBox(
  geomCoords: number[][][] | number[][][][], isMulti: boolean,
  box: { xmin: number; ymin: number; xmax: number; ymax: number },
): Ring[] {
  const rect: PCPolygon = [[[box.xmin, box.ymin], [box.xmax, box.ymin], [box.xmax, box.ymax], [box.xmin, box.ymax], [box.xmin, box.ymin]]];
  const clip = (isMulti ? geomCoords : [geomCoords]) as unknown as PCMulti;
  if (clip.length === 0) return [];
  return pc.intersection(rect, clip).map((poly) => poly[0] as Ring);
}
