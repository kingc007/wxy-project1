import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getSection } from "./corpus";
import { locateQuote, splitFragments, squash } from "./locate";

interface Rule { id: string; citation: { section: string; quote: string } }
const rulesDir = path.join(process.cwd(), "lib/zoning/rules");
const rules: Rule[] = ["nyc-zr-residence.json", "nyc-zr-commercial.json"].flatMap(
  (f) => JSON.parse(fs.readFileSync(path.join(rulesDir, f), "utf8")).rules as Rule[],
);

describe("squash / splitFragments", () => {
  it("folds superscripts and punctuation", () => {
    expect(squash("R7-1¹ | 4.00")).toBe("r711400");
  });
  it("splits on em dash and Row:", () => {
    expect(splitFragments("a b — footnote text Row: C4-4A ; 4.0")).toEqual(["a b", "footnote text", "C4-4A ; 4.0"]);
  });
});

describe("locateQuote", () => {
  it("finds the R7A row in 23-22's table", () => {
    const s = getSection("23-22")!;
    const loc = locateQuote(s, "R7A R7-1¹ R7-2¹ | 4.00 | 5.01");
    expect(loc.found).toBe(true);
    expect(loc.where).toMatch(/^t\d+r\d+$/);
  });
  it("finds a paragraph quote", () => {
    const s = getSection("23-342")!;
    const loc = locateQuote(s, "for zoning lots with a lot width of less than 40 feet, a rear yard with a depth of not less than 30 feet");
    expect(loc.found).toBe(true);
    expect(loc.where).toContain("23-342-p");
  });
  it("reports not found for text that is not in the section", () => {
    const s = getSection("23-22")!;
    expect(locateQuote(s, "the maximum floor area ratio is 99.00 everywhere").found).toBe(false);
    expect(locateQuote(s, "R7A R7-1¹ R7-2¹ | 9.99 | 5.01").found).toBe(false);
  });
  it("finds a row joined with the row-cell separator", () => {
    const s = getSection("22-111")!;
    expect(locateQuote(s, "Cemeteries ; – ; – ; ● ; ●").found).toBe(true);
  });

  it("locates EVERY citation quote in both rules files (all rules)", () => {
    const missing: string[] = [];
    for (const r of rules) {
      const sec = getSection(r.citation.section);
      if (!sec || !locateQuote(sec, r.citation.quote).found) missing.push(`${r.id} (${r.citation.section})`);
    }
    expect(rules.length).toBeGreaterThan(100);
    expect(missing).toEqual([]);
  });
});

import { findSpan } from "./locate";
describe("findSpan", () => {
  it("returns original offsets around a squashed match", () => {
    const text = "Intro. In R6¹ Districts, the yard shall be 30 feet. End.";
    const sp = findSpan(text, "the yard  shall be 30 FEET")!;
    expect(text.slice(sp.start, sp.end)).toBe("the yard shall be 30 feet");
  });
  it("null when absent", () => expect(findSpan("abc", "xyz")).toBeNull());
});

describe("located rows are the right rows", () => {
  it("R7A FAR quote lands on the R7A row of 23-22", () => {
    const s = getSection("23-22")!;
    const loc = locateQuote(s, "R7A R7-1¹ R7-2¹ | 4.00 | 5.01");
    const m = /^t(\d+)r(\d+)$/.exec(loc.where!)!;
    expect(s.tables[+m[1]].rows[+m[2]].slice(0, 3)).toEqual(["R7A R7-1¹ R7-2¹", "4.00", "5.01"]);
  });
  it("footnote prefix does not hide the row", () => {
    const s = getSection("23-432")!;
    const loc = locateQuote(s, "R6² | 30 | 45 | 55 | 65 | 85 — Footnote 2: For zoning lots or portions thereof on a narrow street");
    expect(loc.where).toMatch(/^t\d+r\d+$/);
  });
});
