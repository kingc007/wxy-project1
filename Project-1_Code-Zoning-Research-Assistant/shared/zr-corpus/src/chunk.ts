import { tableToMarkdown } from "./parse.js";
import type { ZrChunk, ZrSection } from "./types.js";

export interface ChunkOptions {
  /** Paragraphs longer than this are split at sentence boundaries. */
  maxChars?: number;
  /** Paragraphs shorter than this are merged into the following paragraph. */
  minChars?: number;
  /** Max length of parentSectionText. */
  parentChars?: number;
}

/** Split text into sentences. Breaks only after . ; : ! ? (optionally followed by a closing quote/paren) and whitespace, before an uppercase letter, digit, quote or "(". */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  const re = /[.;:!?][”"')\]]*(\s+)(?=[A-Z0-9“"(])/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const end = m.index + m[0].length - m[1]!.length;
    // Do not break after abbreviations like "No."
    if (/\b(?:No|Nos|U\.S|St|Ave|Inc|Co)\.$/.test(text.slice(start, end))) continue;
    // Keep the trailing whitespace (incl. newlines) with the sentence so pieces re-join losslessly.
    out.push(text.slice(start, m.index + m[0].length));
    start = m.index + m[0].length;
  }
  const rest = text.slice(start);
  if (rest.trim()) out.push(rest);
  return out;
}

/** Group sentences into pieces of at most maxChars; a single over-long sentence stays whole. */
export function packSentences(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const pieces: string[] = [];
  let cur = "";
  for (const s of splitSentences(text)) {
    if (cur && cur.trim().length + s.trim().length > maxChars) {
      pieces.push(cur.trim());
      cur = s;
    } else cur += s;
  }
  if (cur.trim()) pieces.push(cur.trim());
  return pieces;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const sentences = splitSentences(text);
  let out = "";
  for (const s of sentences) {
    if ((out + s).trim().length > max) break;
    out += s;
  }
  out = out.trim();
  if (!out) out = text.slice(0, max).replace(/\s+\S*$/, "");
  return `${out} …`;
}

/** Chunk sections on structural boundaries: one chunk per paragraph (long ones split at sentence ends) and one per table. */
export function chunkSections(sections: ZrSection[], opts: ChunkOptions = {}): ZrChunk[] {
  const maxChars = opts.maxChars ?? 1800;
  const minChars = opts.minChars ?? 60;
  const parentChars = opts.parentChars ?? 600;
  const byId = new Map(sections.map((s) => [s.id, s]));
  const chunks: ZrChunk[] = [];
  for (const sec of sections) {
    const parent = sec.parent ? byId.get(sec.parent) : undefined;
    const parentText = parent?.text ? truncate(parent.text, parentChars) : undefined;
    const base = { sectionId: sec.id, breadcrumbs: sec.breadcrumbs, lastAmended: sec.lastAmended, url: sec.url };
    const push = (chunkId: string, anchor: string, text: string) => {
      const c: ZrChunk = { chunkId, anchor, text, ...base };
      if (parentText) c.parentSectionText = parentText;
      chunks.push(c);
    };
    let pending: { anchor: string; text: string } | null = null;
    const flushPending = () => {
      if (!pending) return;
      emitParagraph(pending.anchor, pending.text);
      pending = null;
    };
    const emitParagraph = (anchor: string, text: string) => {
      const pieces = packSentences(text, maxChars);
      pieces.forEach((p, i) => push(i === 0 ? anchor : `${anchor}-s${i + 1}`, anchor, p));
    };
    let tableNo = 0;
    for (const b of sec.blocks) {
      if (b.type === "table") {
        flushPending();
        tableNo += 1;
        const anchor = `${sec.id}-t${tableNo}`;
        push(anchor, anchor, tableToMarkdown(sec.tables[b.index]!));
        continue;
      }
      const p = sec.paragraphs[b.index]!;
      if (pending) {
        pending = { anchor: pending.anchor, text: `${pending.text}\n${p.text}` };
        if (pending.text.length >= minChars) flushPending();
      } else if (p.text.length < minChars) {
        pending = { anchor: p.anchor, text: p.text };
      } else emitParagraph(p.anchor, p.text);
    }
    flushPending();
  }
  return chunks;
}
