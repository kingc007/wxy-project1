import { describe, expect, it } from "vitest";
import type { Controls } from "@/lib/zoning/model";
import { portionHeader, portionValue, rowId } from "./portion-cells";

const pv = (value: number) => ({ value, unit: "ratio" as const, status: "cited" as const, confidence: "cited" as const });
const c = {
  maxFar: { residential: pv(4), community_facility: pv(6.5) }, maxFloorArea: { residential: pv(1) },
  lotCoverage: { max: pv(80) }, baseHeight: { min: pv(40), max: pv(65) }, maxBuildingHeight: pv(75), maxStories: pv(7),
  yards: { front: pv(0), rear: pv(30), side: pv(0) },
} as unknown as Controls;

describe("portion cells", () => {
  it("finds per-portion values by bulk row label", () => {
    expect(portionValue(c, "Max FAR (residential)")?.value).toBe(4);
    expect(portionValue(c, "Max FAR (community facility)")?.value).toBe(6.5);
    expect(portionValue(c, "Rear yard")?.value).toBe(30);
    expect(portionValue(c, "Setback x — depth")).toBeUndefined();
  });
  it("builds headers and anchors", () => {
    expect(portionHeader(["R7A"], 0.7516)).toBe("R7A · 75%");
    expect(portionHeader(["R7A"], null)).toBe("R7A");
    expect(rowId("Max FAR (residential)")).toBe("bulk-max-far-residential");
  });
});
