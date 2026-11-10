import { describe, expect, it } from "vitest";
import { findSpan, locateQuote, splitFragments, squash } from "./locate";
import { documentToLocatable } from "./source-doc";
import type { SourceDocument } from "./types";

// Synthetic fixture (not a real code section): exercises the locator only.
const doc: SourceDocument = {
  id: "TEST-1",
  title: "Test section",
  breadcrumbs: [],
  blocks: [
    { anchor: "p1", text: "A rear yard with a depth of not less than 30 feet shall be provided." },
    { table: { caption: "Table", headers: [["District", "Value"]], rows: [["X1", "4.00"], ["X2", "5.01"]], footnotes: [] } },
  ],
};
const loc = documentToLocatable(doc);

describe("locator", () => {
  it("squash folds superscripts and punctuation", () => {
    expect(squash("R7-1¹ | 4.00")).toBe("r711400");
  });
  it("splits fragments", () => {
    expect(splitFragments("a b — c d")).toEqual(["a b", "c d"]);
  });
  it("finds a paragraph quote", () => {
    expect(locateQuote(loc, "rear yard with a depth of not less than 30 feet")).toMatchObject({ found: true, where: "p1" });
  });
  it("finds a table row and reports missing text", () => {
    expect(locateQuote(loc, "X2 | 5.01")).toMatchObject({ found: true, where: "t0r1" });
    expect(locateQuote(loc, "X2 | 9.99").found).toBe(false);
  });
  it("findSpan returns original offsets", () => {
    const t = "Not less than 30 feet.";
    const s = findSpan(t, "30 feet")!;
    expect(t.slice(s.start, s.end)).toBe("30 feet");
  });
});
