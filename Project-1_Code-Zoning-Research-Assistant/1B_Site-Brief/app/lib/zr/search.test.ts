import { describe, expect, it } from "vitest";
import { Bm25Index, searchZoningText, tokenize } from "./search";

describe("tokenize", () => {
  it("keeps section ids and district names whole", () => {
    expect(tokenize("See 23-22 for R7-1 yards.")).toEqual(["see", "23-22", "r7-1", "yard"]);
  });
});

describe("Bm25Index", () => {
  const idx = new Bm25Index([{ text: "rear yard depth thirty feet" }, { text: "street wall setback" }, { text: "yard yard yard" }]);
  it("ranks matching docs and drops non-matching", () => {
    const r = idx.search("rear yard");
    expect(r[0].text).toBe("rear yard depth thirty feet");
    expect(r.every((d) => d.score > 0)).toBe(true);
    expect(idx.search("zzz")).toEqual([]);
  });
});

describe("searchZoningText (corpus)", () => {
  it("finds the rear yard section for a natural-language query", () => {
    const hits = searchZoningText("rear yard depth narrow lot attached building", 10);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.sectionId === "23-342")).toBe(true);
  });
  it("a section id query returns that section first", () => {
    expect(searchZoningText("23-22", 3)[0].sectionId).toBe("23-22");
  });
  it("returns hits with citation fields", () => {
    const h = searchZoningText("maximum floor area ratio R7A", 3)[0];
    expect(h.url).toMatch(/^https:\/\/zr\.planning\.nyc\.gov\//);
    expect(h.chunkId).toBeTruthy();
  });
});

import { searchZr } from "@/lib/llm/search";
describe("lib/llm/search wrapper", () => {
  it("delegates to the single BM25 and keeps the tool's hit shape", () => {
    const h = searchZr("rear yard narrow lot attached", 5);
    expect(h.length).toBeGreaterThan(0);
    expect(Object.keys(h[0]).sort()).toEqual(["anchor", "score", "sectionId", "snippet", "title"]);
    expect(h[0].snippet.length).toBeLessThanOrEqual(400);
    expect(h.map((x) => x.sectionId)).toEqual(searchZoningText("rear yard narrow lot attached", 5).map((x) => x.sectionId));
  });
});
