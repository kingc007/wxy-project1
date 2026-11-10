// 2D geometry on plain Polygon / MultiPolygon data. Booleans and offsets run on manifold-3d CrossSection (Clipper2).
// Verified against node_modules/manifold-3d/manifold.d.ts v3.5.4:
//   Module(config?: {locateFile}) : Promise<ManifoldToplevel>           (line ~1520)
//   ManifoldToplevel.setup()                                           (line ~1260)
//   new CrossSection(contours, fillRule?)  - union with 'Positive' rule  (line 45)
//   CrossSection.add/subtract/intersect/offset/decompose/toPolygons/isEmpty/delete (lines 189-365)
// Winding: with the default 'Positive' fill rule the outer ring must be CCW and holes CW (checked at runtime:
// a CW outer gives area 0, a CCW hole is swallowed by the union). All inputs are normalised here.
// Memory: every WASM object is tracked by a Scope and deleted in a finally block.
import type { CrossSection, ManifoldToplevel } from "manifold-3d";
import type { MultiPolygon, Polygon, Vec2 } from "./types";

// ---------- module init ----------
let api: ManifoldToplevel | null = null;
let initPromise: Promise<void> | null = null;

/** Await once before any other geometry call. `locateFile` lets a browser/worker build point at manifold.wasm. */
export function initGeometry(opts?: { locateFile?: () => string }): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      // Dynamic import: manifold-3d only exports an "import" condition, so a static import breaks CommonJS consumers
      // (tsx scripts, CJS bundles) with ERR_PACKAGE_PATH_NOT_EXPORTED.
      const { default: Module } = await import("manifold-3d");
      const m = await Module(opts?.locateFile ? { locateFile: opts.locateFile } : undefined);
      m.setup();
      api = m;
    })().catch((e) => {
      initPromise = null;
      throw e;
    });
  }
  return initPromise;
}

function wasm(): ManifoldToplevel {
  if (!api) throw new Error("initGeometry() must be awaited before calling geometry functions.");
  return api;
}

// ---------- memory scope ----------
let live = 0;
/** Number of WASM geometry objects currently alive (for leak tests). Should be 0 between calls. */
export function liveGeometryObjects(): number {
  return live;
}

class Scope {
  private items: { delete(): void }[] = [];
  track<T extends { delete(): void }>(x: T): T {
    this.items.push(x);
    live++;
    return x;
  }
  free(): void {
    for (const it of this.items) {
      try {
        it.delete();
      } finally {
        live--;
      }
    }
    this.items = [];
  }
}

function withScope<T>(fn: (s: Scope) => T): T {
  const s = new Scope();
  try {
    return fn(s);
  } finally {
    s.free();
  }
}

// ---------- ring helpers (pure JS) ----------
export const EPS_AREA = 1e-7;

export function ringSignedArea(r: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i];
    const q = r[(i + 1) % r.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function ringPerimeter(r: readonly Vec2[]): number {
  let l = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i];
    const q = r[(i + 1) % r.length];
    l += Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  return l;
}

function dropClosing(r: readonly Vec2[]): Vec2[] {
  const out = r.map((p) => [p[0], p[1]] as Vec2);
  if (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) out.pop();
  }
  return out;
}

/** Outer CCW, holes CW, unclosed rings. Returns null for degenerate polygons. */
export function normalizePolygon(p: Polygon): Polygon | null {
  let outer = dropClosing(p.outer);
  if (outer.length < 3) return null;
  const oa = ringSignedArea(outer);
  if (Math.abs(oa) < EPS_AREA) return null;
  if (oa < 0) outer = outer.reverse();
  const holes: Vec2[][] = [];
  for (const h of p.holes) {
    let r = dropClosing(h);
    if (r.length < 3) continue;
    const ha = ringSignedArea(r);
    if (Math.abs(ha) < EPS_AREA) continue;
    if (ha > 0) r = r.reverse();
    holes.push(r);
  }
  return { outer, holes };
}

export function polygonArea(p: Polygon): number {
  let a = Math.abs(ringSignedArea(p.outer));
  for (const h of p.holes) a -= Math.abs(ringSignedArea(h));
  return a;
}

export function area(mp: MultiPolygon): number {
  let a = 0;
  for (const p of mp) a += polygonArea(p);
  return a;
}

export function perimeter(mp: MultiPolygon): number {
  let l = 0;
  for (const p of mp) {
    l += ringPerimeter(p.outer);
    for (const h of p.holes) l += ringPerimeter(h);
  }
  return l;
}

