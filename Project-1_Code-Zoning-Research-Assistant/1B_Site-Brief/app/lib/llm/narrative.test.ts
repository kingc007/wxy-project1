import { describe, expect, it } from "vitest";
import { buildDocs, streamNarrative, type NarrativeEvent } from "./narrative";
import { citeDelta, mockClient, mockStream, sampleBrief, sampleSite, textDelta } from "./helpers.test-util";

const site = sampleSite();
const brief = sampleBrief(site);
const docs = buildDocs(brief);
const di = docs.findIndex((d) => d.sectionId === "23-22");
const row = docs[di].blocks.findIndex((b) => b.text.startsWith("R7A ") && b.text.includes("| 4.00 |"));

async function collect(events: unknown[]) {
  const client = mockClient({ stream: mockStream(events) });
  const out: NarrativeEvent[] = [];
  for await (const e of streamNarrative(brief, site, { client })) out.push(e);
  return { out, client };
}

describe("streamNarrative", () => {
  it("builds citable documents from cited sections (max 12, titled with amendment date)", () => {
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.length).toBeLessThanOrEqual(12);
    expect(docs[di].title).toMatch(/^ZR 23-22 — .* \(last amended \d/);
  });
  it("maps citations, drops unverifiable ones, labels sentences, reports usage", async () => {
    const good = docs[di].blocks[row].text;
    const { out, client } = await collect([
      textDelta("The maximum FAR is 4.00."),
      citeDelta({ type: "content_block_location", document_index: di, start_block_index: row, end_block_index: row + 1, cited_text: good, document_title: "t" }),
      textDelta(" The lot may build 99,999 sf."),
      citeDelta({ type: "content_block_location", document_index: di, start_block_index: row, end_block_index: row + 1, cited_text: "not in the block" }),
      textDelta(" Heights are limited."),
      citeDelta({ type: "content_block_location", document_index: di, start_block_index: row, end_block_index: row + 1, cited_text: "also fake" }),
    ]);
    const cites = out.filter((e) => e.type === "citation");
    expect(cites).toEqual([{ type: "citation", sentenceIndex: 0, sectionId: "23-22", anchor: docs[di].blocks[row].anchor, cited_text: good, url: expect.any(String) }]);
    const sents = out.find((e) => e.type === "sentences");
    expect(sents && sents.type === "sentences" && sents.sentences.map((s) => s.label)).toEqual(["cited", "unverified", "inferred"]);
    expect(out.filter((e) => e.type === "text").map((e) => (e as { delta: string }).delta).join("")).toContain("maximum FAR");
    const u = out.find((e) => e.type === "usage");
    expect(u).toMatchObject({ model: "claude-sonnet-5-5", cost: 0.004 });
    // request shape: citations enabled, no forbidden params
    const p = client.calls.stream[0] as Record<string, unknown>;
    expect(p).not.toHaveProperty("temperature");
    expect(p.output_config).toEqual({ effort: "low" });
    const content = (p.messages as { content: Record<string, unknown>[] }[])[0].content;
    expect(content[0]).toMatchObject({ type: "document", citations: { enabled: true }, context: "NYC Zoning Resolution, zr.planning.nyc.gov" });
    expect(content.filter((c) => c.cache_control).length).toBe(1);
    expect(content.at(-2)).toMatchObject({ type: "text" });
  });
  it("reports an error event when the stream throws", async () => {
    const client = mockClient({ stream: { async *[Symbol.asyncIterator]() { throw new Error("boom"); }, finalMessage: async () => { throw new Error("x"); } } });
    const out: NarrativeEvent[] = [];
    for await (const e of streamNarrative(brief, site, { client })) out.push(e);
    expect(out).toEqual([{ type: "error", message: "boom" }]);
  });
});
