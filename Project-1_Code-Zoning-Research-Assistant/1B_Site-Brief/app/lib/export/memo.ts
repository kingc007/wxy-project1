// Format-neutral memo model shared by the Markdown and PDF exporters. All text is derived from the engine's
// SiteData + ZoningBrief; nothing here invents values. needs_input / manual values never print a number.
import { compactLocalDate, formatLocalDate } from "./dates";
import { COPY } from "@/lib/brief-client/events";
import { citationLabel, fmtValue, lotTypeLabel, showOption } from "@/lib/brief-client/format";
import type { Citation, DataProvenance, PValue, SiteData } from "@/lib/types";
import type { ZoningBrief } from "@/lib/zoning/model";
import manifest from "@/data/zr/manifest.json";

export const SHEET_TITLE = "Zoning Site Brief";
export const DRAFT_STAMP = "DRAFT — for professional review";
export const DISCLAIMER = COPY.disclaimer;

export interface ExportOptions {
  verifiedBy?: string;
  /** injectable for deterministic output; defaults to now */
  now?: Date;
  /** true when the SiteData is synthetic (labels the memo SAMPLE) */
  sample?: boolean;
}

export interface Fact { label: string; value: string; source: string }
export interface MemoCitation { n: number; label: string; section: string; lastAmended: string | null; quote: string; url: string | null; title: string | null }
export interface BulkLine { label: string; value: string; because: string; refs: number[]; unresolved: boolean }
export interface CalcLine { label: string; value: string; formula: string; unresolved: boolean }
export interface AssumptionLine { statement: string; state: string; reason: string }
export interface PortionLine { districts: string; share: string; lines: { label: string; value: string }[] }

export interface Memo {
  title: string;
  site: string;
  bbl: string;
  sheet: string;
  date: string; // yyyy-mm-dd, America/New_York
  drawn: string;
  checked: string;
  sample: boolean;
  plutoVersion: string;
  zrCurrency: string;
  facts: Fact[];
  designations: Fact[];
  bulk: BulkLine[];
  calculations: CalcLine[];
  portions: PortionLine[];
  assumptions: AssumptionLine[];
  flags: { kind: string; message: string; refs: number[] }[];
  citations: MemoCitation[];
  simplifications: string[];
  disclaimer: string;
}

export function zrCurrencyLine(): string {
  return (manifest as { homepageCurrencyLine?: string }).homepageCurrencyLine ?? "ZR currency line not recorded";
}

export function compactDate(d: Date): string {
  return compactLocalDate(d);
}

/** Tag text for a dataset provenance: "PLUTO 26v2 · lotarea · fetched 2026-10-25". */
export function provTag(p: DataProvenance | undefined | null): string {
  if (!p) return "source not recorded";
  const parts = [p.version ? `${p.dataset} ${p.version}` : p.dataset];
  if (p.field) parts.push(p.field);
  parts.push(`fetched ${formatLocalDate(p.fetchedAt)}`);
  return parts.join(" · ");
}

const NEEDS_INPUT = "Needs input";
const MANUAL = "Manual — professional analysis";

/** Display value. Anything not resolved to a number prints a status label, never a figure. */
export function valueText(pv: PValue): { text: string; unresolved: boolean } {
  if (pv.status === "manual") return { text: MANUAL, unresolved: true };
  if (pv.status === "needs_input") return { text: NEEDS_INPUT, unresolved: true };
  if (pv.status === "not_applicable") return { text: "Not applicable", unresolved: true };
  const s = fmtValue(pv);
  if (s === null) return { text: NEEDS_INPUT, unresolved: true };
  return { text: s, unresolved: false };
}

export function citationLine(c: Citation): string {
  const amended = c.lastAmended ? ` (last amended ${c.lastAmended})` : "";
  return `${citationLabel(c)}${amended} — “${c.quote}”`;
}

