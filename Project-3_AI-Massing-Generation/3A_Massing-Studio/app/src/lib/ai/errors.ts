// Typed SDK errors (most specific first) -> designer-readable messages from the copy deck.
import Anthropic from "@anthropic-ai/sdk";
import { fmtUsd } from "./cost";

export const NO_KEY_MESSAGE =
  "AI features are off: no Anthropic API key on the server. Add ANTHROPIC_API_KEY to .env.local and restart. You can still use the built-in strategy set.";
export const REFUSAL_MESSAGE = "The AI declined this request; used the built-in strategy.";
export const DID_NOT_FINISH_INTENT = "No note — the AI didn't finish";

export const aiFailed = (reason: string): string => `The AI couldn't return a valid strategy (${reason}). Try again, or edit parameters by hand.`;
export const overBudget = (limitUsd: number): string => `Stopped at the cost limit (${fmtUsd(limitUsd)}). Raise the limit in Settings or generate fewer options.`;

export interface DescribedError {
  message: string;
  /** HTTP status a route should answer with when this is fatal. */
  status: number;
  kind: "timeout" | "connection" | "bad_request" | "auth" | "permission" | "not_found" | "rate_limit" | "server" | "api" | "other";
}

/** Order matters: subclasses before their parents (APIConnectionTimeoutError < APIConnectionError < APIError). */
export function describeError(e: unknown): DescribedError {
  if (e instanceof Anthropic.APIConnectionTimeoutError) return { kind: "timeout", status: 504, message: aiFailed("the request timed out") };
  if (e instanceof Anthropic.APIConnectionError) return { kind: "connection", status: 502, message: aiFailed("couldn't reach the Anthropic API") };
  if (e instanceof Anthropic.AuthenticationError) return { kind: "auth", status: 502, message: aiFailed("the server's API key was rejected; check ANTHROPIC_API_KEY") };
  if (e instanceof Anthropic.PermissionDeniedError) return { kind: "permission", status: 502, message: aiFailed("the API key isn't permitted to use this model") };
  if (e instanceof Anthropic.NotFoundError) return { kind: "not_found", status: 502, message: aiFailed("the model wasn't found") };
  if (e instanceof Anthropic.RateLimitError) return { kind: "rate_limit", status: 429, message: aiFailed("rate limit reached; wait a moment") };
  if (e instanceof Anthropic.BadRequestError) return { kind: "bad_request", status: 502, message: aiFailed("the request was rejected") };
  if (e instanceof Anthropic.UnprocessableEntityError) return { kind: "bad_request", status: 502, message: aiFailed("the request was rejected") };
  if (e instanceof Anthropic.InternalServerError) return { kind: "server", status: 502, message: aiFailed("the AI service reported an error") };
  if (e instanceof Anthropic.APIError) return { kind: "api", status: 502, message: aiFailed(`the AI service answered ${e.status ?? "with an error"}`) };
  const msg = e instanceof Error ? e.message : "unexpected error";
  return { kind: "other", status: 500, message: aiFailed(msg.slice(0, 160)) };
}
