// In-browser replacement for the Next.js server: same-origin /api/* fetches are answered by calling the app's real
// route handlers (app/app/api/*/route.ts) directly. Everything else goes to the real fetch.
import { lots } from "virtual:lots";
import * as brief from "@/app/api/brief/route";
import * as clause from "@/app/api/clause/route";
import * as exportRoute from "@/app/api/export/route";
import * as narrative from "@/app/api/narrative/route";
import * as site from "@/app/api/site/route";
import * as uses from "@/app/api/uses/route";

export interface Lot { bbl: string; address: string; query: string; category: string; label: string }
export const PRELOADED: Lot[] = lots;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const BASE = "http://artifact.local";

/** Exact (normalised) match of a typed/selected string or BBL to a preloaded lot. */
export function matchLot(q: string): Lot | undefined {
  const t = q.trim();
  if (/^[1-5]\d{9}$/.test(t)) return PRELOADED.find((l) => l.bbl === t);
  const n = norm(t);
  if (!n) return undefined;
  return PRELOADED.find((l) => [l.query, l.label, l.address].some((c) => norm(c) === n));
}

function suggest(q: string): { label: string; bbl: string }[] {
  const n = norm(q);
  const tokens = n.split(" ").filter(Boolean);
  if (!tokens.length) return [];
  return PRELOADED.filter((l) => {
    const hay = norm(`${l.label} ${l.address} ${l.query}`);
    return l.bbl.startsWith(q.trim()) || tokens.every((t) => hay.includes(t));
  }).map((l) => ({ label: l.label, bbl: l.bbl }));
}

type Handler = (r: Request) => Response | Promise<Response>;
const POST: Record<string, Handler> = {
  "/api/brief": brief.POST,
  "/api/narrative": narrative.POST,
  "/api/export": exportRoute.POST,
};
const GET: Record<string, Handler> = {
  "/api/clause": clause.GET,
  "/api/uses": uses.GET,
  "/api/site": site.GET,
};

/** Selected suggestions arrive as a BBL; typed text that exactly names a preloaded lot is canonicalised to the
 *  recorded GeoSearch query so the brief goes through the same path as the eval harness. */
async function canonicalise(req: Request, url: URL): Promise<Request> {
  let body: Record<string, unknown>;
  try { body = (await req.clone().json()) as Record<string, unknown>; } catch { return req; }
  const q = typeof body.query === "string" ? body.query : "";
  const lot = q ? matchLot(q) : undefined;
  if (lot && lot.query !== q) body = { ...body, query: lot.query, bbl: typeof body.bbl === "string" ? body.bbl : lot.bbl };
  else return req;
  return new Request(url, { method: "POST", headers: req.headers, body: JSON.stringify(body), signal: req.signal });
}

function abortable(res: Response, signal: AbortSignal | null | undefined): Response {
  if (!signal || !res.body) return res;
  const reader = res.body.getReader();
  const abortErr = () => new DOMException("The operation was aborted.", "AbortError");
  let ctl!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      ctl = c;
      signal.addEventListener("abort", () => { reader.cancel().catch(() => {}); try { c.error(abortErr()); } catch { /* closed */ } }, { once: true });
    },
    async pull(c) {
      const { done, value } = await reader.read();
      if (done) c.close(); else c.enqueue(value);
    },
    cancel: (r) => reader.cancel(r),
  });
  void ctl;
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

export function installApi(): void {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    let path: string | null = null;
    if (raw.startsWith("/api/")) path = raw;
    else {
      try {
        const u = new URL(raw);
        if ((u.origin === window.location.origin && window.location.origin !== "null") && u.pathname.startsWith("/api/")) path = u.pathname + u.search;
      } catch { /* not absolute */ }
    }
    if (path === null) return realFetch(input as RequestInfo, init);

    const url = new URL(path, BASE);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
    const reqInit: RequestInit = { method, headers: init?.headers ?? (input instanceof Request ? input.headers : undefined), signal: signal ?? undefined };
    if (method !== "GET" && method !== "HEAD") reqInit.body = init?.body ?? (input instanceof Request ? await input.clone().text() : undefined);
    let req = new Request(url, reqInit);

    if (url.pathname === "/api/geocode" && method === "GET") {
      return Response.json({ results: suggest(url.searchParams.get("q") ?? "") });
    }
    const handler = method === "POST" ? POST[url.pathname] : GET[url.pathname];
    if (!handler) return Response.json({ error: `No such endpoint in the shareable build: ${url.pathname}` }, { status: 404 });
    if (method === "POST" && url.pathname !== "/api/narrative") req = await canonicalise(req, url);
    return abortable(await handler(req), signal);
  };
}
