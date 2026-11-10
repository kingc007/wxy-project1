import { describe, expect, it } from "vitest";
import { initGeometry } from "../geom2d";
import { generateOption } from "../generate";
import { computeMetrics, streetWallHeight } from "../metrics";
import { fmtCf, fmtFar, fmtFt, fmtInt, fmtPct, fmtRound10, fmtSf } from "../format";
import type { Assumptions, ProgramSchedule } from "../types";
import { squareLot } from "./fixtures/envelopes";
import { A, P, S, gen, model } from "./fixtures/helpers";

await initGeometry();

describe("metrics", () => {
  it("gfa by program, FAR by program and units use the stacked programs", () => {
    const sched: ProgramSchedule = {
      ...S,
      groundFloorUse: "commercial",
      uses: [{ use: "commercial", targetGfa: 7000, targetUnits: null, floors: null, placement: "ground", source: "brief", accepted: true }],
    };
    const o = generateOption(model(squareLot()), sched, A, P({ baseFloors: 4 }));
    expect(o.floors.map((f) => f.program)).toEqual(["commercial", "residential", "residential", "residential"]);
    expect(o.floors.map((f) => f.height)).toEqual([15, 10, 10, 10]);
    const m = o.metrics;
    expect(m.gfaByProgram).toEqual({ residential: 21000, commercial: 7000, community_facility: 0 });
    expect(m.farByProgram.residential).toBeCloseTo(2.1, 12);
    expect(m.zfa).toBe(m.gfa);
    expect(m.unitsEst).toBe(Math.floor((21000 * 0.8) / 750)); // 22
    expect(o.prisms.map((p) => p.program)).toEqual(["commercial", "residential"]);
  });
  it("assumptions drive units and heights", () => {
    const asm: Assumptions = { ...A, avgUnitNetSf: { value: 1000, source: "user", rationale: "test" }, groundFloorHeight: { value: 20, source: "user", rationale: "test" } };
    const o = generateOption(model(squareLot()), S, asm, P({ baseFloors: 2 }));
    expect(o.metrics.height).toBe(30);
    expect(o.metrics.unitsEst).toBe(Math.floor((14000 * 0.8) / 1000));
  });
  it("lot coverage is the plan union, not the sum", () => {
    const o = gen(squareLot(), { baseFloors: 3, upperMode: "tower", upperFloors: 3, towerCoverage: 10 });
    expect(o.metrics.lotCoveragePct).toBeCloseTo(70, 6); // tower sits inside the podium footprint
    expect(o.metrics.footprint).toBe(7000);
  });
  it("street wall stops where a plate leaves the frontage", () => {
    const o = gen(squareLot(), { baseFloors: 3, upperMode: "tower", upperFloors: 3 });
    expect(streetWallHeight(model(squareLot()), o.floors)).toBe(35);
    expect(streetWallHeight(model(squareLot()), [])).toBe(0);
  });
  it("street wall distance: 8 ft wide street, 10 ft narrow/unknown, measured from the front yard line", () => {
    const withStreet = (width: string | null, frontYard: number) => {
      const j = squareLot() as unknown as { lot: { edges: { street?: unknown }[] }; controls: { yards: { front: unknown } } };
      j.lot.edges[0].street = width ? { name: null, width } : null;
      j.controls.yards.front = { value: frontYard, unit: "ft", status: "cited", confidence: "cited", citations: [{ source: "T", section: "1", quote: "q" }] };
      return j;
    };
    // a full-width carve from the street line pushes every plate edge to v = carveDepth
    const wall = (width: string | null, frontYard: number, carveDepth: number) => {
      const j = withStreet(width, frontYard);
      const o = gen(j, { baseFloors: 3, carveWidth: 120, carveDepth, carveFromFloor: 0 });
      return o.metrics.streetWallHeight;
    };
    expect(wall("wide", 0, 5)).toBe(35); // 5 <= 8
    expect(wall("wide", 0, 10)).toBe(0); // 10 > 8
    expect(wall("narrow", 0, 10)).toBe(35); // 10 <= 10
    expect(wall("narrow", 0, 15)).toBe(0);
    expect(wall("unknown", 0, 10)).toBe(35); // unknown -> 10
    expect(wall(null, 0, 15)).toBe(0);
    expect(wall("wide", 5, 10)).toBe(35); // 10 <= 5 + 8
    expect(wall("wide", 5, 15)).toBe(0); // 15 > 13
    expect(wall("narrow", 5, 15)).toBe(35); // 15 <= 5 + 10
    expect(wall("narrow", 5, 20)).toBe(0);
  });
  it("empty stack gives zeros, no NaN", () => {
    const m = computeMetrics(model(squareLot()), [], A);
    expect(m.gfa).toBe(0);
    expect(m.compactness).toBe(0);
    expect(m.facadePerGfa).toBe(0);
    expect(Object.values(m).every((v) => v === null || typeof v === "object" || Number.isFinite(v))).toBe(true);
  });
  it("tower compactness counts exposed caps between different plates", () => {
    const o = gen(squareLot(), { baseFloors: 1, upperMode: "tower", upperFloors: 1, towerCoverage: 10, towerAspect: 1 });
    const [base, tower] = o.floors;
    const surface = base.perimeter * base.height + tower.perimeter * tower.height + base.area + (base.area - tower.area) + 0 + tower.area; // base floor, base roof (exposed part), tower floor (fully on base), tower roof
    expect(o.metrics.compactness).toBeCloseTo(surface / Math.pow(o.metrics.volume, 2 / 3), 6);
  });
});

describe("format", () => {
  it("rounds for display only", () => {
    expect(fmtSf(12344)).toBe("12,340 sf");
    expect(fmtSf(12345)).toBe("12,350 sf");
    expect(fmtCf(1234567)).toBe("1,234,570 cf");
    expect(fmtRound10(4)).toBe("0");
    expect(fmtFt(104.96)).toBe("105.0 ft");
    expect(fmtFt(1234.56)).toBe("1,234.6 ft");
    expect(fmtFar(2.8)).toBe("2.80");
    expect(fmtFar(5.696)).toBe("5.70");
    expect(fmtPct(70)).toBe("70.0%");
    expect(fmtInt(-1234)).toBe("-1,234");
    expect(fmtInt(-0.2)).toBe("0");
  });
});
