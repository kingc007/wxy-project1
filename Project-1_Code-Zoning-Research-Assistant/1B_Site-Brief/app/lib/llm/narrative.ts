// Cited narrative (1B memo prose). Sonnet + Citations over custom-content ZR documents, streamed.
// Numbers come only from the deterministic summary; every sentence is labelled after validation.
import type Anthropic from "@anthropic-ai/sdk";
import type { SiteData } from "@/lib/types";
import type { ZoningBrief } from "@/lib/zoning/model";
import { getSection } from "@/lib/zr/corpus";
import { sectionBlocks } from "./blocks";
import { MODELS, costFromUsage, getClient, normUsage, type LlmClient } from "./client";
import { citedSectionIds, computedSummary } from "./summary";
import {
  allowedNumbers, labelSentences, mapCitation, sentenceAtOffset,
  type DocSection, type LabelledSentence, type RawCitation,
} from "./validate";

export type NarrativeEvent =
  | { type: "text"; delta: string }
  | { type: "citation"; sentenceIndex: number; sectionId: string; anchor: string; cited_text: string; url: string | null }
  | { type: "sentences"; sentences: LabelledSentence[] }
  | { type: "usage"; model: string; input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number; cost: number }
  | { type: "error"; message: string };

export interface NarrativeDeps { client?: LlmClient | null; section?: typeof getSection }

export const NARRATIVE_SYSTEM = `You write the short narrative paragraph of a pre-design zoning site brief for architects in New York City.
Rules:
- 120 to 220 words, plain professional tone, no markdown, no lists, no headings.
- Every sentence that states what the Zoning Resolution says must be supported by a citation to the provided documents.
- The computed-values summary was produced by deterministic code. You may restate numbers that appear in it. Do not introduce any other number, and do not do arithmetic.
- Do not use prior knowledge of zoning rules. If a value is "needs_input" or "manual", say that it needs input or manual review.
- Mention every review flag in the summary and every assumption that materially affects the result.`;

export function buildDocs(brief: ZoningBrief, section = getSection, limit = 12): DocSection[] {
  const docs: DocSection[] = [];
  for (const id of citedSectionIds(brief, limit)) {
    const s = section(id);
    if (!s) continue;
    const blocks = sectionBlocks(s);
    if (blocks.length) docs.push({ sectionId: s.id, title: `ZR ${s.id} — ${s.title} (last amended ${s.lastAmended ?? "date unknown"})`, url: s.url, blocks });
  }
  return docs;
}

export async function* streamNarrative(brief: ZoningBrief, site: SiteData, deps: NarrativeDeps = {}): AsyncGenerator<NarrativeEvent> {
  const client = deps.client === undefined ? getClient() : deps.client;
  if (!client) return;
  const docs = buildDocs(brief, deps.section);
  const summary = JSON.stringify(computedSummary(brief, site));

  const docBlocks: Anthropic.Messages.DocumentBlockParam[] = docs.map((d, i) => ({
    type: "document",
    source: { type: "content", content: d.blocks.map((b) => ({ type: "text" as const, text: b.text })) },
    title: d.title,
    context: "NYC Zoning Resolution, zr.planning.nyc.gov",
    citations: { enabled: true },
    // The API allows few cache breakpoints; one on the last document caches the whole static document prefix.
    ...(i === docs.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));

  const stream = client.messages.stream({
    model: MODELS.synth,
    max_tokens: 1500,
    system: NARRATIVE_SYSTEM,
    output_config: { effort: "low" },
    messages: [{
      role: "user",
      content: [
        ...docBlocks,
        { type: "text", text: `Computed values (deterministic code; not citable; do not restate numbers that are not present here):\n${summary}` },
        { type: "text", text: "Write the narrative paragraph now (120-220 words)." },
      ],
    }],
  });

  let full = "";
  const valid = new Map<number, number>();
  const dropped = new Map<number, number>();
  const bump = (m: Map<number, number>, k: number) => m.set(k, (m.get(k) ?? 0) + 1);
  try {
    for await (const ev of stream) {
      if (ev.type !== "content_block_delta") continue;
      const d = ev.delta;
      if (d.type === "text_delta") {
        full += d.text;
        yield { type: "text", delta: d.text };
      } else if (d.type === "citations_delta") {
        const idx = sentenceAtOffset(full, full.length);
        const r = mapCitation(d.citation as unknown as RawCitation, docs);
        if (r.ok) {
          bump(valid, idx);
          yield { type: "citation", sentenceIndex: idx, ...r.citation };
        } else bump(dropped, idx);
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal" || final.stop_reason === "max_tokens") {
      yield { type: "error", message: `Narrative stopped early (${final.stop_reason}).` };
    }
    const sectionIds = new Set(docs.map((d) => d.sectionId));
    const allowed = allowedNumbers(summary, docs.map((d) => `${d.sectionId} ${d.title}`).join(" "));
    yield { type: "sentences", sentences: labelSentences(full, { valid, dropped }, allowed, sectionIds) };
    const u = normUsage(final.usage);
    yield { type: "usage", model: MODELS.synth, ...u, cost: costFromUsage(MODELS.synth, u) };
  } catch (e) {
    yield { type: "error", message: e instanceof Error ? e.message.slice(0, 200) : "Narrative failed" };
  }
}
