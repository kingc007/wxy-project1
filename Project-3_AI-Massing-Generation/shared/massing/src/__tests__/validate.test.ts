import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatEnvelopeErrors, pointerToPath, validateEnvelope } from "../validate";

// SAMPLE: minimal synthetic envelope that satisfies the schema (not real zoning values).
const pv = (value: number | null, unit: string, status = "assumed") => ({
  value,
  unit,
  status,
  confidence: "inferred",
  ...(status === "assumed" ? { assumptionIds: ["a1"] } : {}),
});
function sample() {
  return {
    schemaVersion: "1.0.0",
    envelopeId: "TEST-SAMPLE",
    generatedAt: "2026-10-25T12:00:00Z",
    flags: { draft: true, sample: true, simplified: true, simplifications: ["test"] },
    jurisdiction: { id: "test", name: "Test", code: { name: "Test code", versionLabel: "v0", effectiveDate: null } },
    site: { parcelId: "0" },
    lot: {
      crs: { reference: "EPSG:2263", lengthUnit: "ft" },
      origin: { x: 0, y: 0 },
      polygonLocal: [[0, 0], [100, 0], [100, 100], [0, 100]],
      area: pv(10000, "sf", "computed") && { ...pv(10000, "sf", "computed"), formula: "100 x 100", inputs: ["/lot/polygonLocal"] },
      lotType: { value: "interior", status: "assumed" },
      edges: [{ index: 0, kind: "front" }, { index: 1, kind: "side" }, { index: 2, kind: "rear" }, { index: 3, kind: "side" }],
    },
    districts: [{ code: "T1", kind: "base", provenance: [{ dataset: "SAMPLE", fetchedAt: "2026-10-25T12:00:00Z" }] }],
    controls: {
      maxFar: { residential: pv(3, "ratio") },
      maxFloorArea: {},
      baseHeight: { min: pv(null, "ft", "needs_input"), max: pv(null, "ft", "needs_input") },
      maxBuildingHeight: pv(85, "ft"),
      setbacks: [],
      yards: { front: pv(0, "ft"), rear: pv(30, "ft"), side: pv(0, "ft") },
      lotCoverage: { max: pv(null, "percent", "needs_input") },
      skyExposure: { status: "not_applicable" },
    },
    assumptions: [{ id: "a1", statement: "s", reason: "r", state: "accepted" }],
    reviewFlags: [],
    provenance: { datasets: [] },
  };
}

describe("validateEnvelope", () => {
  it("accepts a minimal valid envelope (date-time and date formats are checked)", () => {
    const r = validateEnvelope(sample());
    expect(r.ok).toBe(true);
  });
  it("copied schema is byte-identical to the canonical file when it is reachable", () => {
    const canonical = path.resolve(__dirname, "../../../../../_Shared/schemas/zoning-envelope.schema.json");
    const local = path.resolve(__dirname, "../../data/zoning-envelope.schema.json");
    let canon: Buffer | null = null;
    try {
      canon = readFileSync(canonical);
    } catch {
      canon = null; // canonical not reachable from this checkout
    }
    if (canon) expect(readFileSync(local).equals(canon)).toBe(true);
    expect(JSON.parse(readFileSync(local, "utf8")).$id).toBe("https://wxy.local/schemas/zoning-envelope.schema.json");
  });
  it("rejects non-objects", () => {
    for (const bad of [null, 5, "x", []]) expect(validateEnvelope(bad).ok).toBe(false);
  });
  it("reports a missing required field with its path", () => {
    const e = sample() as Record<string, unknown>;
    delete e.lot;
    const r = validateEnvelope(e);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((x) => x.path === "lot" && /missing/.test(x.message))).toBe(true);
  });
  it("reports wrong type with a dotted path", () => {
    const e = sample();
    (e.controls.maxBuildingHeight as { value: unknown }).value = "tall";
    const r = validateEnvelope(e);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const hit = r.errors.find((x) => x.path === "controls.maxBuildingHeight.value");
      expect(hit?.message).toMatch(/must be number or null/);
    }
  });
  it("rejects unknown properties and a wrong schemaVersion", () => {
    const e = { ...sample(), bogus: 1, schemaVersion: "2.0.0" };
    const r = validateEnvelope(e);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((x) => x.path === "bogus" && /allowed/.test(x.message))).toBe(true);
      expect(r.errors.some((x) => x.path === "schemaVersion")).toBe(true);
    }
  });
  it("enforces status conditionals (cited needs citations) and array indices in paths", () => {
    const e = sample();
    e.controls.maxBuildingHeight = pv(85, "ft", "cited") as never;
    const r = validateEnvelope(e);
    expect(r.ok).toBe(false);
    const e2 = sample();
    e2.lot.polygonLocal[1] = [100] as never;
    const r2 = validateEnvelope(e2);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.errors.some((x) => x.path.startsWith("lot.polygonLocal[1]"))).toBe(true);
  });
  it("rejects a bad date-time", () => {
    const e = { ...sample(), generatedAt: "yesterday" };
    const r = validateEnvelope(e);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].message).toMatch(/valid date-time/);
  });
  it("does not leak noisy 'if' errors and de-duplicates", () => {
    const e = sample();
    e.controls.maxBuildingHeight = pv(85, "ft", "cited") as never;
    const r = validateEnvelope(e);
    if (!r.ok) {
      expect(r.errors.every((x) => !/"if"/.test(x.message))).toBe(true);
      expect(new Set(r.errors.map((x) => x.path + x.message)).size).toBe(r.errors.length);
    }
  });
});

describe("helpers", () => {
  it("pointerToPath", () => {
    expect(pointerToPath("")).toBe("");
    expect(pointerToPath("/lot/polygonLocal/1/0")).toBe("lot.polygonLocal[1][0]");
    expect(pointerToPath("/a~1b/c~0d")).toBe("a/b.c~d");
  });
  it("formatEnvelopeErrors follows the copy deck", () => {
    const s = formatEnvelopeErrors([
      { path: "lot", message: "lot is missing" },
      { path: "a", message: "a must be number" },
      { path: "b", message: "b x" },
      { path: "c", message: "c y" },
    ]);
    expect(s).toBe("This file isn't a valid zoning envelope: lot is missing; a must be number; b x (and 1 more). Check it against zoning-envelope.schema.json.");
  });
});
