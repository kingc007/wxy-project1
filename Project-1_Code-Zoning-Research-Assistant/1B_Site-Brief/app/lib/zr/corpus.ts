// Server-side access to the ingested ZR corpus (app/data/zr/*.json, copied by scripts/sync-corpus.mjs).
// Node-only (uses fs): import from route handlers, scripts and tests, never from client components.
import fs from "node:fs";
import path from "node:path";
import type { ZrSection } from "./types";

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
let manifestCache: CorpusManifest | null = null;

function readJson<T>(file: string): T {
  const p = path.join(process.cwd(), "data", "zr", file);
  if (!fs.existsSync(p)) {
    throw new Error(`ZR corpus file missing: ${p}. Run \`npm run sync-corpus\`.`);
  }
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

function loadSections(): Map<string, ZrSection> {
  if (!sectionsById) {
    const list = readJson<ZrSection[]>("zr-sections.json");
    sectionsById = new Map(list.map((s) => [s.id, s]));
  }
  return sectionsById;
}

export function getSection(id: string): ZrSection | undefined {
  return loadSections().get(id.trim());
}

/** All sections in corpus order. */
export function allSections(): ZrSection[] {
  return [...loadSections().values()];
}

export function getDefinition(term: string): ZrDefinition | undefined {
  if (!defsByTerm) {
    const list = readJson<ZrDefinition[]>("definitions.json");
    defsByTerm = new Map();
    for (const d of list) {
      const k = d.term.trim().toLowerCase();
      // keep the first (general) definition when a term appears more than once
      if (!defsByTerm.has(k)) defsByTerm.set(k, d);
    }
  }
  return defsByTerm.get(term.trim().toLowerCase());
}

export function manifest(): CorpusManifest {
  if (!manifestCache) manifestCache = readJson<CorpusManifest>("manifest.json");
  return manifestCache;
}
