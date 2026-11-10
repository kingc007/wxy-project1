import { describe, expect, it } from "vitest";
import { allowedSenderOrigin, isAllowedOrigin, isEnvelopeMessage, isEnvelopeType, wantsHandoff } from "../handoff";

const good = { type: "wxy:envelope", version: 1, envelope: { a: 1 }, source: { app: "site-brief", address: "1 Main St", bbl: null } };

describe("isEnvelopeMessage", () => {
  it("accepts a well-formed message", () => {
    expect(isEnvelopeMessage(good)).toBe(true);
    expect(isEnvelopeMessage({ ...good, source: { ...good.source, bbl: "1000010001" } })).toBe(true);
  });
  it("rejects wrong type, version, missing envelope or bad source", () => {
    expect(isEnvelopeMessage(null)).toBe(false);
    expect(isEnvelopeMessage("x")).toBe(false);
    expect(isEnvelopeMessage({ ...good, type: "wxy:massing-ready" })).toBe(false);
    expect(isEnvelopeMessage({ ...good, version: 2 })).toBe(false);
    expect(isEnvelopeMessage({ ...good, envelope: undefined })).toBe(false);
    expect(isEnvelopeMessage({ ...good, source: { app: "other", address: "x", bbl: null } })).toBe(false);
    expect(isEnvelopeMessage({ ...good, source: { app: "site-brief", address: 5, bbl: null } })).toBe(false);
    expect(isEnvelopeMessage({ ...good, source: { app: "site-brief", address: "x" } })).toBe(false);
  });
  it("isEnvelopeType only looks at the type tag", () => {
    expect(isEnvelopeType({ type: "wxy:envelope" })).toBe(true);
    expect(isEnvelopeType({ type: "other" })).toBe(false);
    expect(isEnvelopeType(undefined)).toBe(false);
  });
});

describe("allowedSenderOrigin", () => {
  const loc = { protocol: "http:", hostname: "192.168.1.20" };
  it("defaults to the page host on port 3101", () => {
    expect(allowedSenderOrigin(undefined, loc)).toBe("http://192.168.1.20:3101");
    expect(allowedSenderOrigin("", { protocol: "http:", hostname: "localhost" })).toBe("http://localhost:3101");
    expect(allowedSenderOrigin(undefined, { protocol: "https:", hostname: "::1" })).toBe("https://[::1]:3101");
  });
  it("uses the env override, reduced to its origin", () => {
    expect(allowedSenderOrigin("https://brief.example.com/some/path?x=1", loc)).toBe("https://brief.example.com");
  });
  it("falls back to the default when the override isn't a URL", () => {
    expect(allowedSenderOrigin("not a url", loc)).toBe("http://192.168.1.20:3101");
  });
});

describe("isAllowedOrigin / wantsHandoff", () => {
  it("matches exactly", () => {
    expect(isAllowedOrigin("http://localhost:3101", "http://localhost:3101")).toBe(true);
    expect(isAllowedOrigin("http://localhost:3102", "http://localhost:3101")).toBe(false);
    expect(isAllowedOrigin("http://localhost:3101.evil.com", "http://localhost:3101")).toBe(false);
    expect(isAllowedOrigin("null", "http://localhost:3101")).toBe(false);
  });
  it("detects the query flag", () => {
    expect(wantsHandoff("?from=site-brief")).toBe(true);
    expect(wantsHandoff("?x=1&from=site-brief")).toBe(true);
    expect(wantsHandoff("?from=other")).toBe(false);
    expect(wantsHandoff("")).toBe(false);
  });
});
