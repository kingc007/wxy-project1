// Pure planar polygon helpers (feet, or any consistent unit). No dependencies.
// Rings are arrays of [x, y]; helpers accept closed or unclosed rings and return UNCLOSED rings.

export type Pt = [number, number];

/** Drop a repeated closing vertex, if present. Returns a copy. */
export function openRing(ring: readonly Pt[]): Pt[] {
  const r = ring.map((p): Pt => [p[0], p[1]]);
  if (r.length > 1) {
    const a = r[0];
    const b = r[r.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) r.pop();
  }
  return r;
}

/** Signed shoelace area: positive for counter-clockwise rings. */
export function signedArea(ring: readonly Pt[]): number {
  const r = openRing(ring);
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i];
    const [x2, y2] = r[(i + 1) % r.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

/** Unsigned polygon area (shoelace). */
export function polygonArea(ring: readonly Pt[]): number {
  return Math.abs(signedArea(ring));
}

/** Return an unclosed, counter-clockwise copy of the ring. */
export function ensureCCW(ring: readonly Pt[]): Pt[] {
  const r = openRing(ring);
  return signedArea(r) < 0 ? r.reverse() : r;
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bbox(ring: readonly Pt[]): BBox {
  if (ring.length === 0) throw new Error("bbox of empty ring");
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Convert an EPSG:2263 ring to local feet relative to `origin` (local x = x - origin.x, local y = y - origin.y,
 * no rotation: the ZoningEnvelope contract). Drops a repeated closing vertex. Does NOT reorder winding.
 */
export function toLocal(ring2263: readonly Pt[], origin: { x: number; y: number }): Pt[] {
  return openRing(ring2263).map(([x, y]): Pt => [x - origin.x, y - origin.y]);
}

/** Directional change below which two consecutive edges are treated as one straight edge when merging. */
export const COLLINEAR_MERGE_DEG = 2;
/**
 * isConvex ignores turns whose |cross| is below sin(this) x |ab| x |bc| (a relative measure, so long and short
 * edges are treated alike). Survey/GIS rings often carry vertices a few hundredths of a degree off a straight line.
 */
export const CONVEX_TOLERANCE_DEG = 0.5;

/**
 * True when the (non-degenerate) ring is convex, accepting collinear and nearly collinear vertices (see
 * CONVEX_TOLERANCE_DEG). CCW or CW. A genuine concave notch still returns false.
 */
export function isConvex(ring: readonly Pt[]): boolean {
  const r = openRing(ring);
  if (r.length < 3) return false;
  const tol = Math.sin((CONVEX_TOLERANCE_DEG * Math.PI) / 180);
  let sign = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i];
    const b = r[(i + 1) % r.length];
    const c = r[(i + 2) % r.length];
    const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1];
    const cross = ux * vy - uy * vx;
    const scale = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    if (scale === 0 || Math.abs(cross) <= tol * scale) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return sign !== 0;
}

export interface MergedEdges {
  /** simplified, unclosed ring */
  polygon: Pt[];
  /** originalToMerged[i] = index of the merged edge that contains original edge i */
  originalToMerged: number[];
  /** mergedToOriginal[j] = original edge indices folded into merged edge j, in ring order */
  mergedToOriginal: number[][];
}

/**
 * Merge consecutive edges that are nearly collinear (direction change < toleranceDeg) AND carry the same key
 * (e.g. same edge kind and street). Edge i of the input runs from point i to point i+1. Merged edges are numbered in
 * ring order starting from the first surviving edge; when the last and first edges merge, the merged edge is numbered
 * with the last. Use `originalToMerged` to carry per-edge attributes across. Rings with fewer than 4 vertices, or
 * `keys` of the wrong length, are returned unchanged.
 */
export function mergeCollinearEdges(
  polygon: readonly Pt[], keys: readonly string[], toleranceDeg: number = COLLINEAR_MERGE_DEG,
): MergedEdges {
  const p = openRing(polygon);
  const n = p.length;
  const identity: MergedEdges = {
    polygon: p,
    originalToMerged: p.map((_, i) => i),
    mergedToOriginal: p.map((_, i) => [i]),
  };
  if (n < 4 || keys.length !== n) return identity;
  const tol = (toleranceDeg * Math.PI) / 180;
  const edges = p.map((start, i) => ({ start, key: keys[i], orig: [i] }));
  const endOf = (j: number) => edges[(j + 1) % edges.length].start;
  const turn = (a: number, b: number) => {
    const e1 = edges[a], e2 = edges[b];
    const d1x = endOf(a)[0] - e1.start[0], d1y = endOf(a)[1] - e1.start[1];
    const d2x = endOf(b)[0] - e2.start[0], d2y = endOf(b)[1] - e2.start[1];
    return Math.abs(Math.atan2(d1x * d2y - d1y * d2x, d1x * d2x + d1y * d2y));
  };
  let changed = true;
  while (changed && edges.length > 3) {
    changed = false;
    for (let j = 0; j < edges.length && edges.length > 3; j++) {
      const k = (j + 1) % edges.length;
      if (edges[j].key !== edges[k].key || turn(j, k) >= tol) continue;
      // fold edge k into edge j (drops the vertex edges[k].start)
      if (k === 0) {
        // last edge absorbs the first edge; the first edge disappears
        edges[j].orig.push(...edges[0].orig);
        edges.shift();
      } else {
        edges[j].orig.push(...edges[k].orig);
        edges.splice(k, 1);
      }
      changed = true;
      break;
    }
  }
  const originalToMerged = new Array<number>(n).fill(0);
  edges.forEach((e, j) => e.orig.forEach((o) => { originalToMerged[o] = j; }));
  return { polygon: edges.map((e) => e.start), originalToMerged, mergedToOriginal: edges.map((e) => e.orig) };
}

/** Inward unit normal of edge i of a CCW ring (edge i runs from point i to point i+1). */
export function inwardNormal(ring: readonly Pt[], i: number): Pt {
  const a = ring[i];
  const b = ring[(i + 1) % ring.length];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return [0, 0];
  return [-dy / len, dx / len];
}

/**
 * Offset selected edges of a CONVEX polygon inward by perEdgeInsets[i] (feet; 0 or undefined leaves the edge in
 * place) and recompute vertices by intersecting adjacent offset lines.
 * Input winding is normalised to CCW, so edge i of the result corresponds to edge i of the CCW input (for an input
 * that is already CCW, as the envelope contract requires, indices are unchanged).
 * Returns null (caller shows "manual geometry") when the polygon is not convex, an inset is negative or not finite,
 * adjacent offset edges are parallel with different insets, or the inset collapses/inverts the polygon.
 */
export function insetPolygonEdges(polygon: readonly Pt[], perEdgeInsets: readonly (number | null | undefined)[]): Pt[] | null {
  const p = ensureCCW(polygon);
  const n = p.length;
  if (n < 3 || signedArea(p) === 0) return null;
  if (!isConvex(p)) return null;
  const d: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = perEdgeInsets[i] ?? 0;
    if (!Number.isFinite(v) || v < 0) return null;
    d.push(v);
  }
  // Drop collinear vertices would renumber edges, so keep them and treat parallel neighbours explicitly.
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const prev = (i + n - 1) % n; // edge prev runs p[prev] -> p[i]; edge i runs p[i] -> p[i+1]
    const nPrev = inwardNormal(p, prev);
    const nCur = inwardNormal(p, i);
    const a1: Pt = [p[prev][0] + nPrev[0] * d[prev], p[prev][1] + nPrev[1] * d[prev]];
    const dir1: Pt = [p[i][0] - p[prev][0], p[i][1] - p[prev][1]];
    const a2: Pt = [p[i][0] + nCur[0] * d[i], p[i][1] + nCur[1] * d[i]];
    const dir2: Pt = [p[(i + 1) % n][0] - p[i][0], p[(i + 1) % n][1] - p[i][1]];
    const denom = dir1[0] * dir2[1] - dir1[1] * dir2[0];
    const scale = Math.hypot(dir1[0], dir1[1]) * Math.hypot(dir2[0], dir2[1]);
    if (Math.abs(denom) < 1e-9 * scale) {
      // Parallel (collinear) neighbours: only consistent if both offsets agree.
      if (Math.abs(d[prev] - d[i]) > 1e-9) return null;
      out.push(a2);
      continue;
    }
    const t = ((a2[0] - a1[0]) * dir2[1] - (a2[1] - a1[1]) * dir2[0]) / denom;
    out.push([a1[0] + dir1[0] * t, a1[1] + dir1[1] * t]);
  }
  // Validity: result must keep CCW orientation, positive area, and every edge must keep its original direction.
  if (signedArea(out) <= 1e-9) return null;
  for (let i = 0; i < n; i++) {
    const o1 = out[i];
    const o2 = out[(i + 1) % n];
    const dot = (o2[0] - o1[0]) * (p[(i + 1) % n][0] - p[i][0]) + (o2[1] - o1[1]) * (p[(i + 1) % n][1] - p[i][1]);
    if (dot < 0) return null;
  }
  return out;
}

