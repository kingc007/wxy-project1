// POST /api/narrative -> text/event-stream. Body {bbl, intendedUse, programs, overrides}.
// Numbers come from the deterministic engine; the LLM only writes a cited narrative and cross-checks rule IDs.
import { getSiteData } from "@/lib/sources/site";
import { isBbl } from "@/lib/sources/geosearch";
import { computeBrief } from "@/lib/zoning";
import type { IntendedUse } from "@/lib/zoning/model";
import { siteCache } from "@/lib/server/site-cache";
import { formatSse } from "@/lib/brief-client/sse";
import { narrativeEvents } from "@/lib/llm/orchestrate";

export const maxDuration = 120;

const USES: IntendedUse[] = ["residential", "commercial", "community_facility", "manufacturing", "mixed"];

export async function POST(request: Request): Promise<Response> {
  let b: Record<string, unknown> = {};
  try { b = (await request.json()) as Record<string, unknown>; } catch { /* handled below */ }
  const bbl = typeof b.bbl === "string" ? b.bbl.trim() : "";
  if (!isBbl(bbl)) return Response.json({ error: "Body must include a 10-digit bbl." }, { status: 400 });
  const intendedUse = USES.includes(b.intendedUse as IntendedUse) ? (b.intendedUse as IntendedUse) : "residential";
  const programs = Array.isArray(b.programs) ? b.programs.filter((p): p is string => typeof p === "string") : [];
  const overrides: Record<string, string | boolean> = {};
  if (b.overrides && typeof b.overrides === "object") {
    for (const [k, v] of Object.entries(b.overrides as Record<string, unknown>)) if (typeof v === "string" || typeof v === "boolean") overrides[k] = v;
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try { controller.enqueue(enc.encode(formatSse(event, data))); } catch { /* client went away */ }
      };
      try {
        const site = siteCache.get(bbl) ?? (await getSiteData(bbl));
        const brief = computeBrief(site, { intendedUse, programs, overrides });
        for await (const ev of narrativeEvents(site, brief)) send(ev.event, ev.data);
      } catch (e) {
        send("error", { message: e instanceof Error ? e.message.slice(0, 160) : "Narrative failed" });
        send("done", {});
      } finally {
        try { controller.close(); } catch { /* closed */ }
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
