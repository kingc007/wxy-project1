import { describe, expect, it } from "vitest";
import { computeBrief } from "./brief";
import { checkProvenance } from "./provenance-check";
import { makeSite } from "./test-utils";
import { computeFlags } from "./flags";
import type { BriefInput } from "./model";

const base: BriefInput = { intendedUse: "residential", programs: [], now: "2026-10-25T12:00:00.000Z", sample: true };

describe("SAMPLE commercial overlay (L5: C2-5 mapped in R7A)", () => {
  const b = computeBrief(makeSite("L5", { street: "narrow", cornerStreet: "narrow" }), { ...base, intendedUse: "mixed" });
  it("residential bulk from the underlying district, overlay adds commercial FAR only", () => {
    expect(b.controls.maxFar.residential).toMatchObject({ value: 4, status: "cited" });
    expect(b.controls.maxFar.residential.citations?.map((c) => c.section)).toEqual(["23-22", "34-111"]);
    expect(b.controls.maxFar.residential.appliesBecause).toContain("commercial overlay C2-5");
    expect(b.controls.maxFar.commercial).toMatchObject({ value: 2, status: "cited" });
    expect(b.controls.maxFar.commercial.citations?.[0].section).toBe("33-121");
    expect(b.controls.maxFloorArea.commercial.formula).toBe("2,021 sf × 2.00 FAR = 4,042 sf");
    expect(b.flags.some((f) => f.message.includes("Commercial overlay"))).toBe(false);
    expect(b.validation.errors).toEqual([]);
    expect(checkProvenance(b.envelope)).toEqual([]);
  });
});

describe("SAMPLE C4-4A residential equivalent", () => {
  const site = makeSite("L2");
  site.pluto!.zoneDist = ["C4-4A"];
  site.districts[0].code = "C4-4A";
  const b = computeBrief(site, { ...base, intendedUse: "mixed" });
  it("uses R7A for residential fields and says so", () => {
    expect(b.controls.maxFar.residential.value).toBe(4);
    expect(b.controls.maxFar.residential.appliesBecause).toBe("C4-4A → residential equivalent R7A (ZR 34-112)");
    expect(b.controls.maxFar.residential.citations?.map((c) => c.section)).toEqual(["23-22", "34-112"]);
    expect(b.controls.maxBuildingHeight.value).toBe(85);
    expect(b.controls.yards.rear.appliesBecause).toContain("C4-4A → residential equivalent R7A (ZR 34-112) · interior lot");
    expect(b.controls.maxFar.commercial).toMatchObject({ value: 4, status: "cited" });
    expect(b.controls.maxFar.community_facility.citations?.[0].section).toBe("33-123");
    expect(b.flags.some((f) => f.kind === "unsupported_district")).toBe(false);
    expect(b.validation.errors).toEqual([]);
    expect(checkProvenance(b.envelope)).toEqual([]);
  });
});

describe("SAMPLE M1-2", () => {
  const site = makeSite("L2", { street: "narrow" });
  site.pluto!.zoneDist = ["M1-2"];
  site.districts[0].code = "M1-2";
  const b = computeBrief(site, { ...base, intendedUse: "manufacturing" });
  it("manufacturing FAR and SEP; residential fields need input with the M1 note", () => {
    expect(b.controls.maxFar.manufacturing).toMatchObject({ value: 2, status: "cited" });
    expect(b.controls.maxFloorArea.manufacturing.value).toBe(5000);
    expect(b.controls.maxFar.residential).toMatchObject({ value: null, status: "needs_input", note: "Residential use in M1 not covered by this prototype's rule set" });
    expect(b.controls.yards.rear.status).toBe("needs_input");
    expect(b.controls.skyExposure.status).toBe("implemented");
    expect(b.controls.skyExposure.planes[0]).toMatchObject({ appliesTo: "narrow_street_frontage" });
    expect(b.controls.skyExposure.planes[0].initialSetback.value).toBe(20);
    expect(b.controls.skyExposure.planes[0].startHeight.value).toBe(60);
    expect(b.controls.skyExposure.planes[0].slopeVerticalPerHorizontal.value).toBe(2.7);
    expect(b.validation.errors).toEqual([]);
    expect(checkProvenance(b.envelope)).toEqual([]);
  });
  it("community facility FAR is available", () => {
    const c = computeBrief(site, { ...base, intendedUse: "community_facility" });
    expect(c.controls.maxFar.community_facility.value).toBe(4.8);
  });
});

describe("SAMPLE split lot (R7A 62% / R6A 38%)", () => {
  const site = makeSite("L6", { shares: { R7A: 0.62, R6A: 0.38 } });
  site.pluto!.zoneDist = ["R7A", "R6A"];
  site.districts[1].code = "R6A";
  site.districts[0].share = 0.62;
  site.districts[1].share = 0.38;
  const b = computeBrief(site, base);
  it("area-weighted FAR (ZR 77-22)", () => {
    expect(b.splitLot).toMatchObject({ isSplit: true, farMethod: "area_weighted" });
    const far = b.controls.maxFar.residential;
    expect(far).toMatchObject({ value: 3.62, status: "computed", confidence: "inferred", formula: "0.62 × 4.00 + 0.38 × 3.00 = 3.62" });
    expect(far.citations?.[0].section).toBe("77-22");
    expect(far.inputs).toHaveLength(4);
    expect(b.controls.maxFloorArea.residential.formula).toBe("2,568 sf × 3.62 FAR = 9,296.16 sf");
  });
  it("height and setback are manual with the 77-28 citation; differing yards manual or equal kept", () => {
    expect(b.controls.maxBuildingHeight).toMatchObject({ status: "manual", value: null });
    expect(b.controls.maxBuildingHeight.citations?.[0].section).toBe("77-28");
    expect(b.controls.setbacks[0].depth.status).toBe("manual");
    expect(b.controls.yards.front.value).toBe(0);
    expect(b.validation.errors).toEqual([]);
    expect(checkProvenance(b.envelope)).toEqual([]);
  });
  it("shares not summing to 1 leave FAR manual", () => {
    const s = makeSite("L6", { shares: { R7A: 0.4, R6A: 0.3 } });
    s.pluto!.zoneDist = ["R7A", "R6A"];
    s.districts[1].code = "R6A";
    s.districts[0].share = 0.4;
    s.districts[1].share = 0.3;
    expect(computeBrief(s, base).controls.maxFar.residential.status).toBe("manual");
  });
  it("flags unaffected", () => {
    expect(computeFlags(site).map((f) => f.kind)).toContain("split_lot");
  });
});
