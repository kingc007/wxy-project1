import type { PValue } from "@/lib/types";
import { formatLocalDate } from "@/lib/export/dates";

/** Display string for a numeric PValue (no provenance logic; null stays null). */
export function fmtValue(pv: Pick<PValue, "value" | "unit">): string | null {
  if (pv.value === null) return null;
  const n = pv.value;
  switch (pv.unit) {
    case "ratio":
      return n.toFixed(2);
    case "percent":
      return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
    case "sf":
      return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} sf`;
    case "ft":
      return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ft`;
    case "stories":
      return `${n.toLocaleString("en-US", { maximumFractionDigits: 1 })} stories`;
    default:
      return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
}

/** On-screen date: yyyy-mm-dd in America/New_York, the same source the PDF and Markdown use (lib/export/dates.ts). */
export function isoDate(iso: string | null | undefined): string {
  return formatLocalDate(iso);
}

/** PLUTO lottype codes as defined in the 26v2 data dictionary (research/test-parcels.md claim 4). */
const LOT_TYPES: Record<number, string> = { 3: "Corner", 4: "Through", 5: "Inside", 6: "Interior lot (no street frontage)" };
export function lotTypeLabel(code: number | null): string {
  if (code === null) return "Not available";
  return LOT_TYPES[code] ? `${code} · ${LOT_TYPES[code]}` : `Code ${code} (see PLUTO data dictionary)`;
}

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export interface Meter {
  /** numerator and denominator in the same unit */
  value: number;
  max: number;
  /** 0..1, clamped */
  fraction: number;
}
export function meter(value: number | null | undefined, max: number | null | undefined): Meter | null {
  if (value === null || value === undefined || max === null || max === undefined || !(max > 0) || value < 0) return null;
  return { value, max, fraction: Math.min(1, value / max) };
}

/** Same-key lookup of a boolean|string assumption value for display. */
export function showOption(v: string | boolean): string {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return v.replace(/_/g, " ");
}

/** Short citation label for a RefTag: "ZR 23-22 ¶b". */
export function citationLabel(c: { source: string; section: string; paragraph?: string | null }): string {
  const src = /zoning resolution/i.test(c.source) ? "ZR" : c.source;
  return `${src} ${c.section}${c.paragraph ? ` ¶${c.paragraph}` : ""}`;
}

export function envelopeFilename(bbl: string | null | undefined): string {
  return `envelope-${bbl ?? "unknown"}.json`;
}
