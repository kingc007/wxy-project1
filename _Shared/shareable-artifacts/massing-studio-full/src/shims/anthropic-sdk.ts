// Stub for @anthropic-ai/sdk. Built-in (no AI) mode never creates a client (ANTHROPIC_API_KEY is undefined in this
// bundle, so aiAvailable() is false); only the error classes are referenced, by describeError() in src/lib/ai/errors.ts.
class APIError extends Error { status?: number }
class APIConnectionError extends APIError {}
class APIConnectionTimeoutError extends APIConnectionError {}
class AuthenticationError extends APIError {}
class PermissionDeniedError extends APIError {}
class NotFoundError extends APIError {}
class RateLimitError extends APIError {}
class BadRequestError extends APIError {}
class UnprocessableEntityError extends APIError {}
class InternalServerError extends APIError {}

export default class Anthropic {
  static APIError = APIError;
  static APIConnectionError = APIConnectionError;
  static APIConnectionTimeoutError = APIConnectionTimeoutError;
  static AuthenticationError = AuthenticationError;
  static PermissionDeniedError = PermissionDeniedError;
  static NotFoundError = NotFoundError;
  static RateLimitError = RateLimitError;
  static BadRequestError = BadRequestError;
  static UnprocessableEntityError = UnprocessableEntityError;
  static InternalServerError = InternalServerError;
  constructor() {
    throw new Error("The Anthropic SDK is not available in this offline build.");
  }
}
export { Anthropic };
