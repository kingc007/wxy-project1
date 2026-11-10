import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, PARAM_SPECS, TYPOLOGY_PRESETS, classifyTypology, presetParams, snapParam, validateParams } from "../grammar";
import { DEFAULT_ASSUMPTIONS, EMPTY_SCHEDULE, assignPrograms, floorHeight, programForFloor } from "../program";
import { PARAM_RANGES } from "../strategy";
import type { MassingParams, ProgramSchedule, ProgramUse, Typology } from "../types";

describe("grammar", () => {
  it("defaults are valid and classify as block", () => {
    expect(validateParams(DEFAULT_PARAMS)).toEqual({ ok: true, errors: [] });
    expect(classifyTypology(DEFAULT_PARAMS)).toBe("block");
  });
  it("every spec key exists in DEFAULT_PARAMS and numeric ranges agree with strategy.ts PARAM_RANGES", () => {
    expect(PARAM_SPECS.map((s) => s.key).sort()).toEqual(Object.keys(DEFAULT_PARAMS).sort());
    for (const [k, r] of Object.entries(PARAM_RANGES)) {
      const s = PARAM_SPECS.find((x) => x.key === k)!;
      expect([k, s.min, s.max]).toEqual([k, r.min, r.max]);
      expect(s.kind === "int").toBe(Boolean(r.int));
    }
  });
  it("validateParams flags range, step, enum and unknown keys; never clamps", () => {
    const bad = validateParams({ baseFloors: 20, parts: 1.5, towerAspect: 2.3, upperMode: "spire" as never, ringDepth: 10, nope: 1 } as never);
    expect(bad.ok).toBe(false);
    expect(bad.errors).toHaveLength(6);
    expect(validateParams({ ringDepth: 0 }).ok).toBe(true);
    expect(validateParams({ ringDepth: 25 }).ok).toBe(true);
    expect(validateParams({ ringDepth: 72 }).ok).toBe(false);
    expect(validateParams({ towerU: 0.3 }).ok).toBe(true);
    expect(validateParams({ clipToEnvelope: "yes" as never }).ok).toBe(false);
  });
  it("snapParam snaps to step and clamps into range", () => {
    expect(snapParam("baseDepth", 123)).toBe(125);
    expect(snapParam("towerAspect", 2.4)).toBe(2.5);
    expect(snapParam("towerU", 0.33)).toBe(0.35);
    expect(snapParam("baseFloors", 99)).toBe(15);
    expect(snapParam("ringDepth", 10)).toBe(0);
    expect(snapParam("ringDepth", 20)).toBe(25);
    expect(snapParam("heightBias", -0.34)).toBe(-0.3);
    expect(() => snapParam("upperMode", 1)).toThrow();
  });
  it("every preset is valid and classifies as itself", () => {
    for (const t of Object.keys(TYPOLOGY_PRESETS) as Typology[]) {
      const p = presetParams(t);
      expect(validateParams(p).ok, t).toBe(true);
      expect(classifyTypology(p), t).toBe(t);
    }
  });
  it("classification priority", () => {
    const p = (o: Partial<MassingParams>): MassingParams => ({ ...DEFAULT_PARAMS, ...o });
    expect(classifyTypology(p({ upperMode: "tower", towerAspect: 2.5, ringDepth: 30 }))).toBe("slab_bar");
    expect(classifyTypology(p({ upperMode: "tower", ringDepth: 30 }))).toBe("podium_tower");
    expect(classifyTypology(p({ ringDepth: 30, parts: 2 }))).toBe("perimeter_courtyard");
    expect(classifyTypology(p({ parts: 2, stepEvery: 2 }))).toBe("split_massing");
    expect(classifyTypology(p({ stepEvery: 2, carveWidth: 10, carveDepth: 10 }))).toBe("stepped_terraces");
    expect(classifyTypology(p({ carveWidth: 10, carveDepth: 0 }))).toBe("block");
  });
});

describe("program stacking", () => {
  const use = (u: Partial<ProgramUse> & Pick<ProgramUse, "use">): ProgramUse => ({ targetGfa: null, targetUnits: null, floors: null, placement: "ground", source: "brief", accepted: true, ...u });
  const sched = (uses: ProgramUse[], ground: ProgramSchedule["groundFloorUse"]): ProgramSchedule => ({ ...EMPTY_SCHEDULE, uses, groundFloorUse: ground });
  const A = DEFAULT_ASSUMPTIONS;

  it("defaults are labelled assumptions", () => {
    expect(A.floorToFloor.residential).toEqual({ value: 10, source: "default", rationale: "Default design assumption — edit for your project" });
    expect(A.groundFloorHeight.value).toBe(15);
    expect(A.floorToFloor.commercial.value).toBe(15);
    expect(A.floorToFloor.community_facility.value).toBe(13);
    expect(A.avgUnitNetSf.value).toBe(750);
    expect(A.efficiency.value).toBe(0.8);
  });
  it("all residential by default; heights from assumptions", () => {
    expect(assignPrograms(EMPTY_SCHEDULE, A, [1, 1, 1])).toEqual(["residential", "residential", "residential"]);
    expect(floorHeight(A, "residential", 0)).toBe(15);
    expect(floorHeight(A, "residential", 1)).toBe(10);
    expect(floorHeight(A, "community_facility", 3)).toBe(13);
  });
  it("ground-floor commercial until target reached, then residential", () => {
    const s = sched([use({ use: "commercial", targetGfa: 12000 })], "commercial");
    expect(assignPrograms(s, A, [7000, 7000, 7000, 7000])).toEqual(["commercial", "commercial", "residential", "residential"]);
  });
  it("explicit floor counts, schedule order, unaccepted uses ignored", () => {
    const s = sched([use({ use: "community_facility", floors: 2 }), use({ use: "commercial", targetGfa: 1, accepted: false })], "residential");
    expect(assignPrograms(s, A, [1, 1, 1, 1])).toEqual(["residential", "community_facility", "community_facility", "residential"]);
  });
  it("floor k depends only on earlier floors", () => {
    const s = sched([use({ use: "commercial", targetGfa: 5000 })], "commercial");
    expect(programForFloor(s, 0, [], [])).toBe("commercial");
    expect(programForFloor(s, 1, ["commercial"], [4000])).toBe("commercial");
    expect(programForFloor(s, 1, ["commercial"], [5000])).toBe("residential");
  });
});
