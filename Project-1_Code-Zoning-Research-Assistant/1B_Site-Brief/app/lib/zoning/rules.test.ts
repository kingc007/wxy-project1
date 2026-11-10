import { describe, expect, it } from "vitest";
import { districtsCovered, findRules, isDistrictCovered, whenMatches } from "./rules";
import { resolveField } from "./resolve";
import type { Assumption } from "../types";

const asm = (key: string, value: string | boolean, confidence: Assumption["confidence"] = "cited"): Assumption => ({
  id: key, key: key as Assumption["key"], value, statement: key, reason: "test", state: "proposed", options: [], confidence,
});

describe("rules matcher", () => {
  it("loads the synced rules table", () => {
    expect(districtsCovered()).toContain("R7A");
    expect(isDistrictCovered("r7a")).toBe(true);
    expect(isDistrictCovered("R3-2")).toBe(false);
  });
  it("matches when-keys and treats unknown context as non-matching", () => {
    expect(whenMatches({ lotType: ["interior"] }, {})).toBe(false);
    expect(whenMatches({ lotType: ["interior"] }, { lotType: "interior" })).toBe(true);
    expect(whenMatches({ buildingType: ["attached", "semi_detached"] }, { buildingType: "attached" })).toBe(true);
    expect(whenMatches({ buildingType: "multiple_dwelling" }, { buildingType: "attached" })).toBe(false);
    expect(whenMatches({ lotWidthLt: 40 }, { lotWidth: 25 })).toBe(true);
    expect(whenMatches({ lotWidthLt: 40 }, { lotWidth: 40 })).toBe(false);
    expect(whenMatches({ lotWidthGte: 40 }, { lotWidth: 40 })).toBe(true);
    expect(whenMatches({ lotWidthGte: 40 }, { lotWidth: null })).toBe(false);
    expect(whenMatches({ siteCategory: "standard" }, {})).toBe(false);
    expect(whenMatches({ siteCategory: "standard" }, { siteCategory: "standard" })).toBe(true);
  });
  it("findRules returns R6 FAR rule by within100ftWideStreet", () => {
    expect(findRules("R6", "maxFar.residential", { within100ftWideStreet: true }).map((r) => r.value)).toEqual([3]);
    expect(findRules("R6", "maxFar.residential", { within100ftWideStreet: false }).map((r) => r.value)).toEqual([2.2]);
    expect(findRules("R6", "maxFar.residential", {})).toEqual([]);
  });
});

describe("resolveField", () => {
  it("no matching rule -> needs_input with the standard note", () => {
    const pv = resolveField("R3-2", "maxFar.residential", {}, []);
    expect(pv.status).toBe("needs_input");
    expect(pv.value).toBeNull();
    expect(pv.note).toBe("No rule in this prototype's rule set for R3-2/maxFar.residential under current assumptions");
  });
  it("single rule -> cited, carries citation, ruleIds, no assumption dependency", () => {
    const pv = resolveField("R7A", "maxFar.residential", {}, []);
    expect(pv).toMatchObject({ value: 4, unit: "ratio", status: "cited", confidence: "cited" });
    expect(pv.citations?.[0].section).toBe("23-22");
    expect(pv.ruleIds).toEqual(["R7A.far.res.std"]);
    expect(pv.assumptionIds).toBeUndefined();
  });
  it("confidence is inferred when a dependency assumption is not cited, cited otherwise", () => {
    const ctx = { lotType: "interior" as const, buildingType: "attached", lotWidth: 25 };
    const a = resolveField("R7A", "yards.rear", ctx, [asm("lotType", "interior"), asm("buildingType", "attached", "unverified")]);
    expect(a).toMatchObject({ value: 30, status: "cited", confidence: "inferred" });
    expect(a.assumptionIds).toEqual(["lotType", "buildingType"]);
    expect(a.appliesBecause).toBe("R7A · interior lot · attached building · lot width 25 ft < 40 ft");
    const b = resolveField("R7A", "yards.rear", ctx, [asm("lotType", "interior"), asm("buildingType", "attached", "cited")]);
    expect(b.confidence).toBe("cited");
  });
  it("appliesBecause quotes the PLUTO lottype from provenance", () => {
    const lt = { ...asm("lotType", "interior"), provenance: [{ dataset: "PLUTO", version: "26v2", field: "lottype", rawValue: 5, url: null, fetchedAt: "2026-10-25T00:00:00Z" }] };
    const pv = resolveField("R7A", "lotCoverage.max", { lotType: "interior", siteCategory: "standard" }, [lt, asm("siteCategory", "standard")]);
    expect(pv.appliesBecause).toBe("R7A · interior lot (PLUTO lottype 5) · standard site");
  });
  it("describes program in appliesBecause", () => {
    const pv = resolveField("R7A", "baseHeight.max", { program: "standard" }, [asm("program", "standard")]);
    expect(pv.value).toBe(75);
    expect(pv.appliesBecause).toBe("R7A · standard program");
  });
});
