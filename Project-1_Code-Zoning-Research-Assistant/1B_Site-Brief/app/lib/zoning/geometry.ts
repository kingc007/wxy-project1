import type { LotEdge, Ring } from "../types";

const EPS = 0.01; // feet

export function openRing(ring: Ring): Ring {
  if (ring.length > 1) {
    const [a, b] = [ring[0], ring[ring.length - 1]];
    if (Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9) return ring.slice(0, -1);
  }
  return ring.slice();
}

/** Shoelace signed area; positive = counter-clockwise. */
export function signedArea(ring: Ring): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

const same = (p: [number, number], q: [number, number]) => Math.abs(p[0] - q[0]) < EPS && Math.abs(p[1] - q[1]) < EPS;

export interface LocalGeometry {
  origin: { x: number; y: number };
  polygonReference: Ring; // CCW, unclosed, EPSG:2263
  polygonLocal: Ring;
  /** site edges re-indexed to the normalised ring (edge i = point i -> point i+1) */
  edges: LotEdge[];
}

/** Normalise the ring (unclosed, CCW), compute local coordinates and re-index edges by coordinate match. */
export function buildLocalGeometry(ring2263: Ring, siteEdges: LotEdge[]): LocalGeometry | null {
  let ring = openRing(ring2263);
  if (ring.length < 3) return null;
  if (signedArea(ring) < 0) ring = ring.slice().reverse();
  const ox = Math.min(...ring.map((p) => p[0]));
  const oy = Math.min(...ring.map((p) => p[1]));
  const edges: LotEdge[] = ring.map((from, i) => {
    const to = ring[(i + 1) % ring.length];
    const match = siteEdges.find((e) => (same(e.from, from) && same(e.to, to)) || (same(e.from, to) && same(e.to, from)));
    const lengthFt = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (!match) return { index: i, from, to, lengthFt, kind: "unknown" as const, street: null };
    return { ...match, index: i, from, to, lengthFt };
  });
  return {
    origin: { x: ox, y: oy },
    polygonReference: ring,
    polygonLocal: ring.map(([x, y]) => [x - ox, y - oy] as [number, number]),
    edges,
  };
}
