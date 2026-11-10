// In-memory BM25 over ZR chunks (paragraphs and table rows) for the `searchZoningText` LLM tool.
// Section ids such as "23-22" and district names such as "R7-1" are kept as single tokens.
import { allSections } from "./corpus";

export interface Chunk {
  chunkId: string;
  sectionId: string;
  /** Paragraph anchor, or "t<n>" / "t<n>r<m>" (same scheme as QuoteLocation.where). */
  anchor: string;
  text: string;
  title: string;
  url: string;
  lastAmended: string | null;
  breadcrumbs: string[];
}
export interface SearchHit extends Chunk { score: number }

const STOP = new Set(["the", "a", "an", "of", "and", "or", "in", "to", "is", "for", "be", "by", "on", "at", "as", "any", "such"]);

export function tokenize(text: string): string[] {
  const raw = text.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+(?:[-.][\p{L}\p{N}]+)*/gu) ?? [];
  return raw
    .filter((t) => !STOP.has(t))
    .map((t) => (t.length > 3 && t.endsWith("s") && !/\d/.test(t) ? t.slice(0, -1) : t));
}

export class Bm25Index<T extends { text: string }> {
  private tf: Map<string, number>[] = [];
  private len: number[] = [];
  private df = new Map<string, number>();
  private avg = 0;
  constructor(
    private docs: T[],
    private k1 = 1.5,
    private b = 0.75,
    textOf: (d: T) => string = (d) => d.text,
  ) {
    for (const d of docs) {
      const toks = tokenize(textOf(d));
      const m = new Map<string, number>();
      for (const t of toks) m.set(t, (m.get(t) ?? 0) + 1);
      for (const t of m.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      this.tf.push(m);
      this.len.push(toks.length);
    }
    this.avg = this.len.reduce((a, b2) => a + b2, 0) / Math.max(1, this.len.length);
  }
  search(query: string, limit = 8): (T & { score: number })[] {
    const q = [...new Set(tokenize(query))];
    const N = this.docs.length;
    const scored: (T & { score: number })[] = [];
    this.docs.forEach((d, i) => {
      let score = 0;
      for (const t of q) {
        const f = this.tf[i].get(t);
        if (!f) continue;
        const n = this.df.get(t) ?? 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        score += (idf * f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * this.len[i]) / this.avg));
      }
      if (score > 0) scored.push({ ...d, score });
    });
    return scored.sort((x, y) => y.score - x.score).slice(0, limit);
  }
}

let index: Bm25Index<Chunk> | null = null;

function buildChunks(): Chunk[] {
  const chunks: Chunk[] = [];
  for (const s of allSections()) {
    const base = { sectionId: s.id, title: s.title, url: s.url, lastAmended: s.lastAmended, breadcrumbs: s.breadcrumbs };
    for (const p of s.paragraphs) {
      chunks.push({ ...base, chunkId: p.anchor, anchor: p.anchor, text: `${p.label ?? ""} ${p.text}`.trim() });
    }
    s.tables.forEach((t, ti) => {
      const head = t.headers.at(-1) ?? [];
      t.rows.forEach((r, ri) => {
        const cells = r.filter((c, i) => i === 0 || c !== r[i - 1]);
        if (cells.length < 2) return; // banner rows
        const text = `${t.caption ? t.caption + " | " : ""}${head.filter((c, i) => i === 0 || c !== head[i - 1]).join(" ; ")} | ${cells.join(" ; ")}`;
        chunks.push({ ...base, chunkId: `${s.id}-t${ti}r${ri}`, anchor: `t${ti}r${ri}`, text: text.replace(/\s+/g, " ") });
      });
    });
  }
  return chunks;
}

/** Ranked passages for a query. Section id and title are searchable alongside the text. */
export function searchZoningText(query: string, limit = 8): SearchHit[] {
  index ??= new Bm25Index<Chunk>(buildChunks(), 1.5, 0.75, (c) => `${c.sectionId} ${c.title} ${c.text}`);
  return index.search(query, limit);
}
