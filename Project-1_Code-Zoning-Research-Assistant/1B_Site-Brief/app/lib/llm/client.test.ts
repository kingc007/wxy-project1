import { afterEach, describe, expect, it, vi } from "vitest";
import { MODELS, costFromUsage, getClient } from "./client";
import { narrativeEvents } from "./orchestrate";
import { runRuleAgent } from "./agent";
import { streamNarrative } from "./narrative";
import { sampleBrief, sampleSite } from "./helpers.test-util";

afterEach(() => vi.unstubAllEnvs());

describe("cost", () => {
  it("sonnet: in 2.00, out 10.00, cache read 0.20, cache write 1.25x in", () => {
    expect(costFromUsage(MODELS.synth, { input_tokens: 1_000_000, output_tokens: 100_000, cache_read_input_tokens: 500_000, cache_creation_input_tokens: 200_000 }))
      .toBeCloseTo(2 + 1 + 0.1 + 0.5, 6);
  });
  it("opus and haiku", () => {
    expect(costFromUsage(MODELS.hard, { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(24, 6);
    expect(costFromUsage(MODELS.extract, { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(0.6, 6);
  });
  it("unknown model throws", () => expect(() => costFromUsage("nope", { input_tokens: 1, output_tokens: 1 })).toThrow());
});

describe("no-key mode", () => {
  it("getClient is null and every entry point degrades", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(getClient()).toBeNull();
    const site = sampleSite(), brief = sampleBrief(site);
    expect(await runRuleAgent(site, brief)).toBeNull();
    const evs = [];
    for await (const e of streamNarrative(brief, site)) evs.push(e);
    expect(evs).toEqual([]);
    const sse = [];
    for await (const e of narrativeEvents(site, brief)) sse.push(e);
    expect(sse).toEqual([{ event: "meta", data: { llm: false } }, { event: "done", data: {} }]);
  });
});
