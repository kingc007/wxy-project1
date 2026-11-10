import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";
import { TABLE_CLOSE, TABLE_OPEN, cleanText, nodeToText, textOf } from "./html-text.js";
import { parseTable } from "./table.js";
import type { ZrBlockRef, ZrDefinition, ZrParagraph, ZrSection, ZrTable } from "./types.js";

export const ZR_ORIGIN = "https://zr.planning.nyc.gov";

const SUP_GLYPH_START = /^[⁰¹²³⁴⁵⁶⁷⁸⁹*]|^\^\[/;
const DISTRICT_TOKEN = /^[A-Z]{1,4}\d[A-Z0-9/-]*$/;

export interface ChapterParseResult {
  sections: ZrSection[];
  definitions: ZrDefinition[];
  failures: { id: string; error: string }[];
}

interface NavNode {
  id: string;
  parent: string | null;
}

/** Build id -> parent from the navigation (teaser) articles, which are nested by structure. */
function buildNav($: CheerioAPI): Map<string, NavNode> {
  const nav = new Map<string, NavNode>();
  $("article.node--type-section.node--view-mode-teaser").each((_, el) => {
    const id = $(el).attr("data-section");
    if (!id) return;
    const parentEl = $(el).parent().closest("article.node--type-section").get(0);
    const parent = parentEl ? ($(parentEl).attr("data-section") ?? null) : null;
    if (!nav.has(id)) nav.set(id, { id, parent });
  });
  return nav;
}

/** Leading district list, e.g. "R6 R7 R8 R9 R10 R11 R12". */
export function extractDistricts(firstParagraph: string | undefined): string[] {
  if (!firstParagraph) return [];
  const tokens = firstParagraph
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, "")
    .split(/[\s,]+/)
    .filter(Boolean);
  if (tokens.length === 0 || tokens.length > 80) return [];
  return tokens.every((t) => DISTRICT_TOKEN.test(t)) ? tokens : [];
}

function paragraphLabel(text: string): string | undefined {
  const m = /^\(([A-Za-z0-9]+)\)/.exec(text);
  return m ? `(${m[1]})` : undefined;
}

interface RawBlock {
  kind: "p" | "table";
  text?: string;
  centered?: boolean;
  table?: Element;
}

function collectBlocks($: CheerioAPI, container: Element): RawBlock[] {
  const out: RawBlock[] = [];
  const pushText = (raw: string, centered: boolean) => {
    const text = cleanText(raw);
    if (text) out.push({ kind: "p", text, centered });
  };
  for (const node of container.children) {
    if (node.type === "text") {
      pushText(node.data, false);
      continue;
    }
    if (node.type !== "tag") continue;
    const el = node as Element;
    const align = ($(el).attr("align") ?? "").toLowerCase();
    const style = ($(el).attr("style") ?? "").toLowerCase();
    const centered = align === "center" || /text-align:\s*center/.test(style);
    const tables: Element[] = [];
    const raw = nodeToText($, el, 0, tables);
    if (tables.length === 0) {
      pushText(raw, centered);
      continue;
    }
    const re = new RegExp(`${TABLE_OPEN}(\\d+)${TABLE_CLOSE}`, "g");
    let last = 0;
    for (let m = re.exec(raw); m; m = re.exec(raw)) {
      pushText(raw.slice(last, m.index), false);
      out.push({ kind: "table", table: tables[Number(m[1])]! });
      last = m.index + m[0].length;
    }
    pushText(raw.slice(last), false);
  }
  return out;
}

function isCaptionLine(line: string): boolean {
  if (line.length > 220) return false;
  const letters = line.replace(/[^A-Za-z]/g, "");
  return letters.length >= 3 && letters === letters.toUpperCase();
}

function buildContent(
  $: CheerioAPI,
  id: string,
  container: Element | undefined,
): { paragraphs: ZrParagraph[]; tables: ZrTable[]; blocks: ZrBlockRef[] } {
  const paragraphs: ZrParagraph[] = [];
  const tables: ZrTable[] = [];
  const blocks: ZrBlockRef[] = [];
  if (!container) return { paragraphs, tables, blocks };
  const raw = collectBlocks($, container);
  const consumed = new Set<number>();
  // Pass 1: tables, with caption (preceding caption-like paragraph) and footnotes (following sup-led paragraphs).
  const tableAt = new Map<number, ZrTable>();
  raw.forEach((b, i) => {
    if (b.kind !== "table" || !b.table) return;
    let caption = "";
    const prev = raw[i - 1];
    if (prev && prev.kind === "p" && prev.text && !consumed.has(i - 1)) {
      const lines = prev.text.split("\n");
      const lastLine = lines[lines.length - 1] ?? "";
      if (isCaptionLine(lastLine)) {
        caption = lastLine;
        if (lines.length === 1) consumed.add(i - 1);
        else prev.text = lines.slice(0, -1).join("\n");
      }
    }
    const t = parseTable($, b.table, caption);
    let j = i + 1;
    while (j < raw.length) {
      const nb = raw[j]!;
      if (nb.kind === "p" && nb.text && SUP_GLYPH_START.test(nb.text)) {
        t.footnotes.push(nb.text.replace(/^([⁰¹²³⁴⁵⁶⁷⁸⁹]+)(?=\S)/, "$1 "));
        consumed.add(j);
        j += 1;
      } else break;
    }
    tableAt.set(i, t);
  });
  // Pass 2: ordered output.
  raw.forEach((b, i) => {
    if (b.kind === "table") {
      const t = tableAt.get(i);
      if (t) {
        tables.push(t);
        blocks.push({ type: "table", index: tables.length - 1 });
      }
      return;
    }
    if (consumed.has(i) || !b.text) return;
    const label = paragraphLabel(b.text);
    const p: ZrParagraph = { anchor: `${id}-p${paragraphs.length + 1}`, text: b.text };
    if (label) p.label = label;
    paragraphs.push(p);
    blocks.push({ type: "paragraph", index: paragraphs.length - 1 });
  });
  return { paragraphs, tables, blocks };
}

