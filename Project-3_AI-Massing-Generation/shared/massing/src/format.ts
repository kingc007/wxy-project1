// Display formatters. Raw values are kept in metrics; rounding happens only here (spec §5).
// Locale-independent on purpose so output is deterministic in Node, browsers and workers.

function group(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function clean(n: number): number {
  return Object.is(n, -0) || Math.abs(n) < 1e-12 ? 0 : n;
}

/** Integer with thousands separators. */
export function fmtInt(v: number): string {
  const n = clean(Math.round(v));
  return (n < 0 ? "-" : "") + group(String(Math.abs(n)));
}

/** Area/volume rounded to the nearest 10, thousands separators (no unit). */
export function fmtRound10(v: number): string {
  return fmtInt(Math.round(v / 10) * 10);
}

export function fmtSf(v: number): string {
  return `${fmtRound10(v)} sf`;
}

export function fmtCf(v: number): string {
  return `${fmtRound10(v)} cf`;
}

function fixed(v: number, dp: number): string {
  const n = clean(Number(v.toFixed(dp)));
  const [i, f] = Math.abs(n).toFixed(dp).split(".");
  return (n < 0 ? "-" : "") + group(i) + (f ? "." + f : "");
}

export function fmtFt(v: number): string {
  return `${fixed(v, 1)} ft`;
}

export function fmtFar(v: number): string {
  return fixed(v, 2);
}

export function fmtPct(v: number): string {
  return `${fixed(v, 1)}%`;
}

export function fmtCount(v: number, unit: string): string {
  return `${fmtInt(v)} ${unit}`;
}
