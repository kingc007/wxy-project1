import { describe, expect, it } from "vitest";
import { areaShare, coverageArea, maxFloorArea, rearStepSetback, sepPlane, streetSetbackPlane } from "./calc";
import type { PValue } from "../types";

const data = (value: number | null, unit: PValue["unit"]): PValue =>
  value === null
    ? { value, unit, status: "needs_input", confidence: "unverified", note: "x" }
    : { value, unit, status: "data", confidence: "cited", provenance: [{ dataset: "PLUTO", version: "26v2", field: "lotarea", url: null, fetchedAt: "2026-10-25T00:00:00Z" }] };
const cited = (value: number, unit: PValue["unit"], confidence: PValue["confidence"] = "cited", ids?: string[]): PValue => ({
  value, unit, status: "cited", confidence, assumptionIds: ids,
  citations: [{ source: "NYC Zoning Resolution", section: "23-22", url: null, quote: "q" }],
});

describe("calc", () => {
  it("maxFloorArea formula and inputs", () => {
    const pv = maxFloorArea(data(2500, "sf"), cited(4, "ratio"));
    expect(pv).toMatchObject({ value: 10000, unit: "sf", status: "computed", confidence: "cited", formula: "2,500 sf × 4.00 FAR = 10,000 sf" });
    expect(pv.inputs).toEqual(["lot.area", "controls.maxFar.residential"]);
  });
  it("maxFloorArea rounds to 2 decimals and weakens confidence / carries assumptionIds", () => {
    const pv = maxFloorArea(data(2498, "sf"), cited(3.9, "ratio", "inferred", ["street"]));
    expect(pv.value).toBe(9742.2);
    expect(pv.formula).toBe("2,498 sf × 3.90 FAR = 9,742.2 sf");
    expect(pv.confidence).toBe("inferred");
    expect(pv.assumptionIds).toEqual(["street"]);
  });
  it("null propagation", () => {
    const a = maxFloorArea(data(null, "sf"), cited(4, "ratio"));
    expect(a).toMatchObject({ value: null, status: "needs_input" });
    expect(a.note).toContain("lot area");
    const b = maxFloorArea(data(2500, "sf"), data(null, "ratio"));
    expect(b.status).toBe("needs_input");
    expect(coverageArea(data(null, "sf"), cited(80, "percent")).status).toBe("needs_input");
    expect(areaShare(data(2500, "sf"), null).status).toBe("needs_input");
  });
  it("coverageArea", () => {
    const pv = coverageArea(data(2500, "sf"), cited(80, "percent"));
    expect(pv).toMatchObject({ value: 2000, status: "computed", formula: "2,500 sf × 80% = 2,000 sf" });
  });
  it("areaShare", () => {
    const pv = areaShare(data(2568, "sf"), 0.5);
    expect(pv).toMatchObject({ value: 1284, formula: "2,568 sf × 50% = 1,284 sf" });
  });
  it("rearStepSetback = above − rear, starts at height break", () => {
    const plane = rearStepSetback({ rear: cited(20, "ft"), rearAbove75: cited(30, "ft"), heightBreak: cited(75, "ft"), edgeIndices: [2] });
    expect(plane).toMatchObject({ appliesTo: "rear", edgeIndices: [2] });
    expect(plane.depth).toMatchObject({ value: 10, status: "computed", formula: "30 ft − 20 ft = 10 ft" });
    expect(plane.startHeight.value).toBe(75);
    expect(rearStepSetback({ rear: data(null, "ft"), rearAbove75: cited(30, "ft"), heightBreak: cited(75, "ft") }).depth.status).toBe("needs_input");
  });
  it("streetSetbackPlane records the base-height note and street kind", () => {
    const plane = streetSetbackPlane({ edgeIndex: 0, street: "narrow", baseMax: cited(75, "ft"), depth: cited(15, "ft") });
    expect(plane.appliesTo).toBe("narrow_street_frontage");
    expect(plane.startHeight.value).toBe(75);
    expect(plane.startHeight.note).toContain("not lower than the minimum base height");
    expect(streetSetbackPlane({ edgeIndex: 1, street: undefined, baseMax: cited(75, "ft"), depth: cited(15, "ft") }).appliesTo).toBe("street_frontage");
  });
  it("sepPlane", () => {
    const p = sepPlane({ edgeIndex: 0, street: "wide", initialSetback: cited(15, "ft"), startHeight: cited(60, "ft"), slope: cited(5.6, "ratio") });
    expect(p).toMatchObject({ id: "sep-edge0", appliesTo: "wide_street_frontage", edgeIndices: [0] });
    expect(p.slopeVerticalPerHorizontal.value).toBe(5.6);
  });
});
