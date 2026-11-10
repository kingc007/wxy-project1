// Export entry point: one function per format plus the response metadata (filename, content type).
import type { SiteData } from "@/lib/types";
import type { ZoningBrief } from "@/lib/zoning/model";
import { toSchemaJson, validateEnvelope } from "@/lib/zoning/envelope";
import { buildMarkdown } from "./markdown";
import { compactDate, type ExportOptions } from "./memo";

export type ExportFormat = "pdf" | "md" | "json";
export const EXPORT_FORMATS: ExportFormat[] = ["pdf", "md", "json"];

export interface ExportResult {
  body: Uint8Array;
  contentType: string;
  filename: string;
  /** json only: whether the envelope validated against the canonical schema */
  envelopeValid?: boolean;
}

export function exportFilename(format: ExportFormat, bbl: string, now: Date): string {
  if (format === "json") return `zoning-envelope-${bbl}.json`;
  return `site-brief-${bbl}-${compactDate(now)}.${format}`;
}

export async function renderExport(format: ExportFormat, site: SiteData, brief: ZoningBrief, opts: ExportOptions = {}): Promise<ExportResult> {
  const now = opts.now ?? new Date();
  const o = { ...opts, now };
  const bbl = site.geocode?.bbl ?? site.pluto?.bbl ?? site.geometry?.bbl ?? "unknown";
  const filename = exportFilename(format, bbl, now);
  const enc = new TextEncoder();
  if (format === "md") {
    return { body: enc.encode(buildMarkdown(site, brief, o)), contentType: "text/markdown; charset=utf-8", filename };
  }
  if (format === "json") {
    const envelope = toSchemaJson(brief.envelope);
    const v = validateEnvelope(envelope);
    return { body: enc.encode(JSON.stringify(envelope, null, 2) + "\n"), contentType: "application/json; charset=utf-8", filename, envelopeValid: v.valid };
  }
  const { buildPdf } = await import("./pdf");
  return { body: new Uint8Array(await buildPdf(site, brief, o)), contentType: "application/pdf", filename };
}