export function buildMemo(site: SiteData, brief: ZoningBrief, opts: ExportOptions = {}): Memo {
  const now = opts.now ?? new Date();
  const p = site.pluto;
  const bbl = site.geocode?.bbl ?? p?.bbl ?? site.geometry?.bbl ?? "unknown";

  // Footnote registry: one number per distinct citation (section + paragraph + quote).
  const citations: MemoCitation[] = [];
  const index = new Map<string, number>();
  const ref = (c: Citation): number => {
    const key = `${c.section}|${c.paragraph ?? ""}|${c.quote}`;
    let n = index.get(key);
    if (!n) {
      n = citations.length + 1;
      index.set(key, n);
      citations.push({
        n, label: citationLabel(c), section: c.section, lastAmended: c.lastAmended ?? null,
        quote: c.quote, url: c.url, title: c.title ?? null,
      });
    }
    return n;
  };

  const pp = (key: string): string => provTag(p?.provenance[key]);
  const facts: Fact[] = [];
  if (p) {
    const num = (n: number | null, unit: string, digits = 2) =>
      n === null ? NEEDS_INPUT : `${n.toLocaleString("en-US", { maximumFractionDigits: digits })} ${unit}`;
    facts.push({ label: "Address", value: p.address ?? "Not available", source: provTag(p.provenance.address ?? p.provenance.lotArea) });
    facts.push({ label: "Lot area", value: num(p.lotArea, "sf"), source: pp("lotArea") });
    facts.push({ label: "Lot frontage", value: num(p.lotFront, "ft"), source: pp("lotFront") });
    facts.push({ label: "Lot depth", value: num(p.lotDepth, "ft"), source: pp("lotDepth") });
    facts.push({ label: "Lot type", value: lotTypeLabel(p.lotType), source: pp("lotType") });
    facts.push({ label: "Irregular lot", value: p.irrLot === null ? "Not available" : p.irrLot ? "Yes" : "No", source: pp("irrLot") });
  } else {
    facts.push({ label: "PLUTO lot data", value: "Not available", source: "source not recorded" });
  }

  const designations: Fact[] = site.districts.map((d) => ({
    label: d.kind === "base" ? "Base district" : d.kind === "commercial_overlay" ? "Commercial overlay"
      : d.kind === "special_purpose" ? "Special district" : d.kind === "limited_height" ? "Limited height" : "Inclusionary area",
    value: `${d.code}${d.share !== null ? ` (${(d.share * 100).toFixed(1)}% of lot)` : ""}`,
    source: provTag(d.provenance),
  }));
  if (p?.landmark) designations.push({ label: "Landmark (PLUTO)", value: p.landmark, source: pp("landmark") });
  if (p?.histDist) designations.push({ label: "Historic district (PLUTO)", value: p.histDist, source: pp("histDist") });
  if (!designations.length) designations.push({ label: "Districts", value: "None identified", source: "source not recorded" });

  const bulk: BulkLine[] = brief.bulkTable.map((r) => {
    const v = valueText(r.value);
    const cites = r.value.citations ?? [];
    return {
      label: r.label,
      value: v.text,
      because: r.value.appliesBecause ?? r.value.note ?? r.value.formula ?? "—",
      refs: cites.map(ref),
      unresolved: v.unresolved,
    };
  });

  const calculations: CalcLine[] = brief.calculations.map((c) => {
    const v = valueText(c.pvalue);
    return { label: c.label, value: v.text, formula: v.unresolved ? (c.pvalue.note ?? "—") : (c.pvalue.formula ?? "—"), unresolved: v.unresolved };
  });

  const portions: PortionLine[] = brief.splitLot.isSplit
    ? brief.splitLot.portions.map((pt) => ({
        districts: pt.districtCodes.join(" / "),
        share: pt.share === null ? "share not available" : `${(pt.share * 100).toFixed(1)}% of lot`,
        lines: [
          ...Object.entries(pt.controls.maxFar).map(([k, pv]) => ({ label: `Max FAR (${k})`, value: valueText(pv).text })),
          ...pt.calculations.map((c) => ({ label: c.label, value: valueText(c.pvalue).text })),
        ],
      }))
    : [];

  const assumptions: AssumptionLine[] = brief.assumptions.map((a) => ({
    statement: a.statement, state: a.state, reason: `${a.reason} (choices: ${a.options.map(showOption).join(", ")})`,
  }));

  const flags = brief.flags.map((f) => ({ kind: f.kind, message: f.message, refs: (f.citations ?? []).map(ref) }));

  const envFlags = (brief.envelope as { flags?: { sample?: unknown; simplifications?: unknown } }).flags;
  const simplifications = envFlags?.simplifications;
  return {
    title: SHEET_TITLE,
    site: p?.address ?? site.geocode?.label ?? site.query,
    bbl,
    sheet: "Z-101",
    date: formatLocalDate(now),
    drawn: "Site Brief (draft)",
    checked: opts.verifiedBy?.trim() || "—",
    sample: !!opts.sample || envFlags?.sample === true,
    plutoVersion: p?.version ?? "version not recorded",
    zrCurrency: zrCurrencyLine(),
    facts, designations, bulk, calculations, portions, assumptions, flags, citations,
    simplifications: Array.isArray(simplifications) ? simplifications.filter((s): s is string => typeof s === "string") : [],
    disclaimer: DISCLAIMER,
  };
}
