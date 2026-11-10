import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { chunkSections, splitSentences } from "../src/chunk.js";
import { parseChapter } from "../src/parse.js";
import type { ChapterParseResult } from "../src/parse.js";

const RAW = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../raw");
const load = (name: string, article: string, chapter: string) =>
  parseChapter(fs.readFileSync(path.join(RAW, name), "utf8"), article, chapter);

let ch3: ChapterParseResult;
let art1ch2: ChapterParseResult;
beforeAll(() => {
  ch3 = load("article-ii_chapter-3.html", "article-ii", "chapter-3");
  art1ch2 = load("article-i_chapter-2.html", "article-i", "chapter-2");
});

describe("23-22", () => {
  it("parses metadata, districts and parent", () => {
    const s = ch3.sections.find((x) => x.id === "23-22")!;
    expect(s.url).toBe("https://zr.planning.nyc.gov/article-ii/chapter-3/23-22");
    expect(s.lastAmended).toBe("12/5/2024");
    expect(s.districtsIndicated).toEqual(["R6", "R7", "R8", "R9", "R10", "R11", "R12"]);
    expect(s.parent).toBe("23-20");
    expect(s.breadcrumbs.slice(0, 3)).toEqual(["Article II", "Chapter 3", "23-20 FLOOR AREA REGULATIONS"]);
  });

  it("FAR table has 3 columns, R6A row with R6 superscript glyph, footnotes", () => {
    const s = ch3.sections.find((x) => x.id === "23-22")!;
    const t = s.tables[0]!;
    expect(t.headers).toHaveLength(1);
    expect(t.headers[0]).toHaveLength(3);
    expect(t.rows.every((r) => r.length === 3)).toBe(true);
    const row = t.rows.find((r) => r[0]!.includes("R6A"))!;
    expect(row[0]).toContain("R6¹");
    expect(t.footnotes.length).toBeGreaterThanOrEqual(2);
    expect(t.footnotes[0]).toMatch(/^¹ /);
  });
});

describe("23-736", () => {
  it("expands multi-row headers to 8 leaf columns", () => {
    const s = ch3.sections.find((x) => x.id === "23-736")!;
    const t = s.tables[0]!;
    expect(t.headers.length).toBeGreaterThan(1);
    for (const h of t.headers) expect(h).toHaveLength(8);
    expect(t.rows.every((r) => r.length === 8)).toBe(true);
  });
});

describe("12-10 definitions", () => {
  it("contains a 'wide' term whose text mentions 75 feet", () => {
    const d = art1ch2.definitions.find((x) => /wide/i.test(x.term) && x.text.includes("75 feet"));
    expect(d).toBeDefined();
    expect(d!.anchor).toMatch(/^term-/);
  });
  it("keeps per-definition amended dates", () => {
    expect(art1ch2.definitions.some((x) => x.lastAmended && /^\d+\/\d+\/\d{4}$/.test(x.lastAmended))).toBe(true);
  });
});

describe("chunking", () => {
  it("never splits mid-sentence and makes one chunk per table", () => {
    const sample = ch3.sections.filter((s) => ["23-22", "23-736", "23-21", "23-52"].includes(s.id));
    const chunks = chunkSections(sample, { maxChars: 300 });
    expect(chunks.length).toBeGreaterThan(5);
    for (const c of chunks) {
      expect(c.breadcrumbs.length).toBeGreaterThan(2);
      expect(c.url).toContain("zr.planning.nyc.gov");
    }
    // Reassembling the chunks of each paragraph (by anchor) must reproduce the source paragraph,
    // and every internal break must fall on a sentence boundary.
    for (const s of sample) {
      for (const p of s.paragraphs) {
        const parts = chunks.filter((c) => c.anchor === p.anchor).map((c) => c.text);
        if (parts.length === 0) continue; // merged into a preceding short paragraph
        const all = s.paragraphs.map((x) => x.text).join("\n");
        for (const part of parts) expect(all).toContain(part);
        for (let i = 0; i < parts.length - 1; i++) {
          expect(parts[i]).toMatch(/[.;:!?][”"')\]]*$/);
          expect(parts[i + 1]).toMatch(/^[A-Z0-9“"(]/);
        }
        // Split chunks together cover the whole paragraph.
        if (parts.length > 1 && !parts[0]!.includes("\n")) expect(parts.join(" ").replace(/\s+/g, " ")).toBe(p.text.replace(/\s+/g, " "));
      }
      const tableChunks = chunks.filter((c) => c.sectionId === s.id && /-t\d+$/.test(c.chunkId));
      expect(tableChunks).toHaveLength(s.tables.length);
      for (const tc of tableChunks) expect(tc.text).toContain("| --- |");
    }
  });
});
