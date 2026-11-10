// Export tests. Real recorded fixtures (SOURCE_MODE=offline): 1003450002 (R7A, interior) and 1003980028 (split lot,
// R8B unsupported -> manual / needs-input values). Generated files land in test-results/exports/ for visual review.
import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getSiteData } from "@/lib/sources/site";
import { computeBrief } from "@/lib/zoning";
import type { SiteData } from "@/lib/types";
import type { ZoningBrief } from "@/lib/zoning/model";
import { buildMarkdown } from "./markdown";
import { buildPdf, pdfSafe } from "./pdf";
import { exportFilename, renderExport } from "./index";

const NOW = new Date("2026-10-25T12:00:00.000Z");
const OUT = path.resolve(__dirname, "../../test-results/exports");
let a: { site: SiteData; brief: ZoningBrief };
let split: { site: SiteData; brief: ZoningBrief };

beforeAll(async () => {
  process.env.SOURCE_MODE = "offline";
  const mk = async (bbl: string) => {
    const site = await getSiteData(bbl);
    return { site, brief: computeBrief(site, { intendedUse: "residential", programs: [], overrides: {}, now: NOW.toISOString() }) };
  };
  a = await mk("1003450002");
  split = await mk("1003980028");
  fs.mkdirSync(OUT, { recursive: true });
}, 60_000);

describe("markdown export", () => {
  it("1003450002 prints the formula, citation, title block and source tags", () => {
    const md = buildMarkdown(a.site, a.brief, { now: NOW, verifiedBy: "J. Reviewer" });
    expect(md).toContain("2,500 sf × 4.00 FAR = 10,000 sf");
    expect(md).toContain("ZR 23-22 (last amended 12/5/2024)");
    expect(md).toContain("DRAFT — for professional review");
    expect(md).toMatch(/\| Sheet \| Z-101 \|/);
    expect(md).toMatch(/\| Checked \| J\. Reviewer \|/);
    expect(md).toMatch(/2,500 sf \[PLUTO 26v2 · lotarea · fetched \d{4}-\d{2}-\d{2}\]/);
    expect(md).toContain("[^1]:");
    expect(md).toContain("https://zr.planning.nyc.gov/");
    expect(md).toContain("Not a zoning determination");
    fs.writeFileSync(path.join(OUT, "site-brief-1003450002.md"), md);
  });
  it("Checked defaults to a dash", () => {
    expect(buildMarkdown(a.site, a.brief, { now: NOW })).toMatch(/\| Checked \| — \|/);
  });
  it("needs_input / manual values never print a number", () => {
    const md = buildMarkdown(split.site, split.brief, { now: NOW });
    const rows = md.split("\n").filter((l) => /^\| (Max FAR|Max floor area|Lot coverage)/.test(l));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const value = r.split(/(?<!\\)\|/)[2].trim();
      expect(value).toMatch(/^(Needs input|Manual — professional analysis)$/);
      expect(value).not.toMatch(/\d/);
    }
    fs.writeFileSync(path.join(OUT, "site-brief-1003980028.md"), md);
  });
});

describe("json export", () => {
  it("returns a valid envelope with the filename and validity flag", async () => {
    const r = await renderExport("json", a.site, a.brief, { now: NOW });
    expect(r.filename).toBe("zoning-envelope-1003450002.json");
    expect(r.envelopeValid).toBe(true);
    expect(JSON.parse(new TextDecoder().decode(r.body))).toHaveProperty("controls");
  });
  it("filenames", () => {
    expect(exportFilename("pdf", "1003450002", NOW)).toBe("site-brief-1003450002-20261025.pdf");
    expect(exportFilename("md", "1003450002", NOW)).toBe("site-brief-1003450002-20261025.md");
  });
});

describe("pdf export", () => {
  it("renders 1003450002 and the split lot to real PDFs", async () => {
    for (const [name, x] of [["1003450002", a], ["1003980028", split]] as const) {
      const buf = await buildPdf(x.site, x.brief, { now: NOW });
      expect(buf.length).toBeGreaterThan(10_000);
      expect(buf.subarray(0, 4).toString()).toBe("%PDF");
      fs.writeFileSync(path.join(OUT, `site-brief-${name}.pdf`), buf);
    }
  }, 60_000);
  it("pdfSafe maps glyphs outside WinAnsi", () => {
    expect(pdfSafe("≥ 5 ft → ok × — “q”")).toBe(">= 5 ft -> ok × — “q”");
  });
});
