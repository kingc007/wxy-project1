import { describe, expect, it } from "vitest";
import { allowedNumbers, labelSentences, mapCitation, splitSentences, unsupportedNumbers, type DocSection } from "./validate";

const docs: DocSection[] = [
  { sectionId: "23-22", title: "t", url: "u", blocks: [{ anchor: "23-22-p1", text: "R6 R7" }, { anchor: "t0r3", text: "R7A | 4.00 | 5.01" }, { anchor: "t0r4", text: "R7B | 3.00 | 3.90" }] },
];
const cite = (o: object) => ({ type: "content_block_location", document_index: 0, ...o });

describe("mapCitation", () => {
  it("maps document_index/start_block_index to section and anchor", () => {
    const r = mapCitation(cite({ start_block_index: 1, end_block_index: 2, cited_text: "R7A | 4.00 | 5.01" }), docs);
    expect(r).toEqual({ ok: true, citation: { sectionId: "23-22", anchor: "t0r3", cited_text: "R7A | 4.00 | 5.01", url: "u" } });
  });
  it("accepts a multi-block range (joined text)", () => {
    expect(mapCitation(cite({ start_block_index: 1, end_block_index: 3, cited_text: "R7A | 4.00 | 5.01R7B | 3.00 | 3.90" }), docs).ok).toBe(true);
  });
  it("drops a citation whose cited_text is not in the block", () => {
    const r = mapCitation(cite({ start_block_index: 1, end_block_index: 2, cited_text: "R7A | 9.99 | 5.01" }), docs);
    expect(r.ok).toBe(false);
  });
  it("drops bad document index, bad range and other citation types", () => {
    expect(mapCitation(cite({ document_index: 3, start_block_index: 0, end_block_index: 1, cited_text: "R6 R7" }), docs).ok).toBe(false);
    expect(mapCitation(cite({ start_block_index: 5, end_block_index: 6, cited_text: "R6 R7" }), docs).ok).toBe(false);
    expect(mapCitation({ type: "char_location", cited_text: "R6" }, docs).ok).toBe(false);
  });
});

describe("numeric post-validator", () => {
  const allowed = allowedNumbers('{"far":4,"lotAreaSf":2500,"bbl":"1003450002","x":2.20}');
  it("flags numbers absent from the summary, ignores district codes and known section ids", () => {
    expect(unsupportedNumbers("The FAR is 4.00 on 2,500 sf.", allowed)).toEqual([]);
    expect(unsupportedNumbers("The FAR is 5.5.", allowed)).toEqual(["5.5"]);
    expect(unsupportedNumbers("District R7A, see 23-22.", allowed, new Set(["23-22"]))).toEqual([]);
    expect(unsupportedNumbers("see 23-99.", allowed, new Set(["23-22"]))).toEqual(["23", "99"]);
    expect(unsupportedNumbers("FAR 2.2", allowed)).toEqual([]);
  });
  it("labels sentences cited / unverified / inferred / plain", () => {
    const text = "The lot is in R7A. The FAR is 9.9. Heights are limited. Yards matter. Height is 85 ft.";
    const sents = splitSentences(text);
    expect(sents).toHaveLength(5);
    const tally = { valid: new Map([[4, 1]]), dropped: new Map([[2, 1]]) };
    const out = labelSentences(text, tally, allowed, new Set());
    expect(out.map((s) => s.label)).toEqual(["plain", "unverified", "inferred", "plain", "cited"]);
    expect(out[1].unsupportedNumbers).toEqual(["9.9"]);
  });
});
