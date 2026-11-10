// Locate a cited quote inside a ZR section (paragraphs, table headers, table rows, footnotes).
// Pure and isomorphic: no fs access, safe to use in route handlers, tests and the browser.
//
// Quotes in the rules files are not always one contiguous string: they may join fragments with
// " — " (quote, then a footnote), " / " (banner row, then row), "Row:" / "Header:" (table prefixes), and cells with " ; " or " | ". Superscript
// glyphs (¹²³) and punctuation differ between sources. We compare on a letters-and-digits-only form
// (NFKC, lower-case) so whitespace, dashes, separators and superscripts cannot cause a miss.
//
// `where` codes: paragraph anchor ("23-22-p1"), "t<n>" (table n, 0-based; header, caption or footnote
// match), or "t<n>r<m>" (table n, body row m, 0-based, as in ZrTable.rows).
import type { QuoteLocation, ZrSection } from "./types";

/** Letters and digits only, NFKC-folded (so "¹" becomes "1"), lower-case. */
export function squash(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

const CELL_SPLIT = /\s*(?:;|\|)\s*/;

/** Split a quote into independent fragments ("Row:" markers and " — " separators). */
export function splitFragments(quote: string): string[] {
  return quote
    .replace(/…|\.{3}\s*$/g, " ")
    .split(/\s+[—–]\s+|\s+\/\s+|\b(?:Row|Header):/)
    .map((f) => f.trim().replace(/^Footnote\s+\S+:\s*/i, ""))
    .filter((f) => squash(f).length >= 2);
}

function dedupeAdjacent(cells: string[]): string[] {
  return cells.filter((c, i) => i === 0 || c !== cells[i - 1]);
}

interface Row {
  where: string;
  cells: string[]; // squashed cells
  joined: string; // squashed, concatenated
}

function rowOf(where: string, raw: string[], dedupe: boolean): Row {
  const cells = (dedupe ? dedupeAdjacent(raw) : raw).map(squash);
  return { where, cells, joined: cells.join("") };
}

function containsRun(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    if (needle.every((n, j) => haystack[i + j] === n)) return true;
  }
  return false;
}

function locateFragment(section: ZrSection, fragment: string): string | null {
  const frag = squash(fragment);
  if (!frag) return null;
  const cellFrags = fragment.split(CELL_SPLIT).map(squash).filter(Boolean);

  const tableRows: Row[] = [];
  const tableOther: Row[] = []; // headers, captions, footnotes (reported as "t<n>")
  section.tables.forEach((t, ti) => {
    const w = `t${ti}`;
    if (t.caption) tableOther.push(rowOf(w, [t.caption], false));
    for (const h of t.headers) {
      tableOther.push(rowOf(w, h, true));
    }
    for (const f of t.footnotes) tableOther.push(rowOf(w, [f], false));
    t.rows.forEach((r, ri) => {
      tableRows.push(rowOf(`t${ti}r${ri}`, r, false));
      tableRows.push(rowOf(`t${ti}r${ri}`, r, true));
    });
  });

  // Tier 1: the cells of a fragment equal consecutive cells of one row (most precise).
  if (cellFrags.length > 1) {
    for (const r of tableRows) if (containsRun(r.cells, cellFrags)) return r.where;
    for (const r of tableOther) if (containsRun(r.cells, cellFrags)) return r.where;
  }
  // Tier 2: whole fragment contained in a paragraph, row or header (squashed).
  for (const p of section.paragraphs) {
    if (squash(`${p.label ?? ""}${p.text}`).includes(frag)) return p.anchor;
  }
  for (const r of tableRows) if (r.joined.includes(frag)) return r.where;
  for (const r of tableOther) if (r.joined.includes(frag)) return r.where;
  // Tier 3: every cell of the fragment appears somewhere in one table (header + body + footnotes).
  if (cellFrags.length > 1) {
    for (let ti = 0; ti < section.tables.length; ti++) {
      const w = `t${ti}`;
      const cells = new Set<string>();
      for (const r of [...tableRows, ...tableOther]) {
        if (r.where === w || r.where.startsWith(`${w}r`)) for (const c of r.cells) cells.add(c);
      }
      if (cellFrags.every((c) => cells.has(c))) return w;
    }
  }
  return null;
}

function isBanner(section: ZrSection, where: string): boolean {
  const m = /^t(\d+)r(\d+)$/.exec(where);
  if (!m) return false;
  const row = section.tables[Number(m[1])]?.rows[Number(m[2])];
  return !!row && row.length > 1 && row.every((c) => c === row[0]);
}

/** Find where `quote` sits inside `section`. found=true only if every fragment of the quote is located. */
export function locateQuote(section: ZrSection, quote: string): QuoteLocation {
  const fragments = splitFragments(quote);
  if (fragments.length === 0) return { sectionId: section.id, where: null, found: false };
  let first: string | null = null;
  for (const f of fragments) {
    const w = locateFragment(section, f);
    if (w === null) return { sectionId: section.id, where: null, found: false };
    // Prefer a real row over a full-width banner row ("Within M1-1 Districts") as the highlight target.
    if (first === null || (isBanner(section, first) && !isBanner(section, w))) first = w;
  }
  return { sectionId: section.id, where: first, found: true };
}

/**
 * Character range of `fragment` inside `text`, comparing on the squashed form but returning offsets into the
 * original string (so a paragraph can be highlighted around just the cited words). null if absent.
 */
export function findSpan(text: string, fragment: string): { start: number; end: number } | null {
  const target = squash(fragment);
  if (!target) return null;
  let squashed = "";
  const origin: number[] = []; // squashed index -> original index
  let i = 0;
  for (const ch of text) {
    const s = squash(ch);
    for (let k = 0; k < s.length; k++) origin.push(i);
    squashed += s;
    i += ch.length;
  }
  const at = squashed.indexOf(target);
  if (at < 0) return null;
  const lastChar = origin[at + target.length - 1];
  const lastLen = String.fromCodePoint(text.codePointAt(lastChar) ?? 0).length;
  return { start: origin[at], end: lastChar + lastLen };
}
