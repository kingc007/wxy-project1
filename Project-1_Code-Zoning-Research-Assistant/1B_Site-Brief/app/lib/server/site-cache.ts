// Process-wide SiteData cache shared by /api/brief, /api/narrative and /api/export. It lives on globalThis so
// every route bundle (and dev-server hot reloads) sees the same instance.
import type { SiteData } from "@/lib/types";
import { Lru } from "@/lib/brief-client/lru";

interface Caches { sites: Lru<SiteData>; queryToBbl: Lru<string> }
const g = globalThis as unknown as { __briefCaches?: Caches };
const caches: Caches = (g.__briefCaches ??= {
  sites: new Lru<SiteData>(24, 30 * 60_000),
  queryToBbl: new Lru<string>(200, 30 * 60_000),
});

/** Normalised key for a free-text query. */
export const queryKey = (q: string): string => q.trim().toLowerCase().replace(/\s+/g, " ");

export const siteCache = {
  /** Lookup by BBL; counts a hit or a miss and refreshes recency. */
  get: (bbl: string): SiteData | undefined => caches.sites.get(bbl),
  /** Lookup by BBL without touching counters or recency. */
  peek: (bbl: string): SiteData | undefined => caches.sites.peek(bbl),
  set: (bbl: string, site: SiteData): void => caches.sites.set(bbl, site),
  /** BBL previously resolved for a query string (no counters). */
  peekQuery: (query: string): string | undefined => caches.queryToBbl.peek(queryKey(query)),
  setQuery: (query: string, bbl: string): void => caches.queryToBbl.set(queryKey(query), bbl),
  /** Record a miss for a request that had no key to look up. */
  noteMiss: (): void => {
    caches.sites.misses++;
  },
  stats: (): { hits: number; misses: number; size: number } => ({
    hits: caches.sites.hits,
    misses: caches.sites.misses,
    size: caches.sites.size,
  }),
};
