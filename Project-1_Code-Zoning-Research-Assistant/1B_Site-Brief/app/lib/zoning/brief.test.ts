import { describe, expect, it } from "vitest";
import { computeBrief } from "./brief";
import { checkProvenance } from "./provenance-check";
import { validateEnvelope } from "./envelope";
import { deriveAssumptions } from "./assumptions";
import { computeFlags } from "./flags";
import { LOTS, makeSite } from "./test-utils";
import type { BriefInput } from "./model";

const std: BriefInput = { intendedUse: "residential", programs: [], now: "2026-10-25T12:00:00.000Z", sample: true };

describe("SAMPLE L2 152 Attorney St (R7A, interior, narrow street, standard, attached)", () => {
  const b = computeBrief(makeSite("L2", { street: "narrow" }), std);
  const c = b.controls;
  it("FAR, floor area, coverage, heights, yards, setbacks", () => {
    expect(c.maxFar.residential).toMatchObject({ value: 4, status: "cited", confidence: "cited" });
    expect(c.maxFar.residential.citations?.[0].section).toBe("23-22");
    expect(c.maxFloorArea.residential).toMatchObject({ value: 10000, formula: "2,500 sf × 4.00 FAR = 10,000 sf" });
    expect(c.yards.rear).toMatchObject({ value: 30, status: "cited" });
    expect(c.yards.rear.appliesBecause).toContain("lot width 25 ft < 40 ft");
    expect(c.yards.front.value).toBe(0);
    expect(c.yards.side.value).toBe(0);
    expect(c.lotCoverage.max).toMatchObject({ value: 80, unit: "percent" });
    expect(c.baseHeight.min.value).toBe(40);
    expect(c.baseHeight.max.value).toBe(75);
    expect(c.maxBuildingHeight.value).toBe(85);
    expect(c.maxStories).toMatchObject({ value: null, status: "not_applicable", note: "ZR §23-432 sets heights, not a story limit" });
    const sb = c.setbacks.filter((s) => s.id.startsWith("street"));
    expect(sb).toHaveLength(1);
    expect(sb[0]).toMatchObject({ appliesTo: "narrow_street_frontage", edgeIndices: [0] });
    expect(sb[0].depth.value).toBe(15);
    expect(sb[0].startHeight.value).toBe(75);
  });
  it("narrow attached lot has no rear setback plane (30 ft at all heights)", () => {
    expect(c.setbacks.some((s) => s.appliesTo === "rear")).toBe(false);
    expect(b.calculations.find((x) => x.id === "rearYardStep")?.pvalue.status).toBe("not_applicable");
  });
  it("contextual district: sky exposure not applicable", () => {
    expect(c.skyExposure.status).toBe("not_applicable");
    expect(c.skyExposure.note).toBe("ZR 23-731: applies to R6 through R10 Districts without a letter suffix");
  });
  it("calculations and bulk table", () => {
    expect(b.calculations.find((x) => x.id === "coverageArea")?.pvalue.value).toBe(2000);
    expect(b.bulkTable.find((r) => r.label === "Max FAR (residential)")?.rule).toBe("ZR 23-22");
  });
  it("assumptions", () => {
    const ids = b.assumptions.map((a) => a.id);
    expect(ids).toEqual(["lotType", "street", "within100ftWideStreet", "buildingType", "siteCategory", "program", "intendedUse"]);
    const lt = b.assumptions[0];
    expect(lt.value).toBe("interior");
    expect(lt.reason).toContain("5 Inside – a tax lot with frontage on only one street");
    expect(b.assumptions.find((a) => a.id === "buildingType")?.statement).toBe("Assumed attached building (no side yards)");
    expect(b.assumptions.find((a) => a.id === "siteCategory")?.statement).toBe("Assumed standard lot (not an eligible site under ZR 23-434)");
  });
  it("envelope validates and provenance is complete", () => {
    expect(b.validation.errors).toEqual([]);
    expect(b.validation.valid).toBe(true);
    expect(checkProvenance(b.controls)).toEqual([]);
    expect(checkProvenance(b.envelope)).toEqual([]);
    const env = b.envelope as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(env.flags).toMatchObject({ draft: true, sample: true, simplified: true });
    expect(env.lot.polygonLocal).toEqual([[0, 0], [25, 0], [25, 100], [0, 100]]);
    expect(env.lot.origin).toEqual({ x: 985000, y: 200000 });
    expect(JSON.stringify(env)).not.toContain("appliesBecause");
    expect(JSON.stringify(env)).not.toContain("ruleIds");
    expect(env.controls.maxFar.residential.citations[0].title).toBe("Last amended 12/5/2024");
    expect(env.assumptions.find((a: { id: string }) => a.id === "buildingType").affects).toContain("/controls/yards/rear");
  });
});