/**
 * Diagonal hatch lines clipped to a simple polygon (even-odd). Lines satisfy x + y = c in the given planar frame.
 * Returns segments [[x1,y1],[x2,y2]]. `spacing` is the perpendicular distance between lines.
 */
export function hatchSegments(ring: readonly Pt[], spacing: number): [Pt, Pt][] {
  const r = openRing(ring);
  if (r.length < 3 || !(spacing > 0)) return [];
  const step = spacing * Math.SQRT2; // distance in c between lines of x + y = c
  let cMin = Infinity, cMax = -Infinity;
  for (const [x, y] of r) {
    cMin = Math.min(cMin, x + y);
    cMax = Math.max(cMax, x + y);
  }
  const segs: [Pt, Pt][] = [];
  const first = Math.ceil(cMin / step) * step;
  for (let c = first; c < cMax; c += step) {
    const xs: number[] = [];
    for (let i = 0; i < r.length; i++) {
      const a = r[i];
      const b = r[(i + 1) % r.length];
      const fa = a[0] + a[1] - c;
      const fb = b[0] + b[1] - c;
      // half-open crossing rule avoids double-counting vertices
      if ((fa < 0 && fb >= 0) || (fb < 0 && fa >= 0)) {
        const t = fa / (fa - fb);
        xs.push(a[0] + (b[0] - a[0]) * t);
      }
    }
    xs.sort((m, k) => m - k);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      segs.push([[xs[k], c - xs[k]], [xs[k + 1], c - xs[k + 1]]]);
    }
  }
  return segs;
}
