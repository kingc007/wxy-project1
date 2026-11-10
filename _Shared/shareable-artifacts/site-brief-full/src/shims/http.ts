// Browser replacement for app/lib/sources/http.ts (which uses node:fs / node:crypto / AsyncLocalStorage).
// Behaves like SOURCE_MODE=offline: every request is answered from the recorded fixtures bundled in the page
// (app/fixtures/http/*.json, keyed by URL); a URL with no fixture throws the same error offline mode throws.
// No network access is ever attempted.
import { fixtures } from "virtual:fixtures";

export type SourceMode = "live" | "cache-first" | "offline";

export interface FetchResult<T = unknown> {
  body: T;
  fetchedAt: string;
  url: string;
  fromCache: boolean;
  stale: boolean;
}

export interface FetchMeta {
  url: string;
  source: string | null;
  fromCache: boolean;
  stale: boolean;
  fetchedAt: string;
  cacheFile: string;
  staleReason?: string;
}

export const FETCH_TIMEOUT_MS = 10_000;
export const getSourceMode = (): SourceMode => "offline";
export const cacheDir = (): string => "(bundled)/.cache/http";
export const fixturesDir = (): string => "(bundled)/fixtures/http";
/** The recorded file name (sha1(url).json) for a fixture URL; "" when the URL has no fixture. */
export const cacheFileName = (url: string): string => (fixtures as Record<string, { file: string }>)[url]?.file ?? "";

export interface FetchOptions {
  source?: string;
  mode?: SourceMode;
}

let current: FetchMeta[] | undefined;
export function runWithFetchLog<R>(log: FetchMeta[], fn: () => Promise<R>): Promise<R> {
  current = log;
  return fn().finally(() => {
    if (current === log) current = undefined;
  });
}

export async function fetchJson<T = unknown>(url: string, opts: FetchOptions = {}): Promise<FetchResult<T>> {
  const e = (fixtures as Record<string, { fetchedAt: string; body: unknown; file: string }>)[url];
  if (!e) throw new Error(`SOURCE_MODE=offline and no cached/fixture response for ${url}`);
  const r: FetchResult<T> = { body: e.body as T, fetchedAt: e.fetchedAt, url, fromCache: true, stale: false };
  current?.push({ url, source: opts.source ?? null, fromCache: true, stale: false, fetchedAt: e.fetchedAt, cacheFile: e.file });
  return r;
}
