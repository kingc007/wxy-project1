import { describe, expect, it } from "vitest";
import type { ZoningBrief } from "@/lib/zoning/model";
import { applyCrosscheck, rowLabelForField } from "./crosscheck-apply";

const pv = (value: number) => ({ value, unit: "ratio" as const, status: "cited" as const, confidence: "cited" as const });
const brief = {
  flags: [], bulkTable: [
    { rule: "ZR 23-22", label: "Max FAR (residential)", value: pv(3) },
    { rule: "ZR 23-342", label: "Rear yard", value: pv(20) },
  ],
} as unknown as ZoningBrief;

describe("applyCrosscheck", () => {
  it("marks disagreeing rows conflicting without touching values, and adds flags", () => {
    const out = applyCrosscheck(brief, { conflictingFields: ["maxFar.residential"], flags: [{ kind: "data_conflict", message: "x" }] });
    expect(out.bulkTable[0].value.confidence).toBe("conflicting");
    expect(out.bulkTable[0].value.value).toBe(3);
    expect(out.bulkTable[1].value.confidence).toBe("cited");
    expect(out.flags).toHaveLength(1);
    expect(brief.bulkTable[0].value.confidence).toBe("cited");
  });
  it("is a no-op on null or error", () => {
    expect(applyCrosscheck(brief, null)).toBe(brief);
    expect(applyCrosscheck(brief, { error: "agent unavailable" })).toBe(brief);
  });
  it("maps field names to row labels", () => {
    expect(rowLabelForField("yards.rear")).toBe("Rear yard");
    expect(rowLabelForField("nope")).toBeNull();
  });
});
