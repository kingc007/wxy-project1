// Sun & shadow (spec §8). Pure TS, no three.js. Study-grade, not a certified daylight analysis.
// suncalc 2.1.1 (node_modules/suncalc/index.d.ts:2-13): all angles in DEGREES, azimuth clockwise from NORTH
// (0=N, 90=E, 180=S, 270=W), altitude = apparent altitude above horizon; Dates are UTC instants.
import { getPosition } from "suncalc";
import type { Polygon, Prism, Vec2 } from "./types";

export type Vec3 = [number, number, number];
/** Local frame: x east, y north, z up. `dir` is a unit vector pointing FROM the ground TOWARD the sun. */
export interface SunVector {
  azimuthDeg: number;
  altitudeDeg: number;
  dir: Vec3;
}
export interface SunSample extends SunVector {
  /** UTC instant sampled. */
  date: Date;
  /** Hours of daylight this sample represents (stepMin / 60). */
  hours: number;
}
export type ShadowPrism = Pick<Prism, "polygon" | "z0" | "z1">;

const DEG = Math.PI / 180;

export function sunVector(date: Date, lat: number, lng: number): SunVector {
  const { azimuth, altitude } = getPosition(date, lat, lng);
  const az = azimuth * DEG;
  const alt = altitude * DEG;
  // azimuth is clockwise from north: east = sin(az), north = cos(az).
  const dir: Vec3 = [Math.cos(alt) * Math.sin(az), Math.cos(alt) * Math.cos(az), Math.sin(alt)];
  return { azimuthDeg: azimuth, altitudeDeg: altitude, dir };
}

// ---------- presets (America/New_York) ----------
export const SUN_TIME_ZONE = "America/New_York";
/** Year used for the presets; any non-leap-sensitive fixed year keeps results deterministic. */
export const SUN_YEAR = 2026;

export interface SunPreset {
  id: "mar21" | "jun21" | "dec21";
  label: string;
  month: number; // 1-12
  day: number;
}
export const SUN_PRESETS: readonly SunPreset[] = [
  { id: "mar21", label: "Mar 21 (equinox)", month: 3, day: 21 },
  { id: "jun21", label: "Jun 21 (summer solstice)", month: 6, day: 21 },
  { id: "dec21", label: "Dec 21 (winter solstice)", month: 12, day: 21 },
] as const;

/** Offset (ms, local minus UTC) of `timeZone` at the UTC instant `utcMs`, via Intl (independent of the machine's TZ). */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * The UTC instant at which the wall clock in `timeZone` reads y-m-d h:min. DST-correct: start from the naive
 * UTC guess, subtract the zone offset found at that guess, then re-evaluate the offset once at the corrected
 * instant (handles dates adjacent to a DST change). E.g. Jun 21 12:00 New York = 16:00 UTC (EDT, UTC-4);
 * Dec 21 12:00 = 17:00 UTC (EST, UTC-5).
 */
export function zonedTimeToUtc(y: number, month: number, d: number, h = 0, min = 0, timeZone = SUN_TIME_ZONE): Date {
  const naive = Date.UTC(y, month - 1, d, h, min, 0);
  let utc = naive - zoneOffsetMs(naive, timeZone);
  utc = naive - zoneOffsetMs(utc, timeZone);
  return new Date(utc);
}

/** Local midnight (start of the civil day) of a preset, as a UTC instant. */
export function presetDayStart(p: SunPreset, year = SUN_YEAR, timeZone = SUN_TIME_ZONE): Date {
  return zonedTimeToUtc(year, p.month, p.day, 0, 0, timeZone);
}
/** Local clock time of a preset (default 12:00), as a UTC instant. */
export function presetTime(p: SunPreset, hour = 12, minute = 0, year = SUN_YEAR, timeZone = SUN_TIME_ZONE): Date {
  return zonedTimeToUtc(year, p.month, p.day, hour, minute, timeZone);
}

/**
 * Daylight samples for the 24 h starting at `dayStart` (pass a local-midnight instant, e.g. presetDayStart),
 * every `stepMin` minutes, at the centre of each step; only samples with altitude > 0 are returned, so
 * Σ hours = (count of sunlit steps) × stepMin / 60 (sunrise → sunset).
 */
