import type { Citation, Confidence, PValue, Unit } from "../types";

export function fmtNum(n: number, maxDec = 2): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: maxDec });
}
export function fmtFar(n: number): string {
  return n.toFixed(2);
}
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function fieldUnit(field: string): Unit {
  if (field.startsWith("maxFar") || field === "sep.slope") return "ratio";
  if (field.startsWith("lotCoverage")) return "percent";
  return "ft";
}

export function needsInput(unit: Unit, note: string, extra: Partial<PValue> = {}): PValue {
  return { value: null, unit, status: "needs_input", confidence: "unverified", note, ...extra };
}
export function notApplicable(unit: Unit, note: string): PValue {
  return { value: null, unit, status: "not_applicable", confidence: "cited", note };
}
export function manualValue(unit: Unit, note: string, extra: Partial<PValue> = {}): PValue {
  return { value: null, unit, status: "manual", confidence: "conflicting", note, ...extra };
}

const ORDER: Confidence[] = ["cited", "inferred", "unverified", "conflicting"];
/** Weakest confidence wins. */
export function combineConfidence(cs: Confidence[]): Confidence {
  let worst = 0;
  for (const c of cs) worst = Math.max(worst, ORDER.indexOf(c));
  return ORDER[worst];
}

export function dedupeCitations(cs: Citation[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const c of cs) {
    const k = `${c.section}|${c.paragraph ?? ""}|${c.quote}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(c);
    }
  }
  return out;
}

export function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

/** Copy of a PValue used as a reference elsewhere (e.g. a plane's startHeight), with an extra note. */
export function cloneRef(pv: PValue, extraNote?: string): PValue {
  const note = [pv.note, extraNote].filter(Boolean).join(" ") || null;
  return { ...pv, note, citations: pv.citations ? [...pv.citations] : undefined };
}
