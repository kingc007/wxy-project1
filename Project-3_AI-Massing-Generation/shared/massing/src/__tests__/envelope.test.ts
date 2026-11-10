import { beforeAll, describe, expect, it } from "vitest";
import { buildEnvelopeModel, envelopeInsetAt, parseEnvelope, sectionAt, designFrame } from "../envelope";
import { area, initGeometry, liveGeometryObjects } from "../geom2d";
import { lShapedLot, pv, squareLot, squareLotWithSep } from "./fixtures/envelopes";

beforeAll(async () => {
  await initGeometry();
});

describe("envelope: square lot", () => {
  const m = buildEnvelopeModel(squareLot());
  it("lot, frontage and flags", () => {
    expect(m.lotArea).toBe(10000);
    expect(m.frontageEdgeIndex).toBe(0);
    expect(m.sample).toBe(true);
    expect(m.edges.map((e) => e.length)).toEqual([100, 100, 100, 100]);
  });
  it("sectionAt: rear yard, setback, max height", () => {
    expect(area(sectionAt(m, 0))).toBeCloseTo(7000, 6);
    expect(area(sectionAt(m, 60))).toBeCloseTo(7000, 6); // not above 60
    expect(area(sectionAt(m, 70))).toBeCloseTo(5500, 6);
    expect(area(sectionAt(m, 100))).toBeCloseTo(5500, 6);
    expect(sectionAt(m, 101)).toEqual([]);
    expect(liveGeometryObjects()).toBe(0);
  });
  it("insets per edge", () => {
    expect(envelopeInsetAt(m, 0, 10)).toBe(0);
    expect(envelopeInsetAt(m, 0, 70)).toBe(15);
    expect(envelopeInsetAt(m, 2, 10)).toBe(30);
    expect(envelopeInsetAt(m, 1, 70)).toBe(0);
  });
  it("breakHeights", () => {
    expect(m.breakHeights).toEqual([0, 60, 100]);
  });
  it("unusable controls go to unchecked[] with a reason and impose no geometry", () => {
    const paths = m.unchecked.map((u) => u.path);
    expect(paths).toContain("/controls/baseHeight/min");
    expect(paths).toContain("/controls/maxStories");
    const min = m.unchecked.find((u) => u.path === "/controls/baseHeight/min");
    expect(min?.reason).toBe("Not checked — needs_input");
    expect(min?.kind).toBe("needs_input");
    expect(m.unchecked.find((u) => u.path === "/controls/maxStories")?.kind).toBe("manual");
    expect(m.baseHeightMin).toBeNull();
    expect(m.maxStories).toBeNull();
  });
  it("not_applicable controls are kept apart from needs_input/manual and carry the note", () => {
    const sky = m.unchecked.find((u) => u.path === "/controls/skyExposure");
    expect(sky).toMatchObject({ kind: "not_applicable", reason: "TEST FIXTURE: no sky exposure plane on this lot" });
    const j = squareLot() as unknown as { controls: { maxStories: unknown } };
    j.controls.maxStories = { value: null, unit: "stories", status: "not_applicable", confidence: "inferred", note: "no stories limit" };
    const m2 = buildEnvelopeModel(j);
    expect(m2.unchecked.find((u) => u.path === "/controls/maxStories")).toMatchObject({ kind: "not_applicable", reason: "no stories limit" });
    expect(m2.maxStories).toBeNull();
  });
  it("unusable max height means no cap", () => {
    const m2 = buildEnvelopeModel(squareLot({ maxHeight: null }));
    expect(m2.maxBuildingHeight).toBeNull();
    expect(area(sectionAt(m2, 5000))).toBeGreaterThan(0);
    expect(m2.unchecked.map((u) => u.path)).toContain("/controls/maxBuildingHeight");
  });
  it("controls carry designer labels and citations", () => {
    expect(m.maxBuildingHeight?.label).toBe("Max building height");
    expect(m.yards.rear?.label).toBe("Rear yard");
    expect(m.maxFar.residential?.citations[0].source).toBe("TEST FIXTURE");
  });
  it("uses the recorded lot area for zoning ratios and notes when the outline differs by > 1 %", () => {
    const j = squareLot() as unknown as { lot: { area: unknown } };
    j.lot.area = { value: 9000, unit: "sf", status: "data", confidence: "cited", provenance: [{ dataset: "TEST", fetchedAt: "2026-01-01T00:00:00Z" }] };
    const m3 = buildEnvelopeModel(j);
    expect(m3.lotArea).toBe(9000);
    expect(m3.lotAreaSource).toBe("data");
    expect(m3.polygonArea).toBe(10000);
    expect(m3.notes).toContain("Lot area from data (9,000 sf) is used for FAR, coverage and open space; the drawn lot outline measures 10,000 sf.");
  });
  it("falls back to the outline's area when the envelope has no usable lot area", () => {
    const j = squareLot() as unknown as { lot: { area: unknown } };
    j.lot.area = { value: null, unit: "sf", status: "needs_input" };
    const m4 = buildEnvelopeModel(j);
    expect(m4.lotArea).toBe(10000);
    expect(m4.lotAreaSource).toBe("polygon");
  });
});