describe("SAMPLE overrides", () => {
  it("override marks assumption overridden, keeps source value in reason, changes result", () => {
    const b = computeBrief(makeSite("L1"), { ...std, overrides: { buildingType: "detached" } });
    const a = b.assumptions.find((x) => x.id === "buildingType")!;
    expect(a.state).toBe("overridden");
    expect(a.value).toBe("detached");
    expect(a.reason).toContain("Source value: attached");
    expect(b.controls.yards.rear.value).toBe(20);
    expect(b.controls.yards.side.status).toBe("needs_input");
    expect(b.validation.valid).toBe(true);
    const env = b.envelope as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(env.assumptions.find((x: { id: string }) => x.id === "buildingType").overrideValue).toBe("detached");
  });
  it("street override to wide", () => {
    const b = computeBrief(makeSite("L2", { street: "narrow" }), { ...std, overrides: { street: "wide" } });
    expect(b.controls.setbacks.find((s) => s.id.startsWith("street"))?.depth.value).toBe(10);
  });
});

describe("SAMPLE L1 287 Convent Ave (R6A, 46.75 ft wide): rear yard step", () => {
  it("wide interior lot gets 20 ft rear yard and a 10 ft step above 75 ft", () => {
    const b = computeBrief(makeSite("L1"), std);
    expect(b.controls.yards.rear.value).toBe(20);
    const step = b.controls.setbacks.find((s) => s.appliesTo === "rear")!;
    expect(step.startHeight.value).toBe(75);
    expect(step.depth).toMatchObject({ value: 10, formula: "30 ft − 20 ft = 10 ft" });
    expect(b.controls.maxFloorArea.residential.formula).toBe("4,675 sf × 3.00 FAR = 14,025 sf");
    expect(b.validation.valid).toBe(true);
  });
  it("qualifying_affordable program adds variants and raised heights", () => {
    const b = computeBrief(makeSite("L1"), { ...std, programs: ["qualifying_affordable"] });
    expect(b.controls.maxFar.residential_qualifying_affordable.value).toBe(3.9);
    expect(b.controls.maxFloorArea.residential_qualifying_affordable.value).toBe(18232.5);
    expect(b.controls.maxBuildingHeight.value).toBe(95);
    expect(b.controls.programs).toEqual(["qualifying_affordable"]);
  });
  it("R5-only FAR variant with no rule is needs_input", () => {
    const b = computeBrief(makeSite("L1"), { ...std, programs: ["qualifying_residential_site"] });
    expect(b.controls.maxFar.residential_qualifying_residential_site.status).toBe("needs_input");
    expect(b.validation.valid).toBe(true);
  });
});

