// Token usage -> USD (prices from _manager/claude-api-guidance.md, $ per 1M tokens) and the shared cost guard.
import type Anthropic from "@anthropic-ai/sdk";
import type { ModelId } from "./client";

export interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}
export interface Totals extends TokenUsage {
  usd: number;
  ms: number;
}

interface Price {
  input: number;
  output: number;
  cacheRead: number;
}
export const PRICES: Record<ModelId, Price> = {
  // TODO(UNVERIFIED): the skill does not state a cache-read price for haiku; the input rate is used as an estimate.
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.1 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
};
/** Cache writes cost 1.25x the input rate (5-minute TTL). */
export const CACHE_WRITE_MULTIPLIER = 1.25;

export const emptyUsage = (): TokenUsage => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

export function usageFromResponse(u: Anthropic.Usage | undefined | null): TokenUsage {
  return {
    input: u?.input_tokens ?? 0,
    output: u?.output_tokens ?? 0,
    cacheRead: u?.cache_read_input_tokens ?? 0,
    cacheWrite: u?.cache_creation_input_tokens ?? 0,
  };
}

export function usdFor(model: ModelId, u: TokenUsage): number {
  const p = PRICES[model];
  return (u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.input * CACHE_WRITE_MULTIPLIER) / 1_000_000;
}

/** Rough pre-flight estimate of one model turn: characters / 3.5 as tokens, all priced as cache writes, plus an output allowance. */
export function estimateTurnUsd(model: ModelId, promptChars: number, outputTokens = 1500): number {
  const p = PRICES[model];
  return ((promptChars / 3.5) * p.input * CACHE_WRITE_MULTIPLIER + outputTokens * p.output) / 1_000_000;
}

/** Running total shared by every slot of a request. */
export class CostMeter {
  readonly usage: TokenUsage = emptyUsage();
  usd = 0;
  constructor(readonly limitUsd: number) {}

  add(model: ModelId, u: TokenUsage): number {
    const cost = usdFor(model, u);
    this.usage.input += u.input;
    this.usage.output += u.output;
    this.usage.cacheRead += u.cacheRead;
    this.usage.cacheWrite += u.cacheWrite;
    this.usd += cost;
    return cost;
  }

  /** True when the running total plus the next turn's estimate would pass the limit. */
  wouldExceed(estimateUsd: number): boolean {
    return this.usd + estimateUsd > this.limitUsd;
  }

  totals(ms: number): Totals {
    return { ...this.usage, usd: this.usd, ms };
  }
}

export const fmtUsd = (v: number): string => `$${v.toFixed(2)}`;
