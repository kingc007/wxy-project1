// Grounding check (spec §7): every number in AI prose must equal a computed / parameter / envelope value.
// Pure and deterministic. The UI never shows ungrounded text.
import type { MassingOption, Metrics } from "./types";

export interface AllowedNumber {
  label: string;
  value: number;
  /** Display rounding of the value: 2 → 0.01, 1 → 0.1, 0 → integer, -1 → nearest 10. */
  decimals: number;
}

export interface ExtractedNumber {
  /** Text as written, e.g. "1,234", "45%", "2nd". */
  raw: string;
  /** Absolute numeric value (sign ignored: "down 5%" matches 5 or -5). */
  value: number;
  index: number;
  kind: "plain" | "percent" | "ordinal";
}

export interface GroundingResult {
  ok: boolean;
  /** Raw text of each number with no matching allowed value. */
  unmatched: string[];
  matched: { raw: string; label: string }[];
}

export interface GroundingOptions {
  /** Literal substrings removed before extraction (district codes like "R6A", "Jun 21", option names). */
  ignoreTokens?: string[];
}

const NUM_RE = /(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(%|st\b|nd\b|rd\b|th\b)?/g;

/**
 * Extract numbers from prose. Handles 1,234 · 12.5 · 45% · 3.00 · "6 floors" · ordinals (2nd).
 * Digits glued to a preceding letter (R6A, C2-4 style codes, B2) are not numbers and are skipped.
 */
export function extractNumbers(text: string): ExtractedNumber[] {
  const out: ExtractedNumber[] = [];
  for (const m of text.matchAll(NUM_RE)) {
    const index = m.index ?? 0;
    const prev = index > 0 ? text[index - 1] : "";
    if (/[A-Za-z]/.test(prev)) continue;
    // also skip the tail of a decimal we already consumed (e.g. ".5" never starts a match since \d is required first)
    const intPart = m[1].replace(/,/g, "");
    const value = Number(intPart + (m[2] ?? ""));
    const suffix = m[3];
    const kind: ExtractedNumber["kind"] = suffix === "%" ? "percent" : suffix ? "ordinal" : "plain";
    out.push({ raw: m[0], value, index, kind });
  }
  return out;
}

function roundTo(v: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

/** A number matches if it equals the allowed value at that value's display rounding, or is within 0.5 % relative. */
export function numberMatches(n: number, a: AllowedNumber): boolean {
  const v = Math.abs(a.value);
  if (Math.abs(roundTo(v, a.decimals) - n) < 1e-9) return true;
  if (Math.abs(n - v) <= 0.005 * v) return true;
  return false;
}

export function checkGrounding(text: string, allowed: AllowedNumber[], opts: GroundingOptions = {}): GroundingResult {
  let t = text;
  for (const tok of opts.ignoreTokens ?? []) if (tok) t = t.split(tok).join(" ".repeat(tok.length));
  const unmatched: string[] = [];
  const matched: { raw: string; label: string }[] = [];
  for (const n of extractNumbers(t)) {
    const hit = allowed.find((a) => numberMatches(n.value, a));
    if (hit) matched.push({ raw: n.raw, label: hit.label });
    else unmatched.push(n.raw);
  }
  return { ok: unmatched.length === 0, unmatched, matched };
}

// ---------- allowed list from a computed option ----------
const METRIC_DECIMALS: Record<Exclude<keyof Metrics, "gfaByProgram" | "farByProgram" | "courtyardSunHours">, number> = {
  lotArea: -1,
  gfa: -1,
  zfa: -1,
  far: 2,
  floors: 0,
  height: 1,
  footprint: -1,
  lotCoveragePct: 1,
  openSpacePct: 1,
  facadeArea: -1,
  facadePerGfa: 2,
  volume: -1,
  compactness: 2,
  unitsEst: 0,
  streetWallHeight: 1,
  trimmedVolume: -1,
};

export function allowedNumbersFromOption(option: MassingOption, extra: AllowedNumber[] = []): AllowedNumber[] {
  const out: AllowedNumber[] = [];
  const add = (label: string, value: number | null | undefined, decimals: number) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return;
    out.push({ label, value, decimals });
  };
  const m = option.metrics;
  for (const [k, d] of Object.entries(METRIC_DECIMALS)) add(`metrics.${k}`, m[k as keyof typeof METRIC_DECIMALS], d);
  for (const [use, v] of Object.entries(m.gfaByProgram)) add(`metrics.gfaByProgram.${use}`, v, -1);
  for (const [use, v] of Object.entries(m.farByProgram)) add(`metrics.farByProgram.${use}`, v, 2);
  add("metrics.courtyardSunHours", m.courtyardSunHours, 1);

  for (const [k, v] of Object.entries(option.params)) {
    if (typeof v === "number") add(`params.${k}`, v, Number.isInteger(v) ? 0 : 2);
  }
  // floor indices (1-based) so "the 2nd floor" / "floors 4–7" are grounded in the actual floor count
  for (let i = 1; i <= option.metrics.floors; i++) add("floor index", i, 0);

  for (const row of option.compliance) {
    add(`compliance.${row.id}.allowed`, row.allowedValue, 2);
    add(`compliance.${row.id}.proposed`, row.proposedValue, 2);
  }
  for (const r of option.programFit) {
    add(`programFit.${r.use}.target`, r.target, r.use === "units" ? 0 : -1);
    add(`programFit.${r.use}.proposed`, r.proposed, r.use === "units" ? 0 : -1);
    add(`programFit.${r.use}.deltaPct`, r.deltaPct, 1);
  }
  out.push(...extra);

  const seen = new Set<string>();
  return out.filter((a) => {
    const key = `${a.label}|${a.value}|${a.decimals}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
