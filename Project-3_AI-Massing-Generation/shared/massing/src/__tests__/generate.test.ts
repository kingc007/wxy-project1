import { describe, expect, it } from "vitest";
import { area, initGeometry, inset, liveGeometryObjects, intersect, rectPolygon } from "../geom2d";
import { generateOption } from "../generate";
import { TYPOLOGY_PRESETS, classifyTypology, presetParams } from "../grammar";
import { buildEnvelopeModel, sectionAt } from "../envelope";
import type { Typology } from "../types";
import { lShapedLot, squareLot } from "./fixtures/envelopes";
import { A, P, S, gen, model } from "./fixtures/helpers";

// top-level await: describe bodies below build options at collection time
await initGeometry();

describe("generate: extrude block on the square fixture", () => {
  const o = gen(squareLot(), { baseFloors: 4 });
  it("plates and metrics are exact", () => {
    expect(o.floors).toHaveLength(4);
    expect(o.floors.map((f) => f.area)).toEqual([7000, 7000, 7000, 7000]);
    expect(o.floors.map((f) => f.z)).toEqual([0, 15, 25, 35]);
    const m = o.metrics;
    expect(m.gfa).toBe(28000);
    expect(m.far).toBeCloseTo(2.8, 12);
    expect(m.floors).toBe(4);
    expect(m.height).toBe(45);
    expect(m.footprint).toBe(7000);
    expect(m.lotCoveragePct).toBeCloseTo(70, 6);
    expect(m.openSpacePct).toBeCloseTo(30, 6);
    expect(m.facadeArea).toBeCloseTo(340 * 45, 6);
    expect(m.volume).toBeCloseTo(7000 * 45, 6);
    expect(m.unitsEst).toBe(29);
    expect(m.streetWallHeight).toBe(45);
    expect(m.trimmedVolume).toBe(0);
    expect(m.courtyardSunHours).toBeNull();
    // box: walls 340*45 + roof 7000 + floor 7000
    expect(m.compactness).toBeCloseTo((340 * 45 + 14000) / Math.pow(7000 * 45, 2 / 3), 6);
  });
  it("merges identical floors into one prism", () => {
    expect(o.prisms).toHaveLength(1);
    expect(o.prisms[0]).toMatchObject({ z0: 0, z1: 45, floors: [0, 1, 2, 3], program: "residential" });
  });
  it("is deterministic and leak free", () => {
    const again = gen(squareLot(), { baseFloors: 4 });
    expect(again).toEqual(o);
    expect(o.id).toMatch(/^opt-[0-9a-f]{8}$/);
    expect(generateOption(model(squareLot()), S, A, P({ baseFloors: 4 }), { id: "x" }).id).toBe("x");
    expect(liveGeometryObjects()).toBe(0);
  });
  it("rejects invalid params instead of clamping", () => {
    expect(() => gen(squareLot(), { baseFloors: 99 })).toThrow(/baseFloors/);
  });
});

