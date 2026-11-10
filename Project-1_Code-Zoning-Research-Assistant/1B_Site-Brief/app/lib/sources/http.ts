// Cached JSON fetcher shared by every data source. Server-side only (uses node:fs).
//
// SOURCE_MODE (env):
//   live        always hit the network; store the response; on failure fall back to a cached copy (stale: true)
//   cache-first (default) use a cached copy if present, otherwise hit the network and store it;
//               if the network fails and a cache exists -> cached copy with stale: true
//   offline     never touch the network; cache only (throws when missing)
// Cache lookup order: app/.cache/http (writable, git-ignored) then app/fixtures/http (committed, read-only).
import { createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";

export type SourceMode = "live" | "cache-first" | "offline";

export interface FetchResult<T = unknown> {
  body: T;
  fetchedAt: string; // ISO; time the body was originally retrieved from the network
  url: string;
  fromCache: boolean;
  stale: boolean; // true when a live fetch was wanted but failed and a cached copy was served
}

export interface FetchMeta {
  url: string;
  source: string | null;
  fromCache: boolean;
  stale: boolean;
  fetchedAt: string;
  cacheFile: string; // file name (sha1.json)
  staleReason?: string;
}

interface CacheEntry {
  url: string;
  fetchedAt: string;
  body: unknown;
}

export const FETCH_TIMEOUT_MS = 10_000;

export function getSourceMode(): SourceMode {
  const m = (process.env.SOURCE_MODE ?? "cache-first").trim().toLowerCase();
  return m === "live" || m === "offline" ? m : "cache-first";
}

export function cacheDir(): string {
  return path.resolve(process.cwd(), ".cache", "http");
}
export function fixturesDir(): string {
  return path.resolve(process.cwd(), "fixtures", "http");
}
export function cacheFileName(url: string): string {
  return createHash("sha1").update(url).digest("hex") + ".json";
}

function readEntry(dir: string, file: string): CacheEntry | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as CacheEntry;
    return parsed && typeof parsed.fetchedAt === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function readAnyCache(file: string): CacheEntry | null {
  return readEntry(cacheDir(), file) ?? readEntry(fixturesDir(), file);
}

function writeCache(file: string, entry: CacheEntry): void {
  try {
    fs.mkdirSync(cacheDir(), { recursive: true });
    fs.writeFileSync(path.join(cacheDir(), file), JSON.stringify(entry));
  } catch {
    // cache is best-effort (e.g. read-only filesystem)
  }
}

// Collects metadata about every fetch made inside runWithFetchLog (used by site.ts for stale warnings
// and by scripts/record-fixtures.ts to know which cache files a run touched).
const als = new AsyncLocalStorage<FetchMeta[]>();
export function runWithFetchLog<R>(log: FetchMeta[], fn: () => Promise<R>): Promise<R> {
  return als.run(log, fn);
}

export interface FetchOptions {
  /** Name of the data source for error reporting, e.g. "PLUTO". */
  source?: string;
  mode?: SourceMode;
}

async function liveFetch(url: string): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} from ${new URL(url).host}`);
  return (await res.json()) as unknown;
}

export async function fetchJson<T = unknown>(url: string, opts: FetchOptions = {}): Promise<FetchResult<T>> {
  const mode = opts.mode ?? getSourceMode();
  const file = cacheFileName(url);
  const log = als.getStore();
  const done = (r: FetchResult<T>, staleReason?: string): FetchResult<T> => {
    log?.push({
      url, source: opts.source ?? null, fromCache: r.fromCache, stale: r.stale, fetchedAt: r.fetchedAt,
      cacheFile: file, staleReason,
    });
    return r;
  };
  const fromEntry = (e: CacheEntry, stale: boolean): FetchResult<T> => ({
    body: e.body as T, fetchedAt: e.fetchedAt, url, fromCache: true, stale,
  });

  const cached = mode === "live" ? null : readAnyCache(file);
  if (cached) return done(fromEntry(cached, false));
  if (mode === "offline") {
    throw new Error(`SOURCE_MODE=offline and no cached/fixture response for ${url}`);
  }
  try {
    const body = await liveFetch(url);
    const entry: CacheEntry = { url, fetchedAt: new Date().toISOString(), body };
    writeCache(file, entry);
    return done({ body: body as T, fetchedAt: entry.fetchedAt, url, fromCache: false, stale: false });
  } catch (err) {
    const fallback = readAnyCache(file);
    const reason = err instanceof Error ? err.message : String(err);
    if (fallback) return done(fromEntry(fallback, true), reason);
    throw new Error(`${reason} (${url})`);
  }
}