describe("envelope: sky exposure plane", () => {
  const m = buildEnvelopeModel(squareLotWithSep());
  it("insets at known heights", () => {
    expect(envelopeInsetAt(m, 0, 40)).toBe(0);
    expect(envelopeInsetAt(m, 0, 41)).toBe(5); // max(initial 5, 1/2)
    expect(envelopeInsetAt(m, 0, 50)).toBe(5);
    expect(envelopeInsetAt(m, 0, 60)).toBe(10);
    expect(envelopeInsetAt(m, 0, 100)).toBe(30);
    expect(envelopeInsetAt(m, 1, 100)).toBe(0);
  });
  it("sections shrink with height", () => {
    expect(area(sectionAt(m, 100))).toBeCloseTo(70 * 100, 6);
    expect(area(sectionAt(m, 60))).toBeCloseTo(90 * 100, 6);
    expect(m.breakHeights).toContain(45);
  });
  it("manual sky exposure is unchecked, not geometry", () => {
    const j = squareLot() as unknown as { controls: { skyExposure: unknown } };
    j.controls.skyExposure = { status: "manual", note: null };
    const m2 = buildEnvelopeModel(j);
    expect(m2.skyExposure).toEqual([]);
    expect(m2.unchecked.some((u) => u.path === "/controls/skyExposure")).toBe(true);
  });
});

describe("envelope: concave lot and frames", () => {
  it("L lot: rear strips use 0 extension at the reflex corner", () => {
    const m = buildEnvelopeModel(lShapedLot());
    expect(m.lotArea).toBe(7500);
    expect(area(sectionAt(m, 0))).toBeCloseTo(6500, 6);
  });
  it("frontage frame follows the front edge", () => {
    const m = buildEnvelopeModel(lShapedLot(5));
    expect(m.frontageEdgeIndex).toBe(5);
    const f = designFrame(m);
    expect(f.u[1]).toBeCloseTo(-1, 9);
    expect(f.v[0]).toBeCloseTo(1, 9);
  });
  it("longest front edge wins; ties go to the lowest index", () => {
    const j = squareLot() as unknown as { lot: { edges: { kind: string }[] } };
    j.lot.edges[3].kind = "front";
    expect(buildEnvelopeModel(j).frontageEdgeIndex).toBe(0);
  });
  it("front edge with unknown street width matches both wide and narrow (noted)", () => {
    const j = squareLot() as unknown as { lot: { edges: { street?: unknown }[] }; controls: { setbacks: { appliesTo: string }[] } };
    j.lot.edges[0].street = { name: null, width: "unknown" };
    j.controls.setbacks[0].appliesTo = "narrow_street_frontage";
    const m = buildEnvelopeModel(j);
    expect(m.setbacks[0].edgeIndices).toEqual([0]);
    expect(m.notes.some((n) => n.includes("unknown street width"))).toBe(true);
  });
  it("unknown frontage street width is noted (street wall uses 10 ft)", () => {
    const j = squareLot() as unknown as { lot: { edges: { street?: unknown }[] } };
    j.lot.edges[0].street = { name: null, width: "unknown" };
    expect(buildEnvelopeModel(j).notes.some((n) => n.includes("street-wall location test uses 10 ft"))).toBe(true);
    expect(buildEnvelopeModel(squareLot()).notes.some((n) => n.includes("street-wall"))).toBe(false);
  });
  it("rejects bad input with a path", () => {
    expect(() => buildEnvelopeModel(null)).toThrow();
    const cw = squareLot() as unknown as { lot: { polygonLocal: number[][] } };
    cw.lot.polygonLocal.reverse();
    expect(() => parseEnvelope(cw)).toThrow(/counter-clockwise/);
    const bad = squareLot() as unknown as { controls: { maxBuildingHeight: unknown } };
    bad.controls.maxBuildingHeight = { value: "tall", unit: "ft", status: "cited" };
    expect(() => buildEnvelopeModel(bad)).toThrow(/maxBuildingHeight\/value/);
  });
  it("non-modelled FAR keys are listed as unchecked", () => {
    const j = squareLot() as unknown as { controls: { maxFar: Record<string, unknown> } };
    j.controls.maxFar.residential_qualifying_affordable = pv(5, "ratio");
    j.controls.maxFar.commercial = pv(null, "ratio", "needs_input");
    const m = buildEnvelopeModel(j);
    expect(m.maxFar.commercial).toBeUndefined();
    const paths = m.unchecked.map((u) => u.path);
    expect(m.unchecked.find((u) => u.path.endsWith("qualifying_affordable"))?.kind).toBe("not_modelled");
    expect(paths).toContain("/controls/maxFar/residential_qualifying_affordable");
    expect(paths).toContain("/controls/maxFar/commercial");
  });
});

// Manager regression (2026-10-26): with no usable max height, sky-exposure envelopes must still be sampled to the top.
import { readFileSync as _readSampleC } from "node:fs";
import { buildEnvelopeModel as _build, sectionAt as _section, initGeometry as _init } from "../index";
describe("sample C sky exposure plane break heights", () => {
  it("samples the plane every 5 ft until the section closes", async () => {
    await _init();
    const m = _build(JSON.parse(_readSampleC("data/samples/sample-c-r10-through-sep.json", "utf8")));
    const top = m.breakHeights[m.breakHeights.length - 1];
    expect(top).toBeGreaterThan(200);
    expect(_section(m, top + 0.01).length).toBe(0);
    expect(_section(m, top - 5).length).toBeGreaterThan(0);
  });
});
