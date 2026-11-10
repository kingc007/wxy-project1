import { describe, expect, it } from "vitest";
import {
  SUN_PRESETS,
  daySamples,
  gridPoints,
  isShadowed,
  meanSunHours,
  presetDayStart,
  presetTime,
  sunHours,
  sunVector,
  zonedTimeToUtc,
  type ShadowPrism,
  type Vec3,
} from "../sun";
import type { Polygon } from "../types";

// Test-fixture reference point only (approximate mid-latitude NYC-like site); not a verified research value.
const LAT = 40.7;
const LNG = -74;

const rect = (x0: number, y0: number, x1: number, y1: number): Polygon => ({
  outer: [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ],
  holes: [],
});
const altDir = (altDeg: number, azDeg: number): Vec3 => {
  const a = (altDeg * Math.PI) / 180;
  const z = (azDeg * Math.PI) / 180;
  return [Math.cos(a) * Math.sin(z), Math.cos(a) * Math.cos(z), Math.sin(a)];
};
const maxAlt = (p: (typeof SUN_PRESETS)[number]) =>
  Math.max(...daySamples(presetDayStart(p), LAT, LNG, 5).map((s) => s.altitudeDeg));
const preset = (id: string) => SUN_PRESETS.find((p) => p.id === id)!;

describe("sunVector / presets", () => {
  it("builds unit vectors with x east, y north, z up", () => {
    const s = sunVector(presetTime(preset("jun21")), LAT, LNG);
    expect(Math.hypot(...s.dir)).toBeCloseTo(1, 9);
    expect(s.dir[2]).toBeCloseTo(Math.sin((s.altitudeDeg * Math.PI) / 180), 9);
    // northern hemisphere at local noon: sun is south (negative y)
    expect(s.dir[1]).toBeLessThan(0);
  });
  it("morning sun is in the east, afternoon in the west", () => {
    const am = sunVector(presetTime(preset("mar21"), 9), LAT, LNG);
    const pm = sunVector(presetTime(preset("mar21"), 15), LAT, LNG);
    expect(am.dir[0]).toBeGreaterThan(0);
    expect(pm.dir[0]).toBeLessThan(0);
  });
  it("converts New York wall-clock time to UTC with DST", () => {
    expect(zonedTimeToUtc(2026, 6, 21, 12).toISOString()).toBe("2026-06-21T16:00:00.000Z"); // EDT, UTC-4
    expect(zonedTimeToUtc(2026, 12, 21, 12).toISOString()).toBe("2026-12-21T17:00:00.000Z"); // EST, UTC-5
    expect(zonedTimeToUtc(2026, 3, 21, 0).toISOString()).toBe("2026-03-21T04:00:00.000Z"); // EDT after Mar spring-forward
  });
  it("summer solstice noon altitude exceeds winter solstice", () => {
    expect(maxAlt(preset("jun21"))).toBeGreaterThan(maxAlt(preset("mar21")));
    expect(maxAlt(preset("mar21"))).toBeGreaterThan(maxAlt(preset("dec21")));
  });
  it("is deterministic", () => {
    const d = presetTime(preset("dec21"), 10);
    expect(sunVector(d, LAT, LNG)).toEqual(sunVector(d, LAT, LNG));
    expect(daySamples(presetDayStart(preset("jun21")), LAT, LNG)).toEqual(daySamples(presetDayStart(preset("jun21")), LAT, LNG));
  });
});