describe("SAMPLE L5 270 East 3 St (R7A corner)", () => {
  const b = computeBrief(makeSite("L5", { street: "narrow", cornerStreet: "narrow" }), std);
  it("coverage 100, rear yard needs input (rules cover interior lots only)", () => {
    expect(b.controls.lotCoverage.max.value).toBe(100);
    expect(b.controls.yards.rear.status).toBe("needs_input");
    expect(b.controls.yards.rear.note).toContain("No rule in this prototype's rule set for R7A/yards.rear");
    expect(b.controls.setbacks.filter((s) => s.id.startsWith("street"))).toHaveLength(2);
    expect(b.validation.valid).toBe(true);
    expect(checkProvenance(b.controls)).toEqual([]);
  });
  it("overlay with a rule (C2-5) is not flagged; overlay without a rule is", () => {
    expect(b.flags.some((f) => f.message.includes("Commercial overlay"))).toBe(false);
    const s = makeSite("L5");
    s.pluto!.overlays = ["C1-6"];
    const f = computeFlags(s).find((x) => x.message.startsWith("Commercial overlay"));
    expect(f?.message).toBe("Commercial overlay C1-6: commercial FAR rules not yet in this prototype's rule set — Needs input");
  });
});

describe("SAMPLE L4 501 East 145 St (R6 corner, wide + narrow)", () => {
  const b = computeBrief(makeSite("L4", { street: "wide", cornerStreet: "narrow" }), std);
  it("R6 FAR uses within-100-ft-of-wide-street row, per-edge setbacks, SEP planes", () => {
    expect(b.controls.maxFar.residential.value).toBe(3);
    expect(b.controls.baseHeight.max.value).toBe(65);
    expect(b.controls.maxBuildingHeight.value).toBe(75);
    const sb = b.controls.setbacks.filter((s) => s.id.startsWith("street"));
    expect(sb.map((s) => [s.edgeIndices, s.appliesTo, s.depth.value])).toEqual([
      [[0], "wide_street_frontage", 10],
      [[1], "narrow_street_frontage", 15],
    ]);
    expect(b.controls.skyExposure.status).toBe("implemented");
    expect(b.controls.skyExposure.note).toContain("ZR 23-731");
    const planes = b.controls.skyExposure.planes;
    expect(planes.map((p) => [p.initialSetback.value, p.startHeight.value, p.slopeVerticalPerHorizontal.value])).toEqual([[15, 60, 5.6], [20, 60, 2.7]]);
    expect(b.validation.valid).toBe(true);
    expect(checkProvenance(b.envelope)).toEqual([]);
  });
  it("all-narrow R6 lot uses 2.20 FAR", () => {
    const n = computeBrief(makeSite("L4", { street: "narrow", cornerStreet: "narrow" }), std);
    expect(n.controls.maxFar.residential.value).toBe(2.2);
  });
  it("unknown street width leaves street-dependent values as needs_input", () => {
    const u = computeBrief(makeSite("L9", { street: "unknown" }), std);
    expect(u.assumptions.find((a) => a.id === "street")).toMatchObject({ value: "unknown", confidence: "unverified" });
    expect(u.controls.maxFar.residential.status).toBe("needs_input");
    expect(u.controls.setbacks.find((s) => s.edgeIndices?.[0] === 0)?.depth.status).toBe("needs_input");
    expect(u.validation.valid).toBe(true);
  });
});

describe("SAMPLE L6 196 East 3 St (split R7A / R8B)", () => {
  const b = computeBrief(makeSite("L6", { shares: { R7A: 0.62, R8B: 0.38 } }), std);
  it("isSplit, portions, top-level manual", () => {
    expect(b.splitLot.isSplit).toBe(true);
    expect(b.splitLot.portions.map((p) => [p.districtCodes[0], p.share])).toEqual([["R7A", 0.62], ["R8B", 0.38]]);
    expect(b.splitLot.portions[0].controls.maxFar.residential.value).toBe(4);
    expect(b.splitLot.portions[1].controls.maxFar.residential.status).toBe("needs_input");
    expect(b.controls.maxFar.residential.status).toBe("manual");
    expect(b.controls.maxFar.residential.value).toBeNull();
    expect(b.controls.maxFloorArea.residential.status).toBe("manual");
    expect(b.flags.map((f) => f.kind)).toEqual(expect.arrayContaining(["split_lot", "unsupported_district"]));
    expect(b.validation.errors).toEqual([]);
    expect(checkProvenance(b.envelope)).toEqual([]);
    const env = b.envelope as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(env.splitLot.isSplit).toBe(true);
    expect(env.splitLot.portions).toHaveLength(2);
  });
  it("identical values across portions are kept (R7A + R7A-like): front yard 0 vs unsupported -> manual", () => {
    expect(b.controls.yards.front.status).toBe("manual");
  });
});

