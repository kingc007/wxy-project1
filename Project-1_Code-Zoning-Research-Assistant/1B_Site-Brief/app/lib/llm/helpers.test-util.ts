// Test helpers: SAMPLE site/brief and a mock LlmClient. No network.
import type { LlmClient, StreamLike, RunnerMessageLike } from "./client";
import { computeBrief } from "@/lib/zoning/brief";
import { makeSite } from "@/lib/zoning/test-utils";

export const sampleSite = () => makeSite("L2", { street: "narrow" });
export const sampleBrief = (site = sampleSite()) =>
  computeBrief(site, { intendedUse: "residential", programs: [], now: "2026-10-25T12:00:00.000Z", sample: true });

export const usage = (o: Partial<{ input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }> = {}) =>
  ({ input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, ...o });

export function mockStream(events: unknown[], stop = "end_turn"): StreamLike {
  return {
    async *[Symbol.asyncIterator]() { for (const e of events) yield e as never; },
    finalMessage: async () => ({ usage: usage(), stop_reason: stop }),
  };
}
export const textDelta = (text: string) => ({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text } });
export const citeDelta = (citation: Record<string, unknown>) => ({ type: "content_block_delta", index: 0, delta: { type: "citations_delta", citation } });

export function mockClient(opts: {
  stream?: StreamLike;
  runner?: (params: { tools: { name: string; run: (a: never) => unknown }[]; model: string }) => Promise<RunnerMessageLike[]>;
}): LlmClient & { calls: { stream: unknown[]; runner: unknown[] } } {
  const calls = { stream: [] as unknown[], runner: [] as unknown[] };
  return {
    calls,
    messages: { stream: (p) => { calls.stream.push(p); return opts.stream ?? mockStream([]); } },
    beta: {
      messages: {
        toolRunner: (p) => {
          calls.runner.push(p);
          return (async function* () {
            const msgs = await opts.runner?.(p as never);
            for (const m of msgs ?? []) yield m;
          })();
        },
      },
    },
  };
}