describe("isShadowed", () => {
  // wall along x, y 0..10, 100 ft tall; sun due south (azimuth 180) at 45 degrees
  const wall: ShadowPrism = { polygon: rect(-100, 0, 100, 10), z0: 0, z1: 100 };
  const sunS = altDir(45, 180);
  it("north of the wall is shadowed within the shadow length, sunlit beyond it", () => {
    expect(isShadowed([0, 50, 0], sunS, [wall])).toBe(true);
    expect(isShadowed([0, 200, 0], sunS, [wall])).toBe(false);
  });
  it("south of the wall (sun in front) is not shadowed", () => {
    expect(isShadowed([0, -20, 0], sunS, [wall])).toBe(false);
  });
  it("a point above the wall top is not shadowed", () => {
    expect(isShadowed([0, 50, 120], sunS, [wall])).toBe(false);
  });
  it("a real winter-noon sun shadows the north side and not the south side of a tall wall", () => {
    const noon = daySamples(presetDayStart(preset("dec21")), LAT, LNG, 5).reduce((a, b) => (b.altitudeDeg > a.altitudeDeg ? b : a));
    const tall: ShadowPrism = { polygon: rect(-100, 0, 100, 10), z0: 0, z1: 200 };
    expect(isShadowed([0, 30, 0], noon.dir, [tall])).toBe(true);
    expect(isShadowed([0, -30, 0], noon.dir, [tall])).toBe(false);
  });
  it("sun below the horizon is always shadowed", () => {
    expect(isShadowed([0, -20, 0], [0, -0.7, -0.7], [])).toBe(true);
    expect(isShadowed([0, -20, 0], [0, -1, 0], [])).toBe(true);
  });
  it("a point inside a solid footprint is shadowed", () => {
    const solid: ShadowPrism = { polygon: rect(0, 0, 100, 100), z0: 0, z1: 100 };
    expect(isShadowed([50, 50, 0], altDir(85, 180), [solid])).toBe(true);
  });
  it("holes: a courtyard point is lit under a steep sun and shadowed under a low one", () => {
    const ring: ShadowPrism = {
      polygon: { outer: rect(0, 0, 100, 100).outer, holes: [[[40, 40], [40, 60], [60, 60], [60, 40]]] },
      z0: 0,
      z1: 100,
    };
    expect(isShadowed([50, 50, 0], altDir(85, 180), [ring])).toBe(false);
    expect(isShadowed([50, 50, 0], altDir(45, 180), [ring])).toBe(true);
  });
  it("zenith sun blocks only points under a prism", () => {
    const solid: ShadowPrism = { polygon: rect(0, 0, 10, 10), z0: 0, z1: 50 };
    expect(isShadowed([5, 5, 0], [0, 0, 1], [solid])).toBe(true);
    expect(isShadowed([50, 5, 0], [0, 0, 1], [solid])).toBe(false);
  });
  it("sun bearing along an edge line does not crash or double-count", () => {
    const b: ShadowPrism = { polygon: rect(0, 0, 10, 10), z0: 0, z1: 30 };
    expect(isShadowed([0, 20, 0], altDir(45, 180), [b])).toBe(true); // ray runs exactly along the x=0 edge
    expect(typeof isShadowed([-5, 20, 0], altDir(45, 180), [b])).toBe("boolean");
  });
});

describe("gridPoints", () => {
  it("covers a square at cell centres", () => {
    const pts = gridPoints(rect(0, 0, 20, 10), 5);
    expect(pts.length).toBe(8);
    expect(pts[0]).toEqual([2.5, 2.5, 0]);
  });
  it("excludes holes", () => {
    const poly: Polygon = { outer: rect(0, 0, 20, 20).outer, holes: [[[5, 5], [5, 15], [15, 15], [15, 5]]] };
    const pts = gridPoints(poly, 5);
    expect(pts.length).toBe(16 - 4);
    expect(pts.every(([x, y]) => !(x > 5 && x < 15 && y > 5 && y < 15))).toBe(true);
  });
});

describe("sunHours", () => {
  const samples = daySamples(presetDayStart(preset("jun21")), LAT, LNG, 15);
  it("unobstructed point gets every daylight sample", () => {
    let count = 0;
    const start = presetDayStart(preset("jun21")).getTime();
    for (let i = 0; i < 96; i++) if (sunVector(new Date(start + (i + 0.5) * 15 * 60_000), LAT, LNG).altitudeDeg > 0) count++;
    expect(count).toBeGreaterThan(0);
    expect(sunHours([[0, 0, 0]], [], samples)[0]).toBeCloseTo((count * 15) / 60, 9);
    expect(samples.length).toBe(count);
  });
  it("summer day is longer than winter day", () => {
    const winter = daySamples(presetDayStart(preset("dec21")), LAT, LNG, 15);
    expect(sunHours([[0, 0, 0]], [], samples)[0]).toBeGreaterThan(sunHours([[0, 0, 0]], [], winter)[0]);
  });
  it("an obstruction reduces hours; mean over a courtyard grid is deterministic", () => {
    const ring: ShadowPrism = {
      polygon: { outer: rect(0, 0, 100, 100).outer, holes: [rect(30, 30, 70, 70).outer] },
      z0: 0,
      z1: 80,
    };
    const pts = gridPoints({ outer: rect(30, 30, 70, 70).outer, holes: [] }, 5);
    const open = meanSunHours(pts, [], samples);
    const shaded = meanSunHours(pts, [ring], samples);
    expect(shaded).toBeLessThan(open);
    expect(shaded).toBeGreaterThan(0);
    expect(meanSunHours(pts, [ring], samples)).toBe(shaded);
    expect(meanSunHours([], [ring], samples)).toBe(0);
  });
  it("skips samples with sun below the horizon", () => {
    const night = { ...samples[0], altitudeDeg: -5, dir: [0, 0, -1] as Vec3 };
    expect(sunHours([[0, 0, 0]], [], [night])[0]).toBe(0);
  });
});
