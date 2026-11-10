// The agent's searchZoningText tool. There is a single BM25 implementation (lib/zr/search.ts); this file only
// reshapes its hits into the compact form the tool returns to the model.
import { searchZoningText } from "@/lib/zr/search";

export interface SearchHit { sectionId: string; title: string; anchor: string; snippet: string; score: number }

export function searchZr(query: string, limit = 5): SearchHit[] {
  return searchZoningText(query, limit).map((h) => ({
    sectionId: h.sectionId,
    title: h.title,
    anchor: h.anchor,
    snippet: h.text.slice(0, 400),
    score: Math.round(h.score * 1000) / 1000,
  }));
}
