import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZR_ORIGIN, parseChapter } from "./parse.js";
import type { ZrDefinition, ZrSection } from "./types.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(ROOT, "raw");
const DATA = path.join(ROOT, "data");
const UA = "WXY-Prototype-ZR-Ingest/0.1 (research prototype; polite, <=1 req/s)";

/** Scope: article slug -> wanted chapter numbers. */
export const SCOPE: Record<string, number[]> = {
  "article-i": [2],
  "article-ii": [1, 2, 3, 4, 5],
  "article-iii": [2, 3, 4, 5],
  "article-iv": [2, 3],
  "article-vii": [7],
};

let lastRequest = 0;
async function politeFetch(url: string): Promise<{ status: number; body: string }> {
  const wait = 1100 - (Date.now() - lastRequest);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();
  const res = await fetch(url, { headers: { "user-agent": UA } });
  return { status: res.status, body: await res.text() };
}

/** Get a page, from raw/ cache if present, else fetch (and cache). Returns null on non-200. */
async function getPage(urlPath: string, cacheName: string): Promise<{ html: string; fetchedAt: string; url: string } | null> {
  const url = `${ZR_ORIGIN}${urlPath}`;
  const file = path.join(RAW, cacheName);
  if (fs.existsSync(file)) {
    return { html: fs.readFileSync(file, "utf8"), fetchedAt: fs.statSync(file).mtime.toISOString(), url };
  }
  const { status, body } = await politeFetch(url);
  if (status !== 200) {
    console.warn(`SKIP ${url} -> HTTP ${status}`);
    return null;
  }
  fs.mkdirSync(RAW, { recursive: true });
  fs.writeFileSync(file, body);
  return { html: body, fetchedAt: new Date().toISOString(), url };
}

async function main() {
  fs.mkdirSync(DATA, { recursive: true });
  const home = await getPage("/", "home.html");
  if (!home) throw new Error("home page unavailable");
  const cur = /All text changes approved by the city council as of\s*<span[^>]*>([^<]+)<\/span>/.exec(home.html);
  const homepageCurrencyLine = cur ? `All text changes approved by the city council as of ${cur[1]!.trim()}` : null;

  const sections: ZrSection[] = [];
  const definitions: ZrDefinition[] = [];
  const chapters: { url: string; fetchedAt: string; sectionCount: number }[] = [];
  const discoveryPages: { url: string; fetchedAt: string }[] = [{ url: home.url, fetchedAt: home.fetchedAt }];
  const skipped: { url: string; reason: string }[] = [];
  const parseFailures: { chapter: string; id: string; error: string }[] = [];

  for (const [article, nums] of Object.entries(SCOPE)) {
    const art = await getPage(`/${article}`, `${article}.html`);
    if (!art) {
      skipped.push({ url: `${ZR_ORIGIN}/${article}`, reason: "article page not available" });
      continue;
    }
    discoveryPages.push({ url: art.url, fetchedAt: art.fetchedAt });
    for (const n of nums) {
      const chapterSlug = `chapter-${n}`;
      const chapterPath = `/${article}/${chapterSlug}`;
      // Discover from the article page's navigation rather than guessing.
      if (!art.html.includes(`href="${chapterPath}"`)) {
        skipped.push({ url: `${ZR_ORIGIN}${chapterPath}`, reason: "not linked from article page" });
        console.warn(`SKIP ${chapterPath}: not linked from ${article}`);
        continue;
      }
      const page = await getPage(chapterPath, `${article}_${chapterSlug}.html`);
      if (!page) {
        skipped.push({ url: `${ZR_ORIGIN}${chapterPath}`, reason: "non-200 response" });
        continue;
      }
      const r = parseChapter(page.html, article, chapterSlug);
      sections.push(...r.sections);
      definitions.push(...r.definitions);
      for (const f of r.failures) parseFailures.push({ chapter: chapterPath, ...f });
      chapters.push({ url: page.url, fetchedAt: page.fetchedAt, sectionCount: r.sections.length });
      console.log(`${chapterPath}: ${r.sections.length} sections, ${r.definitions.length} definitions, ${r.failures.length} failures`);
    }
  }

  const ids = new Set<string>();
  const dupes: string[] = [];
  for (const s of sections) {
    if (ids.has(s.id)) dupes.push(s.id);
    else ids.add(s.id);
  }

  fs.writeFileSync(path.join(DATA, "zr-sections.json"), JSON.stringify(sections, null, 1));
  fs.writeFileSync(path.join(DATA, "definitions.json"), JSON.stringify(definitions, null, 1));
  const manifest = {
    source: ZR_ORIGIN,
    retrievedAt: new Date(Math.max(...chapters.map((c) => Date.parse(c.fetchedAt)))).toISOString(),
    sectionCount: sections.length,
    definitionCount: definitions.length,
    chapters,
    discoveryPages,
    skipped,
    parseFailures,
    duplicateSectionIds: dupes,
    homepageCurrencyLine,
  };
  fs.writeFileSync(path.join(DATA, "manifest.json"), JSON.stringify(manifest, null, 1));
  console.log(`total sections ${sections.length}; definitions ${definitions.length}; failures ${parseFailures.length}; skipped ${skipped.length}`);
  console.log(`homepageCurrencyLine: ${homepageCurrencyLine}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
