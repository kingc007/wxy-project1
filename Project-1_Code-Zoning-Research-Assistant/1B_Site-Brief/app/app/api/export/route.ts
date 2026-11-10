// POST /api/export -> file download (pdf | md | json). Reuses the in-memory SiteData cache that /api/brief fills
// (keyed by BBL), so exporting after a brief does no extra network work.
import { getSiteData } from "@/lib/sources/site";
import { isBbl } from "@/lib/sources/geosearch";
import { computeBrief } from "@/lib/zoning";
import type { IntendedUse } from "@/lib/zoning/model";
import { siteCache } from "@/lib/server/site-cache";
import { COPY } from "@/lib/brief-client/events";
import { EXPORT_FORMATS, renderExport, type ExportFormat } from "@/lib/export";

export const maxDuration = 60;

const USES: IntendedUse[] = ["residential", "commercial", "community_facility", "manufacturing", "mixed"];

const bad = (message: string, status = 400) => Response.json({ error: message }, { status });

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try { raw = await request.json(); } catch { return bad("Request body must be JSON."); }
  if (!raw || typeof raw !== "object") return bad("Request body must be JSON.");
  const b = raw as Record<string, unknown>;

  const format = b.format as ExportFormat;
  if (!EXPORT_FORMATS.includes(format)) return bad(`format must be one of ${EXPORT_FORMATS.join(", ")}.`);
  const bblIn = typeof b.bbl === "string" && isBbl(b.bbl) ? b.bbl : undefined;
  const query = typeof b.query === "string" ? b.query.trim() : "";
  if (!bblIn && !query) return bad(COPY.geocode(""));

  const intendedUse = USES.includes(b.intendedUse as IntendedUse) ? (b.intendedUse as IntendedUse) : "residential";
  const programs = Array.isArray(b.programs) ? b.programs.filter((p): p is string => typeof p === "string") : [];
  const overrides: Record<string, string | boolean> = {};
  if (b.overrides && typeof b.overrides === "object") {
    for (const [k, v] of Object.entries(b.overrides as Record<string, unknown>)) if (typeof v === "string" || typeof v === "boolean") overrides[k] = v;
  }
  const verifiedBy = typeof b.verifiedBy === "string" && b.verifiedBy.trim() ? b.verifiedBy.trim().slice(0, 80) : undefined;

  try {
    const key = bblIn ?? (isBbl(query) ? query : siteCache.peekQuery(query));
    let site = key ? siteCache.peek(key) : undefined;
    if (!site) {
      site = await getSiteData(bblIn ?? query);
      if (!site.geocode) return bad(COPY.geocode(query), 404);
      if (!site.pluto && !site.geometry) return bad(COPY.down(site.errors[0]?.source ?? "PLUTO"), 502);
    }
    const brief = computeBrief(site, { intendedUse, programs, overrides, verifiedBy });
    const out = await renderExport(format, site, brief, { verifiedBy });
    const headers: Record<string, string> = {
      "Content-Type": out.contentType,
      "Content-Disposition": `attachment; filename="${out.filename}"`,
      "Cache-Control": "no-store",
    };
    if (out.envelopeValid !== undefined) headers["X-Envelope-Valid"] = String(out.envelopeValid);
    return new Response(out.body as BodyInit, { headers });
  } catch (e) {
    return bad(COPY.down(e instanceof Error ? e.message.slice(0, 120) : "the data source"), 502);
  }
}