describe("SAMPLE unsupported district", () => {
  it("L7 (M1-1 / R7-1 split) yields flags and no invented numbers", () => {
    const b = computeBrief(makeSite("L7"), std);
    expect(b.flags.map((f) => f.message).join(" ")).toContain("R7-1");
    expect(b.controls.skyExposure.status === "manual" || b.controls.skyExposure.status === "implemented" || b.controls.skyExposure.status === "not_applicable").toBe(true);
    expect(b.controls.yards.rear.status).toBe("needs_input");
    expect(b.validation.valid).toBe(true);
    expect(checkProvenance(b.envelope)).toEqual([]);
  });
});

describe("flags", () => {
  it("L9 landmark, L10 historic district, L8 special district, irregular lot", () => {
    expect(computeFlags(makeSite("L9")).map((f) => f.kind)).toContain("landmark");
    expect(computeFlags(makeSite("L10")).map((f) => f.kind)).toContain("historic_district");
    const sp = computeFlags(makeSite("L8")).find((f) => f.kind === "special_district")!;
    expect(sp.message).toContain("Special district rules may modify or supersede the underlying district; not modelled");
    const s = makeSite("L2");
    s.pluto!.irrLot = true;
    expect(computeFlags(s).map((f) => f.kind)).toContain("irregular_lot");
  });
  it("lottype 6, data conflict, wide-street depth > 100, eligible site", () => {
    const s = makeSite("L2");
    s.pluto!.lotType = 6;
    expect(computeFlags(s).some((f) => f.message.includes("no street frontage"))).toBe(true);
    const a = deriveAssumptions(s, { intendedUse: "residential", programs: [] });
    expect(a[0]).toMatchObject({ value: "interior", confidence: "unverified" });
    const c = makeSite("L2");
    c.districts = [{ ...c.districts[0], code: "R8A" }];
    expect(computeFlags(c).map((f) => f.kind)).toContain("data_conflict");
    const w = makeSite("L6", { street: "wide" });
    expect(computeFlags(w).some((f) => f.message.includes("ZR 23-22 fn 1/2"))).toBe(true);
    const big = makeSite("L2");
    big.pluto!.lotArea = 20000;
    expect(computeFlags(big).some((f) => f.message.includes("eligible site (ZR 23-434)"))).toBe(true);
  });
  it("other/null lottype needs input", () => {
    const s = makeSite("L2");
    s.pluto!.lotType = null;
    const b = computeBrief(s, std);
    expect(b.assumptions[0]).toMatchObject({ value: "unknown", options: ["interior", "corner", "through"] });
    expect(b.controls.lotCoverage.max.status).toBe("needs_input");
    expect(b.validation.valid).toBe(true);
  });
});

describe("envelope + provenance across all SAMPLE parcels L1-L10", () => {
  for (const key of Object.keys(LOTS)) {
    it(`${key}: validates and every non-null value is supported`, () => {
      const b = computeBrief(makeSite(key, { shares: { R7A: 0.6, R8B: 0.4, "M1-1": 0.5, "R7-1": 0.5 } }), { ...std, programs: ["qualifying_affordable"], intendedUse: "mixed" });
      expect(b.validation.errors).toEqual([]);
      expect(checkProvenance(b.controls)).toEqual([]);
      expect(checkProvenance(b.envelope)).toEqual([]);
    });
  }
  it("missing geometry yields a validation error rather than invented geometry", () => {
    const b = computeBrief(makeSite("L2", { geometry: false }), std);
    expect(b.validation.valid).toBe(false);
  });
});

