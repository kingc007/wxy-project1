import { describe, expect, it } from "vitest";
import { citationLabel, envelopeFilename, fmtValue, lotTypeLabel, meter } from "./format";
import { formatSse, parseFrame, splitFrames } from "./sse";

describe("fmtValue", () => {
  it("formats by unit", () => {
    expect(fmtValue({ value: 3, unit: "ratio" })).toBe("3.00");
    expect(fmtValue({ value: 14025, unit: "sf" })).toBe("14,025 sf");
    expect(fmtValue({ value: 80, unit: "percent" })).toBe("80%");
    expect(fmtValue({ value: 65, unit: "ft" })).toBe("65 ft");
    expect(fmtValue({ value: null, unit: "ft" })).toBeNull();
  });
});
describe("meter", () => {
  it("computes a clamped fraction and rejects invalid input", () => {
    expect(meter(0, 100)?.fraction).toBe(0);
    expect(meter(50, 200)?.fraction).toBe(0.25);
    expect(meter(300, 200)?.fraction).toBe(1);
    expect(meter(1, 0)).toBeNull();
    expect(meter(null, 10)).toBeNull();
  });
});
describe("labels", () => {
  it("lot type and citation labels", () => {
    expect(lotTypeLabel(5)).toBe("5 · Inside");
    expect(lotTypeLabel(null)).toBe("Not available");
    expect(citationLabel({ source: "NYC Zoning Resolution", section: "23-22", paragraph: "b" })).toBe("ZR 23-22 ¶b");
    expect(envelopeFilename("1020500004")).toBe("envelope-1020500004.json");
  });
});
describe("sse", () => {
  it("round-trips frames and keeps a partial tail", () => {
    const a = formatSse("step", { id: "locate", state: "done", elapsedMs: 5 });
    const b = formatSse("done", { totalMs: 1 });
    const { frames, rest } = splitFrames(a + b.slice(0, 10));
    expect(frames).toHaveLength(1);
    expect(rest).toBe(b.slice(0, 10));
    expect(parseFrame(frames[0])).toEqual({ event: "step", data: { id: "locate", state: "done", elapsedMs: 5 } });
    expect(parseFrame("garbage")).toBeNull();
  });
});

import { isoDate } from "./format";
describe("isoDate", () => {
  it("uses the New York calendar day, not UTC", () => {
    expect(isoDate("2026-10-26T01:33:56.642Z")).toBe("2026-10-25");
    expect(isoDate(null)).toBe("—");
  });
});