export function tableToMarkdown(t: ZrTable): string {
  const cols = Math.max(t.headers[0]?.length ?? 0, t.rows[0]?.length ?? 0);
  if (cols === 0) return t.caption;
  const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, "; ");
  // Collapse multi-row headers into one row per column (de-duplicated spanned labels).
  const header = Array.from({ length: cols }, (_, c) => {
    const parts: string[] = [];
    for (const row of t.headers) {
      const v = row[c];
      if (v && parts[parts.length - 1] !== v) parts.push(v);
    }
    return parts.join(" / ");
  });
  const lines: string[] = [];
  if (t.caption) lines.push(t.caption, "");
  lines.push(`| ${header.map(esc).join(" | ")} |`);
  lines.push(`| ${header.map(() => "---").join(" | ")} |`);
  for (const r of t.rows) lines.push(`| ${Array.from({ length: cols }, (_, c) => esc(r[c] ?? "")).join(" | ")} |`);
  if (t.footnotes.length) lines.push("", ...t.footnotes);
  return lines.join("\n");
}

export function sectionText(paragraphs: ZrParagraph[], tables: ZrTable[], blocks: ZrBlockRef[]): string {
  return blocks
    .map((b) => (b.type === "paragraph" ? paragraphs[b.index]!.text : tableToMarkdown(tables[b.index]!)))
    .join("\n\n");
}

function parseDefinitions($: CheerioAPI, sec: Element): ZrDefinition[] {
  const defs: ZrDefinition[] = [];
  $(sec)
    .find("article.node--type-defined-term")
    .each((_, art) => {
      const baseId = $(art).attr("id") ?? "";
      $(art)
        .find(".paragraph--type--definition")
        .each((i, d) => {
          const term = cleanText($(d).find(".definition__title").first().text());
          const body = $(d).find(".definition__definition").first().get(0);
          if (!term || !body) return;
          const amended = cleanText($(d).find(".definition__amended-date time").first().text());
          const applicability = cleanText($(d).find(".definition__applicability").first().text());
          const def: ZrDefinition = {
            term,
            text: textOf($, body),
            anchor: i === 0 ? baseId : `${baseId}-${i + 1}`,
          };
          if (amended) def.lastAmended = amended;
          if (applicability) def.applicability = applicability;
          defs.push(def);
        });
    });
  return defs;
}

function romanOfArticle(slug: string): string {
  return slug.replace(/^article-/, "").toUpperCase();
}

/** Parse one chapter page (all sections of the chapter are in the page). */
export function parseChapter(html: string, articleSlug: string, chapterSlug: string): ChapterParseResult {
  const $ = cheerio.load(html);
  const nav = buildNav($);
  const defaults = $("article.node--type-section.node--view-mode-default").toArray();
  const titles = new Map<string, string>();
  for (const el of defaults) {
    const id = $(el).attr("data-section");
    if (id && !titles.has(id)) titles.set(id, cleanText($(el).find("h3").first().text()));
  }
  const crumbOf = (id: string) => `${id} ${titles.get(id) ?? ""}`.trim();
  const sections: ZrSection[] = [];
  const definitions: ZrDefinition[] = [];
  const failures: { id: string; error: string }[] = [];
  const seen = new Set<string>();
  const article = romanOfArticle(articleSlug);
  const chapter = chapterSlug.replace(/^chapter-/, "");

  for (const el of defaults) {
    const id = $(el).attr("data-section") ?? "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    try {
      const about = $(el).attr("about");
      const url = about ? `${ZR_ORIGIN}${about}` : `${ZR_ORIGIN}/${articleSlug}/${chapterSlug}/${id}`;
      const amended = cleanText($(el).find(".amended time").first().text());
      const body = $(el).find("> .sec-body > .field--name-body").get(0);
      const { paragraphs, tables, blocks } = buildContent($, id, body);
      const chain: string[] = [];
      let cur: string | null = nav.get(id)?.parent ?? null;
      while (cur && chain.length < 10) {
        chain.unshift(cur);
        cur = nav.get(cur)?.parent ?? null;
      }
      sections.push({
        id,
        title: titles.get(id) ?? "",
        article,
        chapter,
        url,
        lastAmended: amended || null,
        districtsIndicated: extractDistricts(paragraphs[0]?.text),
        parent: nav.get(id)?.parent ?? null,
        breadcrumbs: [`Article ${article}`, `Chapter ${chapter}`, ...chain.map(crumbOf), crumbOf(id)],
        text: sectionText(paragraphs, tables, blocks),
        paragraphs,
        tables,
        blocks,
      });
      if ($(el).find("> .sec-body article.node--type-defined-term").length > 0) {
        definitions.push(...parseDefinitions($, el));
      }
    } catch (e) {
      failures.push({ id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { sections, definitions, failures };
}
