import { describe, expect, it } from "vitest";
import { boardSvg, statusMark, svgToPng, BOARD_FOOTER } from "../boards";
import { buildFixture } from "./fixtures";
import { assertWellFormedXml } from "./xml";

describe("boardSvg", async () => {
  const fx = await buildFixture(3);
  const input = {
    envelopeId: "test-fixture-square",
    options: fx.options.map((o) => ({ index: o.index, name: o.name, intent: o.intent, option: o.option })),
    envelopeSummary: "10,000 sf lot · SAMPLE district · max FAR 4.00",
    lot: fx.envelope.lot,
    context: fx.context,
    date: "2026-10-25",
    sample: true,
  };
  const svg = boardSvg(input);

  it("is a well-formed 1600x1000 landscape sheet", () => {
    assertWellFormedXml(svg);
    expect(svg).toContain('width="1600" height="1000"');
  });
  it("has title block, stamps, footer and per-option content", () => {
    for (const t of ["Massing Studio — test-fixture-square", "A-001", "2026-10-25", "DRAFT — for professional review", "SAMPLE site — not a real parcel", BOARD_FOOTER, "Option 1 · Fixture 1", "Option 3 · Fixture 3", "Intent text 2", "Rule", "Allowed", "Proposed", "Status"])
      expect(svg).toContain(t);
  });
  it("status is word + symbol, never colour only", () => {
    expect(statusMark("pass")).toEqual({ word: "Passes", symbol: "✓" });
    expect(statusMark("fail")).toEqual({ word: "Fails", symbol: "✕" });
    expect(statusMark("review")).toEqual({ word: "Review", symbol: "!" });
    expect(svg).toMatch(/[✓✕!] (Passes|Fails|Review)/);
  });
  it("omits the SAMPLE stamp for real sites and is deterministic", () => {
    expect(boardSvg({ ...input, sample: false })).not.toContain("SAMPLE site — not a real parcel");
    expect(boardSvg(input)).toBe(svg);
  });
  it("metrics text comes from computed metrics", () => {
    expect(svg).toContain("GFA 28,000 sf");
  });
  it("svgToPng is browser-only (rejects in Node)", async () => {
    await expect(svgToPng(svg, 1)).rejects.toThrow(/browser-only/);
  });
});