describe("generate: grammar moves", () => {
  const m = model(squareLot());
  it("courtyard ring removes exactly the inset area", () => {
    const o = generateOption(m, S, A, P({ baseFloors: 3, ringDepth: 25 }));
    const section = sectionAt(m, 1e-6);
    const void_ = area(inset(section, 25));
    expect(void_).toBeCloseTo(50 * 20, 6);
    for (const f of o.floors) expect(f.area).toBeCloseTo(7000 - void_, 6);
    expect(o.prisms[0].polygon.holes).toHaveLength(1);
    expect(o.typology).toBe("perimeter_courtyard");
  });
  it("ring too deep: no courtyard and a note", () => {
    const o = generateOption(m, S, A, P({ baseFloors: 2, ringDepth: 35 }));
    expect(o.floors[0].area).toBeCloseTo(7000, 6);
    expect(o.notes.join(" ")).toMatch(/no courtyard/);
  });
  it("tower area = coverage % of lot when unclipped", () => {
    const o = generateOption(m, S, A, P({ baseFloors: 3, upperMode: "tower", upperFloors: 5, towerCoverage: 20, towerAspect: 1, towerV: 1 }));
    expect(o.floors).toHaveLength(8);
    for (const f of o.floors.slice(3)) expect(Math.abs(f.area - 2000)).toBeLessThan(1);
    expect(o.metrics.streetWallHeight).toBe(35);
    expect(o.typology).toBe("podium_tower");
  });
  it("tower position is fixed: same centre on every tower floor, even where the setback trims it", () => {
    const o = generateOption(m, S, A, P({ baseFloors: 3, upperMode: "tower", upperFloors: 5, towerCoverage: 20, towerAspect: 1, towerV: 0.5 }));
    const towerFloors = o.floors.slice(3);
    expect(towerFloors).toHaveLength(5);
    // desired (untrimmed) rectangle identical on every floor
    for (const f of towerFloors) expect(f.desiredArea).toBeCloseTo(2000, 6);
    // top-of-bbox y of the plate never moves above the rectangle's rear edge; rear edge is the same on every floor
    const rear = towerFloors.map((f) => Math.max(...f.polygons.flatMap((p) => p.outer.map((v) => v[1]))));
    for (const r of rear) expect(r).toBeCloseTo(rear[0], 9);
    const cx = towerFloors.map((f) => { const xs = f.polygons.flatMap((p) => p.outer.map((v) => v[0])); return (Math.min(...xs) + Math.max(...xs)) / 2; });
    for (const c of cx) expect(c).toBeCloseTo(50, 9);
    // floors above the 60 ft setback start lose the strip inside 15 ft of the street, floors below do not
    expect(towerFloors[0].trimmedArea).toBe(0);
    expect(towerFloors[4].trimmedArea).toBeGreaterThan(0);
  });
  it("steps remove s * stepDepth from the chosen side", () => {
    const o = generateOption(m, S, A, P({ baseFloors: 2, upperMode: "extrude", upperFloors: 4, stepEvery: 2, stepDepth: 10, stepFrom: "front" }));
    // base depth 70 (y 0..70), width 100; upper floors k=2,3 -> s=1, k=4,5 -> s=2
    expect(o.floors.map((f) => Math.round(f.area))).toEqual([7000, 7000, 6000, 6000, 5000, 5000]);
    const left = generateOption(m, S, A, P({ baseFloors: 1, upperMode: "extrude", upperFloors: 1, stepEvery: 1, stepDepth: 20, stepFrom: "left" }));
    expect(Math.round(left.floors[1].area)).toBe(5600); // 80 x 70
  });
  it("split massing: two volumes, gap and height bias", () => {
    const o = generateOption(m, S, A, P({ baseFloors: 2, parts: 2, gapWidth: 30, upperMode: "extrude", upperFloors: 4, heightBias: 0.5 }));
    expect(o.floors[0].polygons).toHaveLength(2);
    expect(o.floors[0].area).toBeCloseTo(2 * 35 * 70, 6);
    // n_0 = 2 + round(4*(1-0.5)) = 4, n_1 = 2 + round(4*1.5) = 8
    expect(o.floors).toHaveLength(8);
    expect(o.floors[3].polygons).toHaveLength(2);
    expect(o.floors[4].polygons).toHaveLength(1);
  });
  it("carve removes the notch from the chosen floor up", () => {
    const o = generateOption(m, S, A, P({ baseFloors: 3, carveWidth: 40, carveDepth: 30, carveFromFloor: 1 }));
    expect(o.floors.map((f) => f.area)).toEqual([7000, 7000 - 40 * 30, 7000 - 40 * 30]);
  });
  it("base depth is clamped by the lot", () => {
    const o = generateOption(m, S, A, P({ baseFloors: 1, baseDepth: 20 }));
    expect(o.floors[0].area).toBeCloseTo(2000, 6);
  });
  it("upperMode none stops at baseFloors; heightBias with one part is neutral", () => {
    expect(generateOption(m, S, A, P({ baseFloors: 2, upperFloors: 9, heightBias: 1 })).floors).toHaveLength(2);
  });
});

