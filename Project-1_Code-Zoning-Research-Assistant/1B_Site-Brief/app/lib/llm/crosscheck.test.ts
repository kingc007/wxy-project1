import { describe, expect, it } from "vitest";
import { compareSelections } from "./crosscheck";
import { sampleBrief } from "./helpers.test-util";

const brief = sampleBrief();
const far = "R7A.far.res.std";

describe("compareSelections", () => {
  it("agree / agent_missing / engine_missing", () => {
    const r = compareSelections([{ field: "maxFar.residential", ruleId: far, reason: "x" }, { field: "maxFar.commercial", ruleId: "C1.far", reason: "x" }], brief);
    const by = Object.fromEntries(r.comparisons.map((c) => [c.field, c.status]));
    expect(by["maxFar.residential"]).toBe("agree");
    expect(by["maxFar.commercial"]).toBe("engine_missing");
    expect(by["yards.rear"]).toBe("agent_missing");
    expect(r.flags).toHaveLength(0);
  });
  it("disagreement flags data_conflict, demotes confidence, never changes values", () => {
    const r = compareSelections([{ field: "maxFar.residential", ruleId: "R7A.far.other", reason: "x" }], brief);
    expect(r.disagreements).toEqual(["maxFar.residential"]);
    expect(r.flags[0]).toMatchObject({ kind: "data_conflict", message: "Model and rule engine disagree on maxFar.residential: engine R7A.far.res.std/4, model R7A.far.other" });
    expect(r.controls.maxFar.residential.confidence).toBe("conflicting");
    expect(r.controls.maxFar.residential.value).toBe(4);
    expect(brief.controls.maxFar.residential.confidence).toBe("cited");
  });
});
