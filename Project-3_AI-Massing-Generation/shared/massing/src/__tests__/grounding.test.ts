import { describe, expect, it } from "vitest";
import { allowedNumbersFromOption, checkGrounding, extractNumbers, type AllowedNumber } from "../grounding";
import type { MassingOption, MassingParams } from "../types";

describe("extractNumbers", () => {
  it("handles thousands separators, decimals, percents, ordinals", () => {
    const r = extractNumbers("1,234 sf, 12.5 ft, 45% and FAR 3.00 on the 2nd floor, 6 floors");
    expect(r.map((x) => x.value)).toEqual([1234, 12.5, 45, 3, 2, 6]);
    expect(r.map((x) => x.kind)).toEqual(["plain", "plain", "percent", "plain", "ordinal", "plain"]);
  });
  it("skips digits glued to letters (district codes) and finds none in plain prose", () => {
    expect(extractNumbers("Fits in R6A and B2 zones")).toEqual([]);
    expect(extractNumbers("No numbers here.")).toEqual([]);
  });
  it("ignores sign", () => {
    expect(extractNumbers("down -5.5%")[0].value).toBe(5.5);
  });
});

const allowed: AllowedNumber[] = [
  { label: "gfa", value: 12340.4, decimals: -1 },
  { label: "height", value: 85.04, decimals: 1 },
  { label: "lot coverage", value: 45, decimals: 1 },
  { label: "far", value: 3, decimals: 2 },
  { label: "floors", value: 6, decimals: 0 },
  { label: "floor index", value: 2, decimals: 0 },
  { label: "setback", value: 12.5, decimals: 1 },
];

describe("checkGrounding", () => {
  it("accepts formatting variants", () => {
    const r = checkGrounding("Adds 12,340 sf at 85.0 ft, 45% coverage, FAR 3.00, 6 floors, the 2nd floor steps back 12.5 ft.", allowed);
    expect(r.unmatched).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.matched.length).toBe(7);
  });
  it("accepts within 0.5 % even when display rounding differs", () => {
    expect(checkGrounding("about 12,345 sf", allowed).ok).toBe(true);
    expect(checkGrounding("about 12,500 sf", allowed).ok).toBe(false);
  });
  it("reports invented numbers", () => {
    const r = checkGrounding("Reaches 120 units with FAR 3.00 and 7 floors.", allowed);
    expect(r.ok).toBe(false);
    expect(r.unmatched).toEqual(["120", "7"]);
  });
  it("a small integer is only allowed if it appears in allowed", () => {
    expect(checkGrounding("3 volumes", allowed).ok).toBe(true); // 3 == FAR value in this list
    expect(checkGrounding("4 volumes", allowed).ok).toBe(false);
  });
  it("an ordinal counts as a number and must be allowed", () => {
    expect(checkGrounding("the 3rd floor", allowed).ok).toBe(true); // 3 present (FAR)
    expect(checkGrounding("the 9th floor", allowed).ok).toBe(false);
  });
  it("ignoreTokens removes codes before extraction", () => {
    expect(checkGrounding("In the 2024 update, Jun 21 shows 6 floors", allowed).ok).toBe(false);
    expect(checkGrounding("In the 2024 update, Jun 21 shows 6 floors", allowed, { ignoreTokens: ["2024", "Jun 21"] }).ok).toBe(true);
  });
  it("text without numbers is grounded", () => {
    expect(checkGrounding("A calm courtyard scheme.", allowed).ok).toBe(true);
  });
  it("zero matches zero", () => {
    expect(checkGrounding("0 sf trimmed", [{ label: "trim", value: 0, decimals: 0 }]).ok).toBe(true);
  });
});

describe("allowedNumbersFromOption", () => {
  const params = { baseFloors: 4, baseDepth: 80, towerCoverage: 22.5, upperMode: "tower", clipToEnvelope: true } as unknown as MassingParams;
  const option = {
    id: "o1",
    typology: "podium_tower",
    params,
    floors: [],
    prisms: [],
    metrics: {
      lotArea: 10000,
      gfa: 31234,
      gfaByProgram: { residential: 30000, commercial: 1234, community_facility: 0 },
      zfa: 31234,
      far: 3.1234,
      farByProgram: { residential: 3, commercial: 0.1234, community_facility: 0 },
      floors: 8,
      height: 92.55,
      footprint: 6000,
      lotCoveragePct: 60,
      openSpacePct: 40,
      facadeArea: 50000,
      facadePerGfa: 1.6,
      volume: 300000,
      compactness: 5.1,
      unitsEst: 28,
      streetWallHeight: 45,
      trimmedVolume: 0,
      courtyardSunHours: null,
    },
    compliance: [
      { id: "height", rule: "Max building height", allowed: "100 ft", allowedValue: 100, proposed: "92.6 ft", proposedValue: 92.55, status: "pass", detail: null, citations: [], simplified: false },
      { id: "x", rule: "x", allowed: "", allowedValue: null, proposed: "", proposedValue: null, status: "review", detail: null, citations: [], simplified: false },
    ],
    overall: { status: "pass", failCount: 0, reviewCount: 0, label: "Passes all rules" },
    programFit: [{ use: "units", target: 30, proposed: 28, deltaPct: -6.7, met: false }],
    notes: [],
  } as unknown as MassingOption;
  const list = allowedNumbersFromOption(option);
  it("covers metrics, params, compliance, programFit and floor indices", () => {
    const text = "FAR 3.12 with 31,230 sf, 92.6 ft, 28 units against 30, 4 floors of podium, tower 22.5% of the lot, limit 100 ft, 7th floor, down 6.7%";
    expect(checkGrounding(text, list).unmatched).toEqual([]);
  });
  it("rejects values that are not computed", () => {
    expect(checkGrounding("holds 55 units", list).unmatched).toEqual(["55"]);
  });
  it("skips null values and merges extras", () => {
    expect(list.some((a) => a.label === "metrics.courtyardSunHours")).toBe(false);
    expect(allowedNumbersFromOption(option, [{ label: "e", value: 99, decimals: 0 }]).at(-1)?.value).toBe(99);
  });
});