describe("generate: envelope containment", () => {
  const m = model(squareLot());
  it("clipToEnvelope=false produces plates outside the envelope", () => {
    const o = generateOption(m, S, A, P({ baseFloors: 10, clipToEnvelope: false }));
    expect(o.floors[0].area).toBe(10000);
    expect(o.floors).toHaveLength(10);
    expect(o.metrics.height).toBe(105);
    const outside = o.floors.map((f) => area(intersect(f.polygons, [rectPolygon(0, 70, 100, 100)])));
    expect(outside.every((a) => a > 0)).toBe(true);
  });
  it("clipToEnvelope=true trims at the setback and stops at max height", () => {
    const o = generateOption(m, S, A, P({ baseFloors: 15, clipToEnvelope: true }));
    // tops 15..55 -> 7000 (5 floors); tops 65..95 -> 5500 (4 floors); top 105 > 100 stops
    expect(o.floors).toHaveLength(9);
    expect(o.floors.map((f) => Math.round(f.area))).toEqual([7000, 7000, 7000, 7000, 7000, 5500, 5500, 5500, 5500]);
    expect(o.floors[5].trimmedArea).toBeCloseTo(1500, 6);
    expect(o.floors[0].trimmedArea).toBe(0);
    expect(o.metrics.trimmedVolume).toBeCloseTo(4 * 1500 * 10, 6);
  });
  it("L-shaped lot: plates follow the concave section for either frontage", () => {
    for (const front of [0, 5] as const) {
      const lm = buildEnvelopeModel(lShapedLot(front));
      const o = generateOption(lm, S, A, P({ baseFloors: 2 }));
      expect(o.floors.map((f) => Math.round(f.area)), `front ${front}`).toEqual([6500, 6500]);
    }
  });
});

describe("every typology preset", () => {
  const m = model(squareLot());
  for (const t of Object.keys(TYPOLOGY_PRESETS) as Typology[]) {
    it(`${t}: non-empty option that classifies as itself`, () => {
      const p = presetParams(t);
      const o = generateOption(m, S, A, p);
      expect(o.floors.length).toBeGreaterThan(0);
      expect(o.metrics.gfa).toBeGreaterThan(0);
      expect(o.prisms.length).toBeGreaterThan(0);
      expect(classifyTypology(p)).toBe(t);
      expect(o.typology).toBe(t);
    });
  }
});

describe("benchmark", () => {
  const time = (label: string, fn: () => unknown, runs = 20) => {
    const times: number[] = [];
    for (let i = 0; i < runs; i++) {
      const t0 = performance.now();
      fn();
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    console.log(`BENCH ${label}: median ${times[runs >> 1].toFixed(2)} ms, min ${times[0].toFixed(2)} ms, max ${times[runs - 1].toFixed(2)} ms`);
    return times[runs >> 1];
  };
  it.skipIf(process.env.WXY_SKIP_BENCH === "1")("30-floor tower generateOption timing", () => {
    const p = P({ baseFloors: 3, upperMode: "tower", upperFloors: 27, towerCoverage: 20, towerAspect: 1.5 });
    const warm = model(squareLot({ maxHeight: 1000, setback: null, rearYard: 10 }));
    expect(generateOption(warm, S, A, p).floors).toHaveLength(30);
    let i = 0;
    // (a) warm section cache, constant sections (typical 3C sweep on one site)
    const a = time("30-floor tower, warm section cache", () => generateOption(warm, S, A, { ...p, towerRotation: (i++ % 6) * 15 }));
    // (b) cold section cache: a new model every run
    const jsonB = squareLot({ maxHeight: 1000, setback: null, rearYard: 10 });
    const b = time("30-floor tower, cold section cache", () => generateOption(model(jsonB), S, A, p));
    // (c) worst case: sky exposure plane makes every floor's section differ, cold caches
    const jsonC = squareLot({ maxHeight: 1000, setback: null, rearYard: 0, sep: { start: 20, slope: 4, initial: 0 } });
    const c = time("30-floor tower, sky-exposure envelope (30 distinct sections), cold", () => generateOption(model(jsonC), S, A, p));
    expect(Math.max(a, b, c)).toBeLessThan(100);
    expect(liveGeometryObjects()).toBe(0);
  });
});
