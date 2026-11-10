import { describe, expect, it } from "vitest";
import type { Assumption, PValue } from "@/lib/types";
import { decisionOf, markKind, openAssumptions, summarize } from "./review";

const pv = (over: Partial<PValue>): PValue => ({ value: 1, unit: "ratio", status: "cited", confidence: "cited", ...over });
const asm = (over: Partial<Assumption>): Assumption => ({
  id: "a1", key: "lotType", value: "inside", statement: "s", reason: "r", state: "proposed",
  options: ["inside", "corner"], confidence: "inferred", ...over,
});

describe("markKind", () => {
  it("maps value status first, then confidence", () => {
    expect(markKind(pv({ status: "needs_input", value: null }))).toBe("needs-input");
    expect(markKind(pv({ status: "computed" }))).toBe("computed");
    expect(markKind(pv({ confidence: "inferred", status: "assumed" }))).toBe("inferred");
    expect(markKind(pv({}))).toBe("cited");
  });
});

describe("summarize", () => {
  const rows = [
    { rule: "a", label: "A", value: pv({}) },
    { rule: "b", label: "B", value: pv({}) },
    { rule: "c", label: "C", value: pv({ confidence: "inferred", status: "assumed" }) },
    { rule: "d", label: "D", value: pv({ status: "needs_input", value: null }) },
    { rule: "e", label: "E", value: pv({ status: "not_applicable", value: null }) },
    { rule: "f", label: "F", value: pv({ confidence: "unverified" }) },
    { rule: "g", label: "G", value: pv({ status: "computed" }) },
  ];
  const assumptions = [
    asm({ id: "a1" }),
    asm({ id: "a2", key: "street" }),
    asm({ id: "a3", key: "buildingType", state: "overridden" }),
    asm({ id: "u1", key: "intendedUse", confidence: "cited", state: "accepted" }),
    asm({ id: "u2", key: "program", confidence: "inferred" }),
  ];

  it("counts values by status and ignores computed and not applicable rows", () => {
    const s = summarize(rows, assumptions, [], {});
    expect([s.cited, s.inferred, s.needsInput, s.unsettled]).toEqual([2, 1, 1, 1]);
  });

  it("counts only assumptions a reviewer can act on, and treats overrides as reviewed", () => {
    expect(openAssumptions(assumptions).map((a) => a.id)).toEqual(["a1", "a2", "a3", "u2"]);
    const s = summarize(rows, assumptions, [], {});
    expect([s.assumptionsTotal, s.assumptionsReviewed]).toEqual([3, 1]);
    const t = summarize(rows, assumptions, [{ kind: "landmark", message: "m" }], { a1: "accepted", a2: "rejected" });
    expect([t.assumptionsTotal, t.assumptionsReviewed, t.flags]).toEqual([3, 3, 1]);
  });

  it("decisionOf prefers the session decision", () => {
    expect(decisionOf(asm({ state: "overridden" }), {})).toBe("edited");
    expect(decisionOf(asm({}), { a1: "rejected" })).toBe("rejected");
    expect(decisionOf(asm({}), {})).toBeNull();
  });
});
