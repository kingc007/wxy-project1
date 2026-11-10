import { describe, expect, it } from "vitest";
import {
  buildEnvelopeMessage, isReadyMessage, massingOpenUrl, massingOrigin, resolveMassingUrl, shouldAcceptReady, toastTimeout,
} from "./massing-handoff";

describe("resolveMassingUrl", () => {
  it("defaults to the page host on port 3301", () => {
    expect(resolveMassingUrl({ protocol: "http:", hostname: "192.168.1.20" }, undefined)).toBe("http://192.168.1.20:3301");
    expect(resolveMassingUrl({ protocol: "https:", hostname: "mac.local" }, undefined)).toBe("https://mac.local:3301");
    expect(resolveMassingUrl({ protocol: "http:", hostname: "localhost" }, undefined)).toBe("http://localhost:3301");
    expect(resolveMassingUrl({ protocol: "http:", hostname: "::1" }, undefined)).toBe("http://[::1]:3301");
  });
  it("lets the env var override", () => {
    expect(resolveMassingUrl({ protocol: "http:", hostname: "192.168.1.20" }, "https://massing.example.com")).toBe("https://massing.example.com");
  });
  it("falls back to localhost without a location", () => {
    expect(resolveMassingUrl(undefined, undefined)).toBe("http://localhost:3301");
  });
});
describe("massing handoff", () => {
  it("derives origin and open url", () => {
    expect(massingOrigin("http://localhost:3301")).toBe("http://localhost:3301");
    expect(massingOrigin("https://massing.example.com/some/path")).toBe("https://massing.example.com");
    expect(massingOpenUrl("http://localhost:3301/")).toBe("http://localhost:3301/?from=site-brief");
  });
  it("recognises only version-1 ready messages", () => {
    expect(isReadyMessage({ type: "wxy:massing-ready", version: 1 })).toBe(true);
    expect(isReadyMessage({ type: "wxy:massing-ready", version: 2 })).toBe(false);
    expect(isReadyMessage({ type: "other", version: 1 })).toBe(false);
    expect(isReadyMessage(null)).toBe(false);
    expect(isReadyMessage("wxy:massing-ready")).toBe(false);
  });
  it("accepts ready only from the right origin and the opened window", () => {
    const popup = {};
    const data = { type: "wxy:massing-ready", version: 1 };
    const o = "http://localhost:3301";
    expect(shouldAcceptReady({ origin: o, source: popup, data }, popup, o)).toBe(true);
    expect(shouldAcceptReady({ origin: "http://evil.test", source: popup, data }, popup, o)).toBe(false);
    expect(shouldAcceptReady({ origin: o, source: {}, data }, popup, o)).toBe(false);
    expect(shouldAcceptReady({ origin: o, source: null, data }, null, o)).toBe(false);
    expect(shouldAcceptReady({ origin: o, source: popup, data: { type: "x" } }, popup, o)).toBe(false);
  });
  it("builds the envelope message per contract", () => {
    const env = { schemaVersion: "1.0.0" };
    expect(buildEnvelopeMessage(env, "1 Main St", null)).toEqual({
      type: "wxy:envelope", version: 1, envelope: env,
      source: { app: "site-brief", address: "1 Main St", bbl: null },
    });
  });
  it("timeout toast names the url", () => {
    expect(toastTimeout("http://x:1")).toBe("Massing Studio didn't answer. Is it running at http://x:1? You can also use Download JSON.");
  });
});