describe("checkProvenance", () => {
  it("fails a deliberately uncited value", () => {
    const bad = { yards: { rear: { value: 30, unit: "ft", status: "cited", confidence: "cited" } } };
    expect(checkProvenance(bad)).toEqual(["yards.rear: cited value without a valid citation"]);
  });
  it("fails each status when support is missing", () => {
    const mk = (status: string, extra: object = {}) => ({ value: 1, unit: "ft", status, confidence: "cited", ...extra });
    expect(checkProvenance({ a: mk("data") })).toHaveLength(1);
    expect(checkProvenance({ a: mk("computed", { formula: "x" }) })).toHaveLength(1);
    expect(checkProvenance({ a: mk("assumed") })).toHaveLength(1);
    expect(checkProvenance({ a: mk("needs_input") })).toHaveLength(1);
    expect(checkProvenance({ a: mk("cited", { citations: [{ section: "1", quote: "" }] }) })).toHaveLength(1);
  });
  it("accepts supported and null values", () => {
    expect(checkProvenance({ a: { value: null, unit: "ft", status: "needs_input", confidence: "unverified" } })).toEqual([]);
    expect(checkProvenance({ a: { value: 1, unit: "ft", status: "computed", confidence: "cited", formula: "f", inputs: ["x"] } })).toEqual([]);
  });
  it("an invalid envelope is detected by validateEnvelope", () => {
    expect(validateEnvelope({}).valid).toBe(false);
  });
});

describe("bulk table labels are human-readable (ids unchanged)", () => {
  it("street setback and SEP labels use street name, width class and kind", () => {
    const b = computeBrief(makeSite("L4", { street: "wide", cornerStreet: "narrow" }), std);
    const labels = b.bulkTable.map((r) => r.label);
    expect(labels).toContain("Street setback — SAMPLE STREET (wide) — start height");
    expect(labels).toContain("Street setback — SAMPLE AVENUE (narrow) — depth");
    expect(labels).toContain("Sky exposure plane — SAMPLE STREET (wide) — slope");
    expect(labels).toContain("Sky exposure plane — SAMPLE AVENUE (narrow) — initial setback");
    expect(labels.some((l) => /street-setback-edge|sep-edge|setbacks-manual/.test(l))).toBe(false);
    expect(b.controls.setbacks.map((s) => s.id)).toEqual(["street-setback-edge0", "street-setback-edge1"]);
  });
  it("rear step and split-lot labels", () => {
    const l1 = computeBrief(makeSite("L1"), std).bulkTable.map((r) => r.label);
    expect(l1).toContain("Rear setback above 75 ft");
    expect(l1).toContain("Rear setback — start height");
    const l6 = computeBrief(makeSite("L6", { shares: { R7A: 0.62, R8B: 0.38 } }), std).bulkTable.map((r) => r.label);
    expect(l6).toContain("Street setbacks (split lot) — depth");
    expect(l6.some((l) => l.includes("setbacks-manual-split"))).toBe(false);
  });
});

describe("street width confidence (DCM layer is informational)", () => {
  it("street assumption is inferred; dependent setbacks are inferred; street-independent values stay cited", () => {
    const b = computeBrief(makeSite("L2", { street: "narrow" }), std);
    expect(b.assumptions.find((a) => a.id === "street")?.confidence).toBe("inferred");
    expect(b.controls.setbacks.find((s) => s.id.startsWith("street"))?.depth).toMatchObject({ value: 15, confidence: "inferred", assumptionIds: ["street"] });
    expect(b.controls.maxFar.residential.confidence).toBe("cited");
    const c = computeBrief(makeSite("L4", { street: "wide", cornerStreet: "narrow" }), std);
    expect(c.controls.setbacks.filter((s) => s.id.startsWith("street")).every((s) => s.depth.confidence === "inferred")).toBe(true);
    expect(c.controls.skyExposure.planes.every((p) => p.slopeVerticalPerHorizontal.confidence === "inferred")).toBe(true);
  });
});