export function isEmpty(mp: MultiPolygon): boolean {
  return mp.length === 0 || area(mp) < EPS_AREA;
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bbox(mp: MultiPolygon): BBox | null {
  let b: BBox | null = null;
  for (const p of mp) {
    for (const [x, y] of p.outer) {
      if (!b) b = { minX: x, minY: y, maxX: x, maxY: y };
      else {
        if (x < b.minX) b.minX = x;
        if (y < b.minY) b.minY = y;
        if (x > b.maxX) b.maxX = x;
        if (y > b.maxY) b.maxY = y;
      }
    }
  }
  return b;
}

/** Stable string key of a polygon set (coordinates rounded to 1e-4 ft). */
export function mpKey(mp: MultiPolygon): string {
  const f = (r: readonly Vec2[]) => r.map((p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join(";");
  return mp.map((p) => f(p.outer) + (p.holes.length ? "|" + p.holes.map(f).join("|") : "")).join("#");
}

export function polygonKey(p: Polygon): string {
  return mpKey([p]);
}

function pointInRing(pt: Vec2, r: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---------- CrossSection bridge ----------
function contoursOf(mp: MultiPolygon): Vec2[][] {
  const out: Vec2[][] = [];
  for (const raw of mp) {
    const p = normalizePolygon(raw);
    if (!p) continue;
    out.push(p.outer);
    for (const h of p.holes) out.push(h);
  }
  return out;
}

function csFrom(s: Scope, mp: MultiPolygon): CrossSection | null {
  const contours = contoursOf(mp);
  if (!contours.length) return null;
  return s.track(new (wasm().CrossSection)(contours, "Positive"));
}

function groupRings(rings: Vec2[][]): MultiPolygon {
  const outers: { ring: Vec2[]; holes: Vec2[][]; area: number }[] = [];
  const holes: Vec2[][] = [];
  for (const r of rings) {
    const a = ringSignedArea(r);
    if (a > 0) outers.push({ ring: r, holes: [], area: a });
    else if (a < 0) holes.push(r);
  }
  for (const h of holes) {
    let best: (typeof outers)[number] | null = null;
    for (const o of outers) {
      if (pointInRing(h[0], o.ring) || pointInRing(centroidOf(h), o.ring)) {
        if (!best || o.area < best.area) best = o;
      }
    }
    if (best) best.holes.push(h);
  }
  return outers
    .filter((o) => o.area - o.holes.reduce((t, h) => t + Math.abs(ringSignedArea(h)), 0) > EPS_AREA)
    .map((o) => ({ outer: o.ring, holes: o.holes }));
}

function centroidOf(r: readonly Vec2[]): Vec2 {
  let x = 0;
  let y = 0;
  for (const p of r) {
    x += p[0];
    y += p[1];
  }
  return [x / r.length, y / r.length];
}

function fromCS(s: Scope, c: CrossSection | null): MultiPolygon {
  if (!c || c.isEmpty()) return [];
  const out: MultiPolygon = [];
  for (const comp of c.decompose()) {
    s.track(comp);
    for (const p of groupRings(comp.toPolygons() as Vec2[][])) out.push(p);
  }
  return out;
}

// ---------- booleans & offset ----------
export function union(...lists: MultiPolygon[]): MultiPolygon {
  const all: MultiPolygon = [];
  for (const l of lists) for (const p of l) all.push(p);
  if (!all.length) return [];
  return withScope((s) => fromCS(s, csFrom(s, all)));
}

export function intersect(a: MultiPolygon, b: MultiPolygon): MultiPolygon {
  if (isEmpty(a) || isEmpty(b)) return [];
  return withScope((s) => {
    const A = csFrom(s, a);
    const B = csFrom(s, b);
    if (!A || !B) return [];
    return fromCS(s, s.track(A.intersect(B)));
  });
}

export function difference(a: MultiPolygon, b: MultiPolygon): MultiPolygon {
  if (isEmpty(a)) return [];
  if (isEmpty(b)) return a.map((p) => normalizePolygon(p)).filter((p): p is Polygon => p !== null);
  return withScope((s) => {
    const A = csFrom(s, a);
    const B = csFrom(s, b);
    if (!A) return [];
    if (!B) return fromCS(s, A);
    return fromCS(s, s.track(A.subtract(B)));
  });
}

/** Area of a ∩ b without materialising the result back to JS rings beyond what is needed. */
export function intersectionArea(a: MultiPolygon, b: MultiPolygon): number {
  return area(intersect(a, b));
}

/** Inward offset by d ft (mitred corners). d <= 0 returns a normalised copy. Courtyard inset / yard studies. */
export function inset(mp: MultiPolygon, d: number): MultiPolygon {
  if (isEmpty(mp)) return [];
  if (d <= 0) return mp.map((p) => normalizePolygon(p)).filter((p): p is Polygon => p !== null);
  return withScope((s) => {
    const A = csFrom(s, mp);
    if (!A) return [];
    return fromCS(s, s.track(A.offset(-d, "Miter")));
  });
}

// ---------- constructors ----------
export function rectPolygon(x0: number, y0: number, x1: number, y1: number): Polygon {
  const lx = Math.min(x0, x1);
  const hx = Math.max(x0, x1);
  const ly = Math.min(y0, y1);
  const hy = Math.max(y0, y1);
  return {
    outer: [
      [lx, ly],
      [hx, ly],
      [hx, hy],
      [lx, hy],
    ],
    holes: [],
  };
}

/** Local design frame: origin, unit u along the frontage, unit v = left (inward) normal. */
export interface Frame {
  origin: Vec2;
  u: Vec2;
  v: Vec2;
}

export function makeFrame(a: Vec2, b: Vec2): Frame {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy);
  if (l === 0) throw new Error("makeFrame: zero-length edge");
  const u: Vec2 = [dx / l, dy / l];
  return { origin: [a[0], a[1]], u, v: [-u[1], u[0]] };
}

export function fromFrame(f: Frame, p: Vec2): Vec2 {
  return [f.origin[0] + p[0] * f.u[0] + p[1] * f.v[0], f.origin[1] + p[0] * f.u[1] + p[1] * f.v[1]];
}

export function toFrame(f: Frame, p: Vec2): Vec2 {
  const dx = p[0] - f.origin[0];
  const dy = p[1] - f.origin[1];
  return [dx * f.u[0] + dy * f.u[1], dx * f.v[0] + dy * f.v[1]];
}

/** Axis-aligned rectangle in frame coordinates (u0..u1 along the street, v0..v1 into the lot) as a world polygon. */
export function rectFromFrame(f: Frame, u0: number, u1: number, v0: number, v1: number): Polygon {
  const lu = Math.min(u0, u1);
  const hu = Math.max(u0, u1);
  const lv = Math.min(v0, v1);
  const hv = Math.max(v0, v1);
  return {
    outer: [fromFrame(f, [lu, lv]), fromFrame(f, [hu, lv]), fromFrame(f, [hu, hv]), fromFrame(f, [lu, hv])],
    holes: [],
  };
}

/** Rectangle (long x short, long side along u at rot 0) rotated by `deg` about (cu, cv), in frame coordinates. */
export function orientedRectFromFrame(f: Frame, cu: number, cv: number, long: number, short: number, deg: number): Polygon {
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const hl = long / 2;
  const hs = short / 2;
  const corners: Vec2[] = [
    [-hl, -hs],
    [hl, -hs],
    [hl, hs],
    [-hl, hs],
  ];
  return {
    outer: corners.map(([x, y]) => fromFrame(f, [cu + x * c - y * s, cv + x * s + y * c])),
    holes: [],
  };
}

export interface FrameBox {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

export function bboxInFrame(f: Frame, mp: MultiPolygon): FrameBox | null {
  let b: FrameBox | null = null;
  for (const p of mp) {
    for (const pt of p.outer) {
      const [u, v] = toFrame(f, pt);
      if (!b) b = { u0: u, u1: u, v0: v, v1: v };
      else {
        if (u < b.u0) b.u0 = u;
        if (u > b.u1) b.u1 = u;
        if (v < b.v0) b.v0 = v;
        if (v > b.v1) b.v1 = v;
      }
    }
  }
  return b;
}

/**
 * Rectangle on the left (inward, for a CCW lot) side of edge a->b, depth d, extended along the edge line by
 * extendA before a and extendB after b (spec §1: d at convex vertices, 0 at reflex vertices).
 */
export function strip(a: Vec2, b: Vec2, d: number, extendA = 0, extendB = 0): Polygon {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy);
  if (l === 0 || d <= 0) return { outer: [], holes: [] };
  const t: Vec2 = [dx / l, dy / l];
  const n: Vec2 = [-t[1], t[0]];
  const a2: Vec2 = [a[0] - t[0] * extendA, a[1] - t[1] * extendA];
  const b2: Vec2 = [b[0] + t[0] * extendB, b[1] + t[1] * extendB];
  return {
    outer: [a2, b2, [b2[0] + n[0] * d, b2[1] + n[1] * d], [a2[0] + n[0] * d, a2[1] + n[1] * d]],
    holes: [],
  };
}
