import { describe, expect, it } from "vitest";
import {
  AssumptionsSchema,
  ParamDiffSchema,
  PARAM_RANGES,
  ProgramScheduleSchema,
  StrategyProposalSchema,
  diversityScore,
  featureDiffCount,
  formatZodError,
  isNearDuplicate,
  paramDistance,
  toToolInputSchema,
  typologicalFeatures,
} from "../strategy";
import type { MassingParams } from "../types";

const base: MassingParams = {
  baseFloors: 5,
  baseDepth: 100,
  parts: 1,
  gapWidth: 0,
  ringDepth: 0,
  upperMode: "extrude",
  upperFloors: 4,
  towerCoverage: 20,
  towerAspect: 1,
  towerU: 0.5,
  towerV: 0.5,
  towerRotation: 0,
  stepEvery: 0,
  stepDepth: 0,
  stepFrom: "front",
  carveWidth: 0,
  carveDepth: 0,
  carveU: 0.5,
  carveFromFloor: 0,
  carveSide: "front",
  heightBias: 0,
  clipToEnvelope: true,
};

describe("StrategyProposalSchema", () => {
  const ok = { typology: "podium_tower", name: "Podium and tower", intent: "Tower set back from the street wall.", params: { baseFloors: 6, upperMode: "tower" } };
  it("accepts a valid proposal with partial params", () => {
    expect(StrategyProposalSchema.safeParse(ok).success).toBe(true);
    expect(StrategyProposalSchema.safeParse({ ...ok, notes: "x" }).success).toBe(true);
  });
  it("rejects out-of-range, non-integer, unknown keys, unknown typology, long text", () => {
    const bad = (patch: object) => StrategyProposalSchema.safeParse({ ...ok, ...patch }).success;
    expect(bad({ params: { baseFloors: 16 } })).toBe(false);
    expect(bad({ params: { baseFloors: 2.5 } })).toBe(false);
    expect(bad({ params: { towerCoverage: 7 } })).toBe(false);
    expect(bad({ params: { ringDepth: 10 } })).toBe(false); // 0 or 25-70
    expect(bad({ params: { ringDepth: 0 } })).toBe(true);
    expect(bad({ params: { ringDepth: 25 } })).toBe(true);
    expect(bad({ params: { upperMode: "spire" } })).toBe(false);
    expect(bad({ params: { x: 1 } })).toBe(false);
    expect(bad({ params: { polygon: [[0, 0]] } })).toBe(false); // no geometry accepted
    expect(bad({ typology: "dome" })).toBe(false);
    expect(bad({ name: "n".repeat(41) })).toBe(false);
    expect(bad({ intent: "i".repeat(161) })).toBe(false);
    expect(bad({ notes: "n".repeat(301) })).toBe(false);
    expect(bad({ metrics: { far: 3 } })).toBe(false); // no metrics accepted
  });
  it("formats errors for the model", () => {
    const r = StrategyProposalSchema.safeParse({ ...ok, params: { baseFloors: 99 } });
    expect(r.success).toBe(false);
    if (!r.success) expect(formatZodError(r.error)).toMatch(/params\.baseFloors/);
  });
});

describe("ParamDiffSchema", () => {
  it("accepts in-range changes and checks `to` against the key's range/enum", () => {
    expect(ParamDiffSchema.safeParse({ changes: [{ key: "towerU", to: 0.8, reason: "Pull the tower east." }, { key: "stepFrom", to: "rear", reason: "Terrace toward the rear." }] }).success).toBe(true);
    expect(ParamDiffSchema.safeParse({ changes: [{ key: "towerU", to: 1.5, reason: "x" }] }).success).toBe(false);
    expect(ParamDiffSchema.safeParse({ changes: [{ key: "stepFrom", to: "up", reason: "x" }] }).success).toBe(false);
    expect(ParamDiffSchema.safeParse({ changes: [{ key: "baseFloors", to: "four", reason: "x" }] }).success).toBe(false);
  });
  it("rejects empty, unknown key, long reason, too many", () => {
    expect(ParamDiffSchema.safeParse({ changes: [] }).success).toBe(false);
    expect(ParamDiffSchema.safeParse({ changes: [{ key: "nope", to: 1, reason: "x" }] }).success).toBe(false);
    expect(ParamDiffSchema.safeParse({ changes: [{ key: "towerU", to: 0.5, reason: "r".repeat(121) }] }).success).toBe(false);
    const many = Array.from({ length: 9 }, () => ({ key: "towerU", to: 0.5, reason: "r" }));
    expect(ParamDiffSchema.safeParse({ changes: many }).success).toBe(false);
  });
});

