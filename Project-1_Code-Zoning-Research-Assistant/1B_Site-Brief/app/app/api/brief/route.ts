// POST /api/brief -> text/event-stream. Steps are driven by real work: getSiteData's onStep callbacks for
// locate/lot/districts, computeBrief for rules/calculate, and the flag list for review. Overrides reuse the
// in-memory SiteData cache (by BBL) so a recompute is just computeBrief.
import { getSiteData } from "@/lib/sources/site";
import { getSourceMode } from "@/lib/sources/http";
import { isBbl } from "@/lib/sources/geosearch";
import { computeBrief } from "@/lib/zoning";
import type { IntendedUse } from "@/lib/zoning/model";
import { COPY, type BriefRequest, type BriefStepId, type StepEvent } from "@/lib/brief-client/events";
import { siteCache } from "@/lib/server/site-cache";
import { formatSse } from "@/lib/brief-client/sse";

export const maxDuration = 60;

const USES: IntendedUse[] = ["residential", "commercial", "community_facility", "manufacturing", "mixed"];


function parseBody(raw: unknown): BriefRequest | string {
  if (!raw || typeof raw !== "object") return "Request body must be JSON.";
  const b = raw as Record<string, unknown>;
  const query = typeof b.query === "string" ? b.query.trim() : "";
  if (!query) return COPY.geocode("");
  const intendedUse = USES.includes(b.intendedUse as IntendedUse) ? (b.intendedUse as IntendedUse) : "residential";
  const programs = Array.isArray(b.programs) ? b.programs.filter((p): p is string => typeof p === "string") : [];
  const overrides: Record<string, string | boolean> = {};
  if (b.overrides && typeof b.overrides === "object") {
    for (const [k, v] of Object.entries(b.overrides as Record<string, unknown>)) {
      if (typeof v === "string" || typeof v === "boolean") overrides[k] = v;
    }
  }
  return {
    query, intendedUse, programs, overrides,
    bbl: typeof b.bbl === "string" && isBbl(b.bbl) ? b.bbl : undefined,
    verifiedBy: typeof b.verifiedBy === "string" && b.verifiedBy.trim() ? b.verifiedBy.trim().slice(0, 80) : undefined,
  };
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try { body = await request.json(); } catch { body = null; }
  const req = parseBody(body);
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const t0 = performance.now();
      const send = (event: string, data: unknown) => {
        try { controller.enqueue(enc.encode(formatSse(event, data))); } catch { /* client went away */ }
      };
      const stepMs: Partial<Record<BriefStepId, number>> = {};
      const started: Partial<Record<BriefStepId, number>> = {};
      const step = (id: BriefStepId, state: StepEvent["state"], cached = false) => {
        const now = performance.now();
        if (state === "running") { started[id] = now; send("step", { id, state, elapsedMs: 0, cached }); return; }
        const ms = cached ? 0 : Math.round(now - (started[id] ?? now));
        stepMs[id] = ms;
        send("step", { id, state, elapsedMs: ms, ...(cached ? { cached: true } : {}) });
      };
      try {
        if (typeof req === "string") { send("error", { message: req }); return; }
        // Cache lookup: explicit bbl, a raw BBL query, or a query string seen before.
        const bblKey = req.bbl ?? (isBbl(req.query) ? req.query.trim() : siteCache.peekQuery(req.query));
        let site = bblKey ? siteCache.get(bblKey) : undefined;
        if (!bblKey) siteCache.noteMiss();
        const hit = !!site;
        send("meta", {
          llm: !!process.env.ANTHROPIC_API_KEY?.trim(),
          sourceMode: getSourceMode(),
          siteCache: { hit, ...siteCache.stats() },
        });

        if (site) {
          for (const id of ["locate", "lot", "districts"] as const) step(id, "done", true);
        } else {
          site = await getSiteData(req.query, (id, state) => {
            if (state === "running") step(id, "running");
            else step(id, state === "error" ? "error" : "done");
          });
          if (!site.geocode) {
            send("error", { message: COPY.geocode(req.query) });
            return;
          }
          if (!site.pluto && !site.geometry) {
            const src = site.errors[0]?.source ?? "PLUTO";
            send("error", { message: COPY.down(src) });
            return;
          }
          siteCache.set(site.geocode.bbl, site);
          siteCache.setQuery(req.query, site.geocode.bbl);
        }
        send("site", site);

        step("rules", "running");
        const tc = performance.now();
        const brief = computeBrief(site, {
          intendedUse: req.intendedUse, programs: req.programs, overrides: req.overrides, verifiedBy: req.verifiedBy,
        });
        const computeMs = Math.round(performance.now() - tc);
        // computeBrief resolves rules and arithmetic in a single pass; both steps report that one measured time.
        stepMs.rules = computeMs;
        send("step", { id: "rules", state: "done", elapsedMs: computeMs });
        stepMs.calculate = computeMs;
        send("step", { id: "calculate", state: "done", elapsedMs: computeMs });
        step("review", "running");
        const rs = performance.now();
        send("brief", brief);
        const flagged = brief.flags.length > 0 || !brief.validation.valid;
        stepMs.review = Math.round(performance.now() - rs);
        send("step", { id: "review", state: flagged ? "attention" : "done", elapsedMs: stepMs.review });
        send("done", { totalMs: Math.round(performance.now() - t0), stepMs, siteCacheHit: hit, llmCostUsd: 0 });
      } catch (e) {
        send("error", { message: COPY.down(e instanceof Error ? e.message.slice(0, 120) : "the data source") });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