export function daySamples(dayStart: Date, lat: number, lng: number, stepMin = 15): SunSample[] {
  const out: SunSample[] = [];
  const stepMs = stepMin * 60_000;
  const n = Math.round((24 * 60) / stepMin);
  for (let i = 0; i < n; i++) {
    const date = new Date(dayStart.getTime() + (i + 0.5) * stepMs);
    const sv = sunVector(date, lat, lng);
    if (sv.altitudeDeg > 0) out.push({ ...sv, date, hours: stepMin / 60 });
  }
  return out;
}

// ---------- geometry helpers ----------
function pointInRing(x: number, y: number, ring: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function pointInPolygon(x: number, y: number, poly: Polygon): boolean {
  if (!pointInRing(x, y, poly.outer)) return false;
  return !poly.holes.some((h) => pointInRing(x, y, h));
}

/** Grid points (cell centres, `spacingFt` apart) inside the polygon and outside its holes, at elevation z. */
export function gridPoints(polygon: Polygon, spacingFt = 5, z = 0): Vec3[] {
  const xs = polygon.outer.map((p) => p[0]);
  const ys = polygon.outer.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pts: Vec3[] = [];
  for (let y = minY + spacingFt / 2; y < maxY; y += spacingFt) {
    for (let x = minX + spacingFt / 2; x < maxX; x += spacingFt) {
      if (pointInPolygon(x, y, polygon)) pts.push([x, y, z]);
    }
  }
  return pts;
}

/**
 * t-intervals (t > 0 only, t in feet along the horizontal unit ray) where the ray from (px,py) in direction
 * (ux,uy) lies inside the polygon (even-odd across the outer ring and holes). A start point already inside
 * yields an interval beginning at t = 0.
 */
function insideIntervals(px: number, py: number, ux: number, uy: number, poly: Polygon): [number, number][] {
  const ts: number[] = [];
  for (const ring of [poly.outer, ...poly.holes]) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      // signed side of each endpoint relative to the ray line; half-open rule avoids double-counting vertices
      const sa = ux * (a[1] - py) - uy * (a[0] - px);
      const sb = ux * (b[1] - py) - uy * (b[0] - px);
      if ((sa > 0) === (sb > 0)) continue;
      const f = sa / (sa - sb);
      const ix = a[0] + f * (b[0] - a[0]);
      const iy = a[1] + f * (b[1] - a[1]);
      ts.push(ux * (ix - px) + uy * (iy - py));
    }
  }
  ts.sort((m, n) => m - n);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < ts.length; i += 2) {
    const lo = Math.max(ts[i], 0);
    const hi = ts[i + 1];
    if (hi > lo) out.push([lo, hi]);
  }
  return out;
}

const EPS = 1e-6;

/** True if the sun (direction `dir`, from ground toward sun) is blocked at `point` by any prism, or is below the horizon. */
export function isShadowed(point: Vec3, dir: Vec3, prisms: ShadowPrism[]): boolean {
  const [dx, dy, dz] = dir;
  if (dz <= 0) return true;
  const h = Math.hypot(dx, dy);
  const tanAlt = dz / h;
  if (h < 1e-12) {
    // sun at the zenith: blocked only if the point is under a prism
    return prisms.some((pr) => pointInPolygon(point[0], point[1], pr.polygon) && point[2] < pr.z1 - EPS);
  }
  const ux = dx / h;
  const uy = dy / h;
  for (const pr of prisms) {
    for (const [ta, tb] of insideIntervals(point[0], point[1], ux, uy, pr.polygon)) {
      const hLo = point[2] + ta * tanAlt;
      const hHi = point[2] + tb * tanAlt;
      if (hLo < pr.z1 - EPS && hHi > pr.z0 + EPS) return true;
    }
  }
  return false;
}

/** Sunlit hours per point: Σ hours of samples with altitude > 0 and no obstruction. */
export function sunHours(points: Vec3[], prisms: ShadowPrism[], samples: SunSample[]): number[] {
  return points.map((p) => {
    let total = 0;
    for (const s of samples) {
      if (s.altitudeDeg <= 0) continue;
      if (!isShadowed(p, s.dir, prisms)) total += s.hours;
    }
    return total;
  });
}

export function meanSunHours(points: Vec3[], prisms: ShadowPrism[], samples: SunSample[]): number {
  if (points.length === 0) return 0;
  const hrs = sunHours(points, prisms, samples);
  return hrs.reduce((a, b) => a + b, 0) / hrs.length;
}
