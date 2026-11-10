// Courtyard sun-hours study (spec §8): analytic shadow test from lib/massing/sun.ts, sampled on a grid.
// Study-grade, not a certified daylight analysis. Runs in time slices (never blocks a frame for long).
import {
  daySamples,
  difference,
  gridPoints,
  meanSunHours,
  presetDayStart,
  presetTime,
  sunVector,
  SUN_PRESETS,
  type MassingOption,
  type EnvelopeModel,
  type MultiPolygon,
  type Polygon,
  type SunPreset,
  type SunSample,
  type Vec3,
} from "@wxy/massing";
import type { ContextBuilding } from "@/components/viewer/types";

export const MAX_GRID_POINTS = 300;
/** Context buildings further than this from the lot's bounding box can't shade it meaningfully (study-grade cut-off). */
export const CONTEXT_RADIUS_FT = 600;

function ringCcw(ring: [number, number][]): [number, number][] {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    a += x0 * y1 - x1 * y0;
  }
  return a < 0 ? [...ring].reverse() : ring;
}

/**
 * The courtyard: ground-floor voids (holes in prisms that include floor 0) if any, else the open space at grade
 * inside the lot (lot minus the ground-floor plate). Needs initGeometry() for the second case.
 */
export function courtyardAreas(option: MassingOption, model: EnvelopeModel): { polygons: MultiPolygon; kind: "voids" | "open-space" } {
  const ground = option.prisms.filter((p) => p.floors.includes(0));
  const voids: Polygon[] = [];
  for (const p of ground) for (const h of p.polygon.holes) voids.push({ outer: ringCcw(h), holes: [] });
  if (voids.length) return { polygons: voids, kind: "voids" };
  const plate = option.floors[0]?.polygons ?? [];
  return { polygons: plate.length ? difference([model.lot], plate) : [model.lot], kind: "open-space" };
}

export function courtyardPoints(polys: MultiPolygon): Vec3[] {
  const area = polys.reduce((s, p) => s + Math.abs(ringArea(p.outer)) - p.holes.reduce((h, r) => h + Math.abs(ringArea(r)), 0), 0);
  if (area <= 0) return [];
  const spacing = Math.max(5, Math.sqrt(area / MAX_GRID_POINTS));
  return polys.flatMap((p) => gridPoints(p, spacing, 0));
}

function ringArea(r: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const [x0, y0] = r[i];
    const [x1, y1] = r[(i + 1) % r.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

/** Context buildings close enough to matter, as shadow prisms. */
export function nearbyShadowers(context: ContextBuilding[], model: EnvelopeModel): { polygon: Polygon; z0: number; z1: number }[] {
  const xs = model.lot.outer.map((p) => p[0]);
  const ys = model.lot.outer.map((p) => p[1]);
  const x0 = Math.min(...xs) - CONTEXT_RADIUS_FT;
  const x1 = Math.max(...xs) + CONTEXT_RADIUS_FT;
  const y0 = Math.min(...ys) - CONTEXT_RADIUS_FT;
  const y1 = Math.max(...ys) + CONTEXT_RADIUS_FT;
  return context
    .filter((c) => c.polygon.outer.some(([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1))
    .map((c) => ({ polygon: c.polygon, z0: 0, z1: c.height }));
}

export interface SunStudyInput {
  option: MassingOption;
  model: EnvelopeModel;
  context: ContextBuilding[];
  preset: SunPreset;
  lat: number;
  lng: number;
}

export interface SunStudyResult {
  /** Mean sunlit hours over the courtyard grid; null if there is no courtyard / open space at grade. */
  hours: number | null;
  kind: "voids" | "open-space";
  points: number;
}

/** Synchronous version (tests, small cases). */
export function courtyardSunHoursSync(inp: SunStudyInput): SunStudyResult {
  const { polygons, kind } = courtyardAreas(inp.option, inp.model);
  const pts = courtyardPoints(polygons);
  if (!pts.length) return { hours: null, kind, points: 0 };
  const samples = daySamples(presetDayStart(inp.preset), inp.lat, inp.lng, 15);
  const prisms = [...inp.option.prisms, ...nearbyShadowers(inp.context, inp.model)];
  return { hours: meanSunHours(pts, prisms, samples), kind, points: pts.length };
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/**
 * Same result as the sync version, computed in ~8 ms slices so the UI stays responsive.
 * `isCancelled()` is polled between slices; a cancelled run resolves to null.
 */
export async function courtyardSunHours(inp: SunStudyInput, isCancelled: () => boolean): Promise<SunStudyResult | null> {
  const { polygons, kind } = courtyardAreas(inp.option, inp.model);
  const pts = courtyardPoints(polygons);
  if (!pts.length) return { hours: null, kind, points: 0 };
  const samples: SunSample[] = daySamples(presetDayStart(inp.preset), inp.lat, inp.lng, 15);
  const prisms = [...inp.option.prisms, ...nearbyShadowers(inp.context, inp.model)];
  let sum = 0;
  let i = 0;
  while (i < pts.length) {
    const t0 = performance.now();
    while (i < pts.length && performance.now() - t0 < 8) {
      sum += meanSunHours([pts[i]], prisms, samples);
      i++;
    }
    if (isCancelled()) return null;
    await tick();
    if (isCancelled()) return null;
  }
  return { hours: sum / pts.length, kind, points: pts.length };
}

// ---------- scrubber ----------
const rangeCache = new Map<string, [number, number]>();

/** [first, last] daylight minute (multiples of 15, local time) of a preset day. */
export function daylightRange(preset: SunPreset, lat: number, lng: number): [number, number] {
  const key = `${preset.id}|${lat}|${lng}`;
  const hit = rangeCache.get(key);
  if (hit) return hit;
  let first = -1;
  let last = -1;
  for (let m = 0; m < 24 * 60; m += 15) {
    const sv = sunVector(presetTime(preset, Math.floor(m / 60), m % 60), lat, lng);
    if (sv.altitudeDeg > 0) {
      if (first < 0) first = m;
      last = m;
    }
  }
  const r: [number, number] = first < 0 ? [720, 720] : [first, last];
  rangeCache.set(key, r);
  return r;
}

export function sunAt(preset: SunPreset, minutes: number, lat: number, lng: number) {
  return sunVector(presetTime(preset, Math.floor(minutes / 60), minutes % 60), lat, lng);
}

export function presetById(id: SunPreset["id"]): SunPreset {
  return SUN_PRESETS.find((p) => p.id === id) ?? SUN_PRESETS[0];
}
