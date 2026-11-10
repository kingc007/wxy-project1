// Lot-edge classification (front / side / rear). Pure geometry given pre-fetched neighbour lots and street hits.
// HEURISTIC, not a legal determination: ZR 12-10 defines front lot line by the street line; here we infer it from
// "outside is not another tax lot" + "a mapped street centerline is nearby and roughly parallel".
import type { LotEdge, Ring } from "@/lib/types";
import { dist, normalizeRing, pointInRing } from "./geom";
import type { StreetHit } from "./streets";

/** Heuristic: an edge can only be a front edge if a DCM centerline passes within this distance of its midpoint.
 *  Half of a 100-120 ft street is 50-60 ft, so 60 ft covers mapped widths up to ~120 ft. Tune with eval data. */
export const FRONT_STREET_MAX_DISTANCE_FT = 60;
/** Heuristic: how far outside the edge we probe to test whether another tax lot is adjacent. */
export const OUTWARD_PROBE_FT = 3;
/** Heuristic: a street counts as "along" an edge when the angle between them is within this many degrees. */
export const STREET_PARALLEL_TOLERANCE_DEG = 35;
/** Heuristic: non-front edges within this many degrees of anti-parallel to the front edge are "rear". */
export const REAR_ANTIPARALLEL_TOLERANCE_DEG = 25;

const cosDeg = (d: number) => Math.cos((d * Math.PI) / 180);

export interface RawEdge { index: number; from: [number, number]; to: [number, number]; lengthFt: number }

/** Edges of the normalised (CCW, unclosed) ring; edge i runs vertex i -> i+1. */
export function lotEdges(ring2263: Ring): RawEdge[] {
  const r = normalizeRing(ring2263);
  return r.map((from, i) => {
    const to = r[(i + 1) % r.length];
    return { index: i, from, to, lengthFt: dist(from, to) };
  });
}

export const edgeMidpoint = (e: { from: [number, number]; to: [number, number] }): [number, number] =>
  [(e.from[0] + e.to[0]) / 2, (e.from[1] + e.to[1]) / 2];

const unit = (e: RawEdge): [number, number] => [(e.to[0] - e.from[0]) / (e.lengthFt || 1), (e.to[1] - e.from[1]) / (e.lengthFt || 1)];
const dot = (a: [number, number], b: [number, number]) => a[0] * b[0] + a[1] * b[1];

/** Outward probe point: CCW ring => interior is to the left, so outward is the right-hand normal (dy, -dx). */
export function outwardPoint(e: RawEdge, offsetFt = OUTWARD_PROBE_FT): [number, number] {
  const m = edgeMidpoint(e);
  const u = unit(e);
  return [m[0] + u[1] * offsetFt, m[1] - u[0] * offsetFt];
}

/**
 * @param streetsByEdge streets near each edge midpoint, index-aligned with lotEdges(ring2263) (see site.ts)
 */
export function classifyEdges(ring2263: Ring, neighborRings2263: Ring[], streetsByEdge: StreetHit[][]): LotEdge[] {
  const raw = lotEdges(ring2263);
  const parCos = cosDeg(STREET_PARALLEL_TOLERANCE_DEG);

  const frontStreet: (StreetHit | null)[] = raw.map((e) => {
    const outside = outwardPoint(e);
    if (neighborRings2263.some((n) => pointInRing(outside, n))) return null;
    const near = (streetsByEdge[e.index] ?? []).filter((s) => s.distanceFt <= FRONT_STREET_MAX_DISTANCE_FT);
    const u = unit(e);
    // nearest street that runs along the edge (direction unknown => accept)
    return near.find((s) => !s.direction || Math.abs(dot(u, s.direction)) >= parCos) ?? null;
  });

  const frontIdx = raw.filter((e) => frontStreet[e.index]).map((e) => e.index);
  if (frontIdx.length === 0) {
    return raw.map((e) => ({ ...e, kind: "unknown" as const, street: null }));
  }

  // single-frontage lot: every front edge points roughly the same way as the longest front edge
  const ref = frontIdx.map((i) => raw[i]).sort((a, b) => b.lengthFt - a.lengthFt)[0];
  const refU = unit(ref);
  const singleFrontage = frontIdx.every((i) => dot(unit(raw[i]), refU) >= parCos);

  const rear = new Set<number>();
  if (singleFrontage) {
    const antiCos = -cosDeg(REAR_ANTIPARALLEL_TOLERANCE_DEG);
    const cands = raw.filter((e) => !frontStreet[e.index]);
    const scored = cands.map((e) => ({ i: e.index, d: dot(unit(e), refU) }));
    for (const c of scored) if (c.d <= antiCos) rear.add(c.i);
    if (rear.size === 0 && scored.length) {
      const best = scored.reduce((a, b) => (b.d < a.d ? b : a));
      if (best.d < -0.5) rear.add(best.i); // "most anti-parallel" fallback for skewed lots
    }
  }

  return raw.map((e) => {
    const s = frontStreet[e.index];
    const kind = s ? "front" : rear.has(e.index) ? "rear" : "side";
    // strip the internal `direction` helper from the public StreetSegment
    let street: LotEdge["street"] = null;
    if (s) {
      const { direction, ...rest } = s;
      void direction;
      street = rest;
    }
    return { ...e, kind, street };
  });
}
