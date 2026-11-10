// Anthropic client factory (server-side only). The key is read from the server environment and never logged or returned.
// Tests inject a fake with setClientForTests(); route code only ever calls getClient().
import Anthropic from "@anthropic-ai/sdk";

/** Exact model IDs (no date suffix) from the claude-api skill, via _manager/claude-api-guidance.md. */
export const MODELS = {
  parse: "claude-haiku-5-5",
  strategy: "claude-sonnet-5-5",
  iterate: "claude-sonnet-5-5",
  intent: "claude-sonnet-5-5",
  hard: "claude-opus-5-5",
} as const satisfies Record<string, Anthropic.Model>;
export type ModelId = (typeof MODELS)[keyof typeof MODELS];

export const DEFAULT_COST_LIMIT_USD = 0.5;
export const REQUEST_TIMEOUT_MS = 90_000;

/** The slice of the SDK the AI layer uses; a fake only needs these two methods. */
export interface AiClient {
  messages: {
    create(params: Anthropic.Messages.MessageCreateParamsNonStreaming, options?: { timeout?: number }): PromiseLike<Anthropic.Message>;
    parse(
      params: Anthropic.Messages.MessageCreateParamsNonStreaming,
      options?: { timeout?: number },
    ): PromiseLike<Anthropic.Message & { parsed_output: unknown }>;
  };
}

let fake: AiClient | null = null;
let real: AiClient | null = null;

export function setClientForTests(client: AiClient | null): void {
  fake = client;
}

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim());
}

/** True when AI mode is possible (a key on the server, or an injected test client). */
export function aiAvailable(): boolean {
  return fake !== null || hasApiKey();
}

/** The client, or null when AI mode is unavailable. */
export function getClient(): AiClient | null {
  if (fake) return fake;
  if (!hasApiKey()) return null;
  if (!real) real = new Anthropic({ timeout: REQUEST_TIMEOUT_MS }) as unknown as AiClient; // reads ANTHROPIC_API_KEY from env
  return real;
}

export function costLimitUsd(): number {
  const raw = process.env.MASSING_COST_LIMIT_USD;
  const n = raw === undefined || raw.trim() === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_COST_LIMIT_USD;
}
