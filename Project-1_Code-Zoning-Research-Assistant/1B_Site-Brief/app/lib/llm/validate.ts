// Deterministic post-validation of the cited narrative: citation mapping, cited_text verification, sentence
// splitting and the numeric check. Pure functions; no SDK calls.
import type { SectionBlock } from "./blocks";

/** A section sent to the API as one custom-content document (array position == document_index). */
export interface DocSection { sectionId: string; title: string; url: string | null; blocks: SectionBlock[] }

export interface RawCitation {
  type: string;
  cited_text?: string;
  document_index?: number;
  start_block_index?: number;
  end_block_index?: number;
}

export interface MappedCitation { sectionId: string; anchor: string; cited_text: string; url: string | null }
export type CitationResult = { ok: true; citation: MappedCitation } | { ok: false; reason: string };

// whitespace-insensitive: the API joins blocks without a separator
const norm = (s: string) => s.normalize("NFKC").replace(/\s+/g, "").toLowerCase();

/**
 * Map an API citation back to our section/anchor and verify `cited_text` is contained in the cited blocks
 * (blocks start..end-1, joined). Anything else is dropped.
 */
export function mapCitation(c: RawCitation, docs: DocSection[]): CitationResult {
  if (c.type !== "content_block_location") return { ok: false, reason: `unsupported citation type ${c.type}` };
  const doc = c.document_index === undefined ? undefined : docs[c.document_index];
  if (!doc) return { ok: false, reason: `unknown document_index ${String(c.document_index)}` };
  const start = c.start_block_index ?? -1;
  const end = c.end_block_index ?? start + 1;
  if (start < 0 || start >= doc.blocks.length || end <= start || end > doc.blocks.length) {
    return { ok: false, reason: `block range ${start}..${end} outside document ${doc.sectionId}` };
  }
  const cited = c.cited_text ?? "";
  const region = norm(doc.blocks.slice(start, end).map((b) => b.text).join(" "));
  if (!cited.trim() || !region.includes(norm(cited))) return { ok: false, reason: "cited_text not found in the cited blocks" };
  return { ok: true, citation: { sectionId: doc.sectionId, anchor: doc.blocks[start].anchor, cited_text: cited, url: doc.url } };
}

export interface Sentence { index: number; start: number; end: number; text: string }

const BOUNDARY = /(?<=[.!?]["')\]]*)\s+(?=[A-Z0-9"(\[])|\n+/g;

export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  let start = 0;
  const push = (end: number) => {
    const raw = text.slice(start, end);
    const t = raw.trim();
    if (t) {
      const lead = raw.length - raw.trimStart().length;
      out.push({ index: out.length, start: start + lead, end: start + lead + t.length, text: t });
    }
  };
  for (const m of text.matchAll(BOUNDARY)) {
    push(m.index);
    start = m.index + m[0].length;
  }
  push(text.length);
  return out;
}

/** Index of the sentence containing the last non-space character before `offset`. */
export function sentenceAtOffset(text: string, offset: number): number {
  const sents = splitSentences(text.slice(0, offset));
  return Math.max(0, sents.length - 1);
}

// Tokens whose digits are identifiers, not claims: district codes (R6A, C4-3, M1-1), ZR section ids.
const DISTRICT_RE = /\b[RCM]\d+(?:-\d+)?[A-Z]{0,2}\b/g;
const SECTION_RE = /\b\d{1,3}-\d{1,3}[A-Za-z]?\b/g;
const NUM_RE = /\d[\d,]*(?:\.\d+)?/g;

const canon = (raw: string) => {
  const n = parseFloat(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? String(Math.round(n * 1e4) / 1e4) : raw;
};

export function extractNumbers(s: string): string[] {
  return (s.match(NUM_RE) ?? []).map(canon);
}

/** Canonical numbers present in the computed-values summary (plus extras such as section ids and dates). */
export function allowedNumbers(...texts: string[]): Set<string> {
  const set = new Set<string>();
  for (const t of texts) {
    for (const n of extractNumbers(t)) set.add(n);
  }
  return set;
}

/** Numbers in a sentence that are not in the allowed set. District codes and section ids in `sectionIds` are ignored. */
export function unsupportedNumbers(sentence: string, allowed: Set<string>, sectionIds: Set<string> = new Set()): string[] {
  let s = sentence.replace(DISTRICT_RE, " ");
  s = s.replace(SECTION_RE, (m) => (sectionIds.has(m.toLowerCase()) || sectionIds.has(m) ? " " : m));
  return extractNumbers(s).filter((n) => !allowed.has(n));
}

export type SentenceLabel = "cited" | "inferred" | "unverified" | "plain";
export interface LabelledSentence {
  index: number;
  text: string;
  label: SentenceLabel;
  citations: number;
  unsupportedNumbers: string[];
}

export interface CitationTally { valid: Map<number, number>; dropped: Map<number, number> }

/**
 * cited: >=1 verified citation. Otherwise: a digit whose number is not in the computed summary -> unverified;
 * else a dropped (unverifiable) citation -> inferred; else plain.
 */
export function labelSentences(text: string, tally: CitationTally, allowed: Set<string>, sectionIds: Set<string>): LabelledSentence[] {
  return splitSentences(text).map((s) => {
    const valid = tally.valid.get(s.index) ?? 0;
    const dropped = tally.dropped.get(s.index) ?? 0;
    const bad = valid > 0 ? [] : unsupportedNumbers(s.text, allowed, sectionIds);
    const label: SentenceLabel = valid > 0 ? "cited" : bad.length ? "unverified" : dropped > 0 ? "inferred" : "plain";
    return { index: s.index, text: s.text, label, citations: valid, unsupportedNumbers: bad };
  });
}
