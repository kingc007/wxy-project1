// Pure display helpers for the studio. Numbers come from the engine; this module only formats them.
import { fmtFar, fmtFt, fmtInt, fmtPct, fmtRound10, type ComplianceRow, type MassingOption, type RuleStatus } from "@wxy/massing";

export interface MetricItem {
  id: "far" | "gfa" | "height" | "units" | "open";
  /** Short label, e.g. "FAR". */
  label: string;
  /** Display value, e.g. "3.92 / 4.00". */
  value: string;
  /** Spoken form for screen readers. */
  spoken: string;
}

export function farTotalRow(option: MassingOption): ComplianceRow | null {
  return option.compliance.find((r) => r.id === "far-total") ?? null;
}

/** Max FAR as the compliance checker applied it (null when the envelope has no usable FAR). */
export function maxFarOf(option: MassingOption): number | null {
  return farTotalRow(option)?.allowedValue ?? null;
}

/** Compare-grid metric row: FAR used / max, GFA, height, units est., open space %. */
export function metricRow(option: MassingOption): MetricItem[] {
  const m = option.metrics;
  const max = maxFarOf(option);
  const far = fmtFar(m.far);
  return [
    {
      id: "far",
      label: "FAR",
      value: max === null ? far : `${far} / ${fmtFar(max)}`,
      spoken: max === null ? `FAR ${far}` : `FAR ${far} of ${fmtFar(max)}`,
    },
    { id: "gfa", label: "GFA", value: `${fmtRound10(m.gfa)} sf`, spoken: `GFA ${fmtRound10(m.gfa)} square feet` },
    { id: "height", label: "Height", value: fmtFt(m.height), spoken: `Height ${fmtFt(m.height)}` },
    { id: "units", label: "Units", value: `~${fmtInt(m.unitsEst)}`, spoken: `about ${fmtInt(m.unitsEst)} units` },
    { id: "open", label: "Open space", value: fmtPct(m.openSpacePct), spoken: `Open space ${fmtPct(m.openSpacePct)}` },
  ];
}

export type OverallKind = "pass" | "fail" | "review";
export interface StatusInfo {
  kind: OverallKind;
  /** "Passes all rules" | "Fails 1 rule" | "Fails {k} rules" | "Needs review". */
  label: string;
}
export function overallInfo(option: MassingOption): StatusInfo {
  const { status, failCount, label } = option.overall;
  if (status === "fail" && failCount > 0) {
    return { kind: status, label: `Fails ${failCount} ${failCount === 1 ? "rule" : "rules"}` };
  }
  return { kind: status, label };
}

export const STATUS_WORD: Record<Exclude<RuleStatus, "na">, string> = { pass: "Passes", fail: "Fails", review: "Review" };

/** Live-region text after a parameter edit, e.g. "FAR 3.92 of 4.00, passes. Height 85.0 ft. Passes all rules." */
export function metricsAnnouncement(option: MassingOption): string {
  const far = farTotalRow(option);
  const m = option.metrics;
  const farPart = far
    ? `FAR ${fmtFar(m.far)} of ${fmtFar(far.allowedValue ?? 0)}, ${far.status === "na" ? "not applicable" : STATUS_WORD[far.status].toLowerCase()}`
    : `FAR ${fmtFar(m.far)}`;
  return `${farPart}. Height ${fmtFt(m.height)}. ${option.overall.label}.`;
}

export interface DeltaRow {
  label: string;
  before: string;
  after: string;
  changed: boolean;
}

/** Before/after metric deltas for a proposed change list, computed locally from two engine runs. */
export function deltaRows(before: MassingOption, after: MassingOption): DeltaRow[] {
  const b = metricRow(before);
  const a = metricRow(after);
  const rows: DeltaRow[] = b.map((it, i) => ({ label: it.label, before: it.value, after: a[i].value, changed: it.value !== a[i].value }));
  rows.push({ label: "Zoning", before: before.overall.label, after: after.overall.label, changed: before.overall.label !== after.overall.label });
  return rows;
}

/** "wxy-massing-{envelopeId}-{yyyymmdd}" (no extension). */
export function exportBaseName(envelopeId: string, d: Date): string {
  const y = String(d.getFullYear());
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `wxy-massing-${envelopeId}-${y}${m}${day}`;
}

/** "{h}:{mm} am/pm" from minutes after local midnight. */
export function minutesLabel(min: number): string {
  const h24 = Math.floor(min / 60) % 24;
  const m = min % 60;
  const ap = h24 >= 12 ? "pm" : "am";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function dateLabel(month: number, day: number): string {
  return `${MONTHS[month - 1]} ${day}`;
}

export function fmtHours(h: number): string {
  return h.toFixed(1);
}

/** Param value for display next to a control. */
export function paramValueLabel(v: number | string | boolean, unit: string): string {
  if (typeof v === "boolean") return v ? "On" : "Off";
  if (typeof v === "string") return v;
  const s = Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2)));
  return unit && unit !== "count" && unit !== "ratio" && unit !== "0-1" && unit !== "-1 to 1" && unit !== "deg" && unit !== "floor" && unit !== "floors" && unit !== "% of lot" ? `${s} ${unit}` : s;
}

/** Local time label "14:32" for history entries; called from event handlers, never during render. */
export function timeLabel(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "Option 3, Stepped terraces, FAR 3.92 of 4.00, needs review" for the live region on selection. */
export function selectionAnnouncement(index: number, name: string, option: MassingOption): string {
  const far = metricRow(option)[0].spoken;
  return `Option ${index + 1}, ${name}, ${far}, ${option.overall.label.charAt(0).toLowerCase()}${option.overall.label.slice(1)}`;
}

/** "6 options ready: 4 pass, 1 need review, 1 fail". */
export function generationAnnouncement(options: MassingOption[]): string {
  const n = (k: OverallKind) => options.filter((o) => o.overall.status === k).length;
  return `${options.length} options ready: ${n("pass")} pass, ${n("review")} need review, ${n("fail")} fail`;
}

/** Per-use FAR text, never an unlabeled max: "Residential FAR 6.02, CF 6.50". */
export function farSummary(maxFar: Record<string, number>): string {
  const SHORT: Record<string, string> = { residential: "Residential", commercial: "Commercial", community_facility: "CF" };
  const parts = Object.entries(maxFar).map(([k, v], i) => `${SHORT[k] ?? k}${i === 0 ? " FAR" : ""} ${fmtFar(v)}`);
  return parts.length ? parts.join(", ") : "FAR not set";
}

/** Appends a non-breaking space when `next` equals `prev`, so a live region re-announces identical text. */
export function freshAnnouncement(prev: string, next: string): string {
  return next === prev ? `${next}\u00a0` : next;
}

/** User-facing wording for server notices that mention plumbing (API keys, env files). Detail lives in the usage drawer. */
export function plainNotice(message: string): string {
  return /ANTHROPIC_API_KEY|API key|\.env/i.test(message) ? "Built-in strategies were used." : message;
}