describe("brief-parser schemas", () => {
  const prog = {
    uses: [{ use: "residential", targetGfa: null, targetUnits: 120, floors: null, placement: "upper", source: "brief", accepted: false }],
    groundFloorUse: "commercial",
    openSpaceTargetPct: 30,
    publicCourtyard: true,
    moves: [{ text: "step down toward the park", kind: "step_toward", direction: null }],
    confirmed: false,
  };
  it("ProgramSchedule accepts a valid schedule and rejects bad enums / ranges", () => {
    expect(ProgramScheduleSchema.safeParse(prog).success).toBe(true);
    expect(ProgramScheduleSchema.safeParse({ ...prog, groundFloorUse: "industrial" }).success).toBe(false);
    expect(ProgramScheduleSchema.safeParse({ ...prog, openSpaceTargetPct: 120 }).success).toBe(false);
    expect(ProgramScheduleSchema.safeParse({ ...prog, extra: 1 }).success).toBe(false);
  });
  const av = (value: number) => ({ value, source: "default", rationale: "Default" });
  const asm = { floorToFloor: { residential: av(1), commercial: av(2), community_facility: av(3) }, groundFloorHeight: av(4), avgUnitNetSf: av(5), efficiency: av(0.8) };
  it("Assumptions accepts valid, rejects efficiency > 1 and missing keys", () => {
    expect(AssumptionsSchema.safeParse(asm).success).toBe(true);
    expect(AssumptionsSchema.safeParse({ ...asm, efficiency: av(1.2) }).success).toBe(false);
    const { groundFloorHeight: _g, ...missing } = asm;
    void _g;
    expect(AssumptionsSchema.safeParse(missing).success).toBe(false);
  });
});

describe("toToolInputSchema", () => {
  function walk(node: unknown, visit: (o: Record<string, unknown>) => void) {
    if (Array.isArray(node)) return node.forEach((n) => walk(n, visit));
    if (node && typeof node === "object") {
      visit(node as Record<string, unknown>);
      Object.values(node).forEach((v) => walk(v, visit));
    }
  }
  for (const [name, schema] of [
    ["StrategyProposal", StrategyProposalSchema],
    ["ParamDiff", ParamDiffSchema],
    ["ProgramSchedule", ProgramScheduleSchema],
    ["Assumptions", AssumptionsSchema],
  ] as const) {
    it(`${name}: every object level is strict with a required array`, () => {
      const js = toToolInputSchema(schema);
      expect(js.type).toBe("object");
      expect(js.$schema).toBeUndefined();
      let objects = 0;
      walk(js, (o) => {
        if (o.type === "object") {
          objects++;
          expect(o.additionalProperties).toBe(false);
          expect(Array.isArray(o.required)).toBe(true);
        }
      });
      expect(objects).toBeGreaterThan(0);
    });
  }
  it("StrategyProposal schema carries ranges and requires typology/name/intent/params", () => {
    const js = toToolInputSchema(StrategyProposalSchema) as { required: string[]; properties: Record<string, { properties?: Record<string, Record<string, unknown>> }> };
    expect(js.required).toEqual(["typology", "name", "intent", "params"]);
    const bf = js.properties.params.properties!.baseFloors;
    expect(bf.minimum).toBe(PARAM_RANGES.baseFloors.min);
    expect(bf.maximum).toBe(PARAM_RANGES.baseFloors.max);
  });
});

