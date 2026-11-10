// Anthropic client wiring for 1B. Patterns and model IDs come from shared/LLM-GUIDE.md only.
// No ANTHROPIC_API_KEY -> getClient() returns null and every caller must degrade to the deterministic path.
import Anthropic from "@anthropic-ai/sdk";

export const MODELS = {
  extract: "claude-haiku-5-5",
  synth: "claude-sonnet-5-5",
  hard: "claude-opus-5-5",
} as const;
export type ModelId = (typeof MODELS)[keyof typeof MODELS];

export interface Price {
  /** USD per million input tokens */
  in: number;
  /** USD per million output tokens */
  out: number;
  /** USD per million cache-read tokens; null = not stated in our source (cost reported as a lower bound) */
  cacheRead: number | null;
}

/** USD per million tokens. Source: shared/LLM-GUIDE.md ("list price, 2026-10-06"). */
export const PRICES_LABEL = "list price, 2026-10-06";
export const PRICES: Record<ModelId, Price> = {
  // Haiku cache-read price is not stated in the claude-api skill (2026-10-06 table) → null, never assumed.
  "claude-haiku-5-5": { in: 0.1, out: 0.5, cacheRead: null },
  "claude-sonnet-5-5": { in: 2.0, out: 10.0, cacheRead: 0.2 },
  "claude-opus-5-5": { in: 4.0, out: 20.0, cacheRead: 0.2 },
};

export interface UsageLike {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export interface NormUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

export function normUsage(u: UsageLike | null | undefined): NormUsage {
  return {
    input_tokens: u?.input_tokens ?? 0,
    output_tokens: u?.output_tokens ?? 0,
    cache_read_input_tokens: u?.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: u?.cache_creation_input_tokens ?? 0,
  };
}

export function addUsage(a: NormUsage, b: NormUsage): NormUsage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    cache_read_input_tokens: a.cache_read_input_tokens + b.cache_read_input_tokens,
    cache_creation_input_tokens: a.cache_creation_input_tokens + b.cache_creation_input_tokens,
  };
}

export const ZERO_USAGE: NormUsage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

/**
 * Cost = in x price_in + out x price_out + cache_read x cache_price + cache_write x 1.25 x price_in (per 1M tokens).
 * `input_tokens` is the uncached remainder reported by the API, so it is not reduced by cache reads here.
 */
export function costFromUsage(model: string, usage: UsageLike): number {
  const p = PRICES[model as ModelId];
  if (!p) throw new Error(`No price for model ${model}`);
  const u = normUsage(usage);
  const usd =
    (u.input_tokens * p.in +
      u.output_tokens * p.out +
      u.cache_read_input_tokens * (p.cacheRead ?? 0) +
      u.cache_creation_input_tokens * 1.25 * p.in) /
    1_000_000;
  return Math.round(usd * 1e6) / 1e6;
}

/** Minimal structural surface of the SDK that 1B uses; tests inject a mock implementing it. */
export interface StreamLike extends AsyncIterable<Anthropic.Messages.MessageStreamEvent> {
  finalMessage(): Promise<{ usage: UsageLike; stop_reason: string | null }>;
}
export interface RunnerMessageLike {
  usage: UsageLike;
  stop_reason: string | null;
  content: unknown[];
}
export interface LlmClient {
  messages: { stream(params: Anthropic.Messages.MessageStreamParams): StreamLike };
  beta: { messages: { toolRunner(params: Anthropic.Beta.Messages.BetaToolRunnerParams): AsyncIterable<RunnerMessageLike> } };
}

export function hasKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY?.trim();
}

/** null in no-key mode. The SDK reads ANTHROPIC_API_KEY itself; the key is never read into our code. */
export function getClient(): LlmClient | null {
  if (!hasKey()) return null;
  return new Anthropic() as unknown as LlmClient;
}
