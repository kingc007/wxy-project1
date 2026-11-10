import { describe, expect, it } from "vitest";
import { runRuleAgent } from "./agent";
import { mockClient, sampleBrief, sampleSite, usage } from "./helpers.test-util";

type Tool = { name: string; run: (a: never) => unknown };
const call = (tools: Tool[], name: string, args: object) => tools.find((t) => t.name === name)!.run(args as never);
const msg = (stop = "end_turn") => ({ usage: usage(), stop_reason: stop, content: [] });

const site = sampleSite();
const brief = sampleBrief(site);

describe("runRuleAgent", () => {
  it("runs Sonnet once when the model agrees with the engine", async () => {
    const client = mockClient({
      runner: async (p) => {
        expect(p.model).toBe("claude-sonnet-5-5");
        const cands = JSON.parse((await call(p.tools, "listCandidateRules", {})) as string);
        expect(cands.some((c: { id: string }) => c.id === "R7A.far.res.std")).toBe(true);
        expect(await call(p.tools, "selectRule", { field: "maxFar.residential", ruleId: "R7A.far.res.std", reason: "R7A standard" })).toBe("recorded");
        await call(p.tools, "flagForReview", { kind: "other", message: "check" });
        return [msg("tool_use"), msg()];
      },
    });
    const r = await runRuleAgent(site, brief, { client });
    expect(r).toMatchObject({ escalated: false, model: "claude-sonnet-5-5" });
    expect(r!.selections).toEqual([{ field: "maxFar.residential", ruleId: "R7A.far.res.std", reason: "R7A standard" }]);
    expect(r!.flags).toEqual([{ kind: "other", message: "check" }]);
    expect(r!.usage.input_tokens).toBe(2000);
    expect(r!.cost).toBeCloseTo(2 * 0.004, 6);
    const params = client.calls.runner[0] as Record<string, unknown>;
    expect(params.tool_choice).toEqual({ type: "auto" });
    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("thinking");
  });

  it("selectRule rejects IDs outside listCandidateRules and mismatched fields", async () => {
    const client = mockClient({
      runner: async (p) => {
        expect(() => call(p.tools, "selectRule", { field: "maxFar.residential", ruleId: "MADE.UP", reason: "xxx" })).toThrow(/Unknown ruleId/);
        expect(() => call(p.tools, "selectRule", { field: "yards.rear", ruleId: "R7A.far.res.std", reason: "xxx" })).toThrow(/is for field/);
        return [msg()];
      },
    });
    const r = await runRuleAgent(site, brief, { client });
    expect(r!.selections).toEqual([]);
  });

  it("calculate uses the engine calculators", async () => {
    const client = mockClient({
      runner: async (p) => {
        const r = JSON.parse((await call(p.tools, "calculate", { op: "maxFloorArea", lotArea: 2500, far: 4 })) as string);
        expect(r).toMatchObject({ value: 10000, formula: "2,500 sf × 4.00 FAR = 10,000 sf" });
        return [msg()];
      },
    });
    await runRuleAgent(site, brief, { client });
  });

  it("escalates to Opus on disagreement and labels it", async () => {
    const models: string[] = [];
    const client = mockClient({
      runner: async (p) => {
        models.push(p.model);
        const rid = p.model === "claude-sonnet-5-5" ? "R7A.base.max.qah" : "R7A.base.max.std";
        const field = "baseHeight.max";
        await call(p.tools, "selectRule", { field, ruleId: rid, reason: "because" });
        return [msg()];
      },
    });
    const r = await runRuleAgent(site, brief, { client, rules: undefined });
    expect(models).toEqual(["claude-sonnet-5-5", "claude-opus-5-5"]);
    expect(r).toMatchObject({ escalated: true, model: "claude-opus-5-5" });
    expect(r!.passes).toHaveLength(2);
  });
});