describe("diversity", () => {
  const tower: MassingParams = { ...base, upperMode: "tower", towerAspect: 1.5, baseFloors: 4 };
  const slab: MassingParams = { ...base, upperMode: "tower", towerAspect: 4, baseFloors: 2, towerCoverage: 40, towerRotation: 90, baseDepth: 300, towerU: 0.1, towerV: 0.9, upperFloors: 40, heightBias: 0.5 };
  const court: MassingParams = { ...base, ringDepth: 50, upperMode: "extrude", parts: 2, gapWidth: 40, baseFloors: 9, upperFloors: 30, baseDepth: 250, stepEvery: 3, stepDepth: 20, carveWidth: 60, carveDepth: 60, carveFromFloor: 5, heightBias: -0.5 };

  it("typologicalFeatures derives the spec §9 vector", () => {
    expect(typologicalFeatures({ ...base, ringDepth: 30, stepEvery: 2, carveWidth: 10, carveDepth: 10, towerAspect: 3, baseFloors: 3 }, "block")).toEqual({
      typology: "block",
      upperMode: "extrude",
      parts: 1,
      courtyard: true,
      stepped: true,
      carved: true,
      baseBucket: "low",
      slab: true,
    });
    expect(typologicalFeatures({ ...base, carveWidth: 10, carveDepth: 0, baseFloors: 7 }, "block").carved).toBe(false);
    expect(typologicalFeatures({ ...base, baseFloors: 7 }, "block").baseBucket).toBe("mid");
    expect(typologicalFeatures({ ...base, baseFloors: 8 }, "block").baseBucket).toBe("high");
  });
  it("paramDistance: 0 for identical, symmetric, within [0, 1]", () => {
    expect(paramDistance(base, base)).toBe(0);
    expect(paramDistance(tower, slab)).toBeCloseTo(paramDistance(slab, tower), 12);
    const lo = Object.fromEntries(Object.entries(PARAM_RANGES).map(([k, r]) => [k, r.min]));
    const hi = Object.fromEntries(Object.entries(PARAM_RANGES).map(([k, r]) => [k, r.max]));
    const d = paramDistance({ ...base, ...lo } as MassingParams, { ...base, ...hi } as MassingParams);
    expect(d).toBeGreaterThan(0.4);
    expect(d).toBeLessThanOrEqual(1);
  });
  it("one slider moved is a near-duplicate", () => {
    expect(isNearDuplicate({ params: base, typology: "block" }, { params: { ...base, baseFloors: 6 }, typology: "block" })).toBe(true);
  });
  it("distant parameters but < 2 feature diffs is still a duplicate", () => {
    const a = { ...base, baseDepth: 20, upperFloors: 0, towerU: 0, towerV: 0, heightBias: -1, gapWidth: 0, stepDepth: 0, carveU: 0 };
    const b = { ...base, baseDepth: 400, upperFloors: 80, towerU: 1, towerV: 1, heightBias: 1, gapWidth: 80, stepDepth: 40, carveU: 1, towerRotation: 90 };
    expect(paramDistance(a, b)).toBeGreaterThan(0.2);
    expect(featureDiffCount(typologicalFeatures(a, "block"), typologicalFeatures(b, "block"))).toBe(0);
    expect(isNearDuplicate({ params: a, typology: "block" }, { params: b, typology: "block" })).toBe(true);
  });
  it("same moves with only small slider changes is a duplicate even if a bucket boundary flips features", () => {
    const a = { ...tower, baseFloors: 7, towerAspect: 2.25 };
    const b = { ...tower, baseFloors: 8, towerAspect: 2.5 };
    expect(featureDiffCount(typologicalFeatures(a, "podium_tower"), typologicalFeatures(b, "podium_tower"))).toBeGreaterThanOrEqual(2);
    expect(paramDistance(a, b)).toBeLessThan(0.1);
    expect(isNearDuplicate({ params: a, typology: "podium_tower" }, { params: b, typology: "podium_tower" })).toBe(true);
  });
  it("genuinely different options are distinct", () => {
    expect(isNearDuplicate({ params: tower, typology: "podium_tower" }, { params: court, typology: "perimeter_courtyard" })).toBe(false);
    expect(isNearDuplicate({ params: tower, typology: "podium_tower" }, { params: slab, typology: "slab_bar" })).toBe(false);
  });
  it("active-key distance (manager decision 2026-10-26): a tower scheme and a split courtyard scheme are distinct", () => {
    const mild = { ...base, upperMode: "tower" as const, towerAspect: 1.5, baseFloors: 4 };
    const other = { ...base, ringDepth: 50, parts: 2, gapWidth: 40, baseFloors: 9, upperFloors: 30 };
    expect(paramDistance(mild, other)).toBeGreaterThanOrEqual(0.1);
    expect(isNearDuplicate({ params: mild, typology: "podium_tower" }, { params: other, typology: "perimeter_courtyard" })).toBe(false);
  });
  it("diversityScore is the mean pairwise distance", () => {
    expect(diversityScore([])).toBe(0);
    expect(diversityScore([{ params: base, typology: "block" }])).toBe(0);
    const items = [
      { params: tower, typology: "podium_tower" as const },
      { params: slab, typology: "slab_bar" as const },
      { params: court, typology: "perimeter_courtyard" as const },
    ];
    const expected = (paramDistance(tower, slab) + paramDistance(tower, court) + paramDistance(slab, court)) / 3;
    expect(diversityScore(items)).toBeCloseTo(expected, 12);
    expect(diversityScore([items[0], items[0]])).toBe(0);
  });
});
