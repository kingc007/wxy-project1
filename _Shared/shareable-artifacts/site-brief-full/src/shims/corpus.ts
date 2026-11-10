// Browser replacement for app/lib/zr/corpus.ts (which reads app/data/zr/*.json from disk). Same API; the corpus
// JSON is bundled into the page instead.
import type { ZrSection } from "@/lib/zr/types";
import zrGz from "virtual:zr-gz";

// The corpus is bundled gzip+base64 (about 3 MB of JSON -> ~1 MB) and inflated once, at startup (top-level await).
async function inflate(b64: string): Promise<unknown> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text());
}
const corpus = (await inflate(zrGz)) as { sections: unknown; definitions: unknown; manifest: unknown };
const sectionList = corpus.sections;
const definitionList = corpus.definitions;
const manifestJson = corpus.manifest;

export interface ZrDefinition {
  term: string;
  text: string;
  lastAmended?: string;
  anchor: string;
  applicability?: string;
}

export interface CorpusManifest {
  source: string;
  retrievedAt: string;
  sectionCount: number;
  definitionCount: number;
  chapters: { url: string; fetchedAt: string; sectionCount: number }[];
}

let sectionsById: Map<string, ZrSection> | null = null;
let defsByTerm: Map<string, ZrDefinition> | null = null;

function loadSections(): Map<string, ZrSection> {
  if (!sectionsById) sectionsById = new Map((sectionList as unknown as ZrSection[]).map((s) => [s.id, s]));
  return sectionsById;
}

export function getSection(id: string): ZrSection | undefined {
  return loadSections().get(id.trim());
}

export function allSections(): ZrSection[] {
  return [...loadSections().values()];
}

export function getDefinition(term: string): ZrDefinition | undefined {
  if (!defsByTerm) {
    defsByTerm = new Map();
    for (const d of definitionList as unknown as ZrDefinition[]) {
      const k = d.term.trim().toLowerCase();
      if (!defsByTerm.has(k)) defsByTerm.set(k, d);
    }
  }
  return defsByTerm.get(term.trim().toLowerCase());
}

export function manifest(): CorpusManifest {
  return manifestJson as unknown as CorpusManifest;
}
