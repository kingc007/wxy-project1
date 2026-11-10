import { describe, expect, it } from "vitest";
import { compactLocalDate, formatLocalDate } from "./dates";

describe("formatLocalDate", () => {
  it("uses America/New_York by default (evening ET is the next day in UTC)", () => {
    expect(formatLocalDate(new Date("2026-10-26T02:30:00.000Z"))).toBe("2026-10-25");
    expect(formatLocalDate("2026-10-26T02:30:00.000Z")).toBe("2026-10-25");
    expect(formatLocalDate("2026-10-26T15:00:00.000Z")).toBe("2026-10-26");
  });
  it("honours an explicit time zone and handles missing/invalid input", () => {
    expect(formatLocalDate("2026-10-26T02:30:00.000Z", "UTC")).toBe("2026-10-26");
    expect(formatLocalDate(null)).toBe("—");
    expect(formatLocalDate("not a date")).toBe("—");
  });
  it("compact form", () => {
    expect(compactLocalDate(new Date("2026-10-26T02:30:00.000Z"))).toBe("20261025");
  });
});
