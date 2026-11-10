/* Eval harness for the 1B Site Brief engine.
 *
 * Run: `npm run eval` (= `SOURCE_MODE=offline tsx scripts/eval.ts`).
 * For each parcel in evals/gold.json (manager-written, read-only here): getSiteData(bbl) -> computeBrief(...),
 * then compares the brief against the gold expectations, checks provenance completeness and envelope validity.
 * Prints a console summary, writes evals/report.md, and always exits 0 (it is a report, not a gate).
 */
import fs from "node:fs";
import path from "node:path";
import { getSiteData } from "@/lib/sources/site";
import { checkProvenance, computeBrief } from "@/lib/zoning";
import type { ZoningBrief } from "@/lib/zoning";
import type { PValue, SiteData } from "@/lib/types";

// Evals are always offline (recorded fixtures / cache only). http.ts reads SOURCE_MODE per request, so this is
// effective for every fetch made below.
process.env.SOURCE_MODE = "offline";

const TOL = 0.01;
const APP_ROOT = process.cwd();
const GOLD_PATH = path.join(APP_ROOT, "evals", "gold.json");
const REPORT_PATH = path.join(APP_ROOT, "evals", "report.md");
const ASSUMPTION_KEYS = ["intendedUse", "program", "buildingType", "siteCategory"] as const;

interface GoldParcel {
  bbl: string;
  address: string;
  query: string;
  category: string;
  assumptions: Record<string, string>;
  expect: Record<string, unknown>;
  expectFlags: string[];
  sources: Record<string, string>;
  conditional: string | null;
  notes: string | null;
}

interface GoldFile {
  description: string;
  written: string;
  assumptionsUsed: Record<string, string>;
  parcels: GoldParcel[];
}

interface FieldResult {
  field: string;
  expected: unknown;
  actual: string;
  status: string | null;
  note: string | null;
  pass: boolean;
  expectNull: boolean;
  hallucinated: boolean;
  reason: string;
}

interface ProvOffender {
  path: string;
  status: string;
  value: number;
}

interface ParcelResult {
  bbl: string;
  address: string;
  category: string;
  conditional: string | null;
  notes: string | null;
  expectFlags: string[];
  error: string | null;
  fields: FieldResult[];
  flagsMissing: string[];
  flagsUnexpected: string[];
  flagIssues: string[];
  numericTotal: number;
  numericCovered: number;
  provOffenders: ProvOffender[];
  checkProvIssues: string[];
  valid: boolean;
  validationErrors: string[];
  ms: number;
}

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

function isPValue(x: unknown): x is PValue {
  return !!x && typeof x === "object" && !Array.isArray(x) && "value" in x && "unit" in x && "status" in x;
}

function getPath(obj: unknown, dotted: string): unknown {
  let cur: unknown = obj;
  for (const k of dotted.split(".")) {
    if (cur === null || typeof cur !== "object" || !(k in (cur as object))) return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function show(x: unknown): string {
  if (x === undefined) return "undefined";
  if (x === null) return "null";
  if (typeof x === "number") return String(x);
  return JSON.stringify(x);
}

/** Resolves the brief value compared against a gold `expect` key. Returns undefined when the path does not exist. */
function resolveActual(field: string, site: SiteData, brief: ZoningBrief): unknown {
  if (field === "zoneDist") return site.pluto ? site.pluto.zoneDist : undefined;
  if (field === "lotArea") return getPath(brief.envelope, "lot.area");
  if (field === "lotType") return brief.assumptions.find((a) => (a.key as string) === "lotType")?.value;
  if (field === "split") return brief.splitLot.isSplit;
  return getPath(brief.controls, field);
}

function compareField(field: string, expected: unknown, raw: unknown): FieldResult {
  const expectNull = expected === null;
  const found = raw !== undefined;
  const actual = isPValue(raw) ? raw.value : raw;
  const status = isPValue(raw) ? raw.status : null;
  const note = isPValue(raw) ? (raw.note ?? null) : null;
  let pass = false;
  let hallucinated = false;
  let reason = "";
  if (!found) {
    reason = "path not found in brief (or no PLUTO record)";
  } else if (expectNull) {
    if (actual === null || actual === undefined) pass = true;
    else if (typeof actual === "number") {
      hallucinated = true;
      reason = "hallucinated value: a number where null is required";
    } else reason = `expected null, got ${show(actual)}`;
  } else if (typeof expected === "number") {
    if (typeof actual !== "number") reason = `expected ${expected}, got ${show(actual)}`;
    else if (Math.abs(actual - expected) <= TOL) pass = true;
    else reason = `expected ${expected}, got ${actual} (diff ${(actual - expected).toFixed(4)})`;
  } else {
    pass = JSON.stringify(actual) === JSON.stringify(expected);
    if (!pass) reason = `expected ${show(expected)}, got ${show(actual)}`;
  }
  if (!pass && found && !reason) reason = "mismatch";
  return {
    field,
    expected,
    actual: show(actual),
    status,
    note,
    pass,
    expectNull,
    hallucinated,
    reason,
  };
}

interface NumericRef {
  path: string;
  pv: PValue;
}

/** Collects non-null numeric PValues (objects with value/unit/status keys) under a node. */
function collectNumeric(node: unknown, p: string, out: NumericRef[]): void {
  if (Array.isArray(node)) {
    node.forEach((n, i) => collectNumeric(n, `${p}[${i}]`, out));
    return;
  }
  if (!node || typeof node !== "object") return;
  if (isPValue(node) && typeof node.value === "number") out.push({ path: p, pv: node });
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (v && typeof v === "object") collectNumeric(v, p ? `${p}.${k}` : k, out);
  }
}

/** A numeric value is supported when it has citations, provenance, or is computed with formula + inputs. */
function isSupported(pv: PValue): boolean {
  const o = pv as unknown as Record<string, unknown>;
  if (Array.isArray(o.citations) && o.citations.length > 0) return true;
  if (Array.isArray(o.provenance) && o.provenance.length > 0) return true;
  return o.status === "computed" && typeof o.formula === "string" && o.formula.length > 0 &&
    Array.isArray(o.inputs) && o.inputs.length > 0;
}

function evaluateParcel(p: GoldParcel, site: SiteData | null, brief: ZoningBrief | null, error: string | null, ms: number): ParcelResult {
  const base: ParcelResult = {
    bbl: p.bbl, address: p.address, category: p.category, conditional: p.conditional, notes: p.notes,
    expectFlags: p.expectFlags, error, fields: [], flagsMissing: [], flagsUnexpected: [], flagIssues: [],
    numericTotal: 0, numericCovered: 0, provOffenders: [], checkProvIssues: [], valid: false, validationErrors: [], ms,
  };
  if (!site || !brief) {
    base.fields = Object.keys(p.expect).map((field) => ({
      field, expected: p.expect[field], actual: "n/a", status: null, note: null, pass: false,
      expectNull: p.expect[field] === null, hallucinated: false, reason: `harness error: ${error ?? "unknown"}`,
    }));
    base.flagsMissing = [...p.expectFlags];
    return base;
  }

  // 1. field comparisons
  base.fields = Object.keys(p.expect).map((field) => compareField(field, p.expect[field], resolveActual(field, site, brief)));

  // 2. flags (missing expected kinds fail; unexpected kinds are info only)
  const kinds = brief.flags.map((f) => f.kind as string);
  base.flagsMissing = p.expectFlags.filter((k) => !kinds.includes(k));
  base.flagsUnexpected = [...new Set(kinds.filter((k) => !p.expectFlags.includes(k)))];

  // 3. special-district rule: compared controls on an HY-type lot must not be "cited"
  if (p.expectFlags.includes("special_district")) {
    for (const field of Object.keys(p.expect)) {
      const raw = getPath(brief.controls, field);
      if (isPValue(raw) && raw.confidence === "cited") {
        base.flagIssues.push(`confidence too high: ${field} is "cited" on a special-district lot`);
      }
    }
  }

  // 4. assumption sanity (gold assumptions must equal what the engine derives with no overrides)
  for (const key of ASSUMPTION_KEYS) {
    const expected = p.assumptions?.[key];
    if (expected === undefined) continue;
    const actual = brief.assumptions.find((a) => (a.key as string) === key)?.value;
    if (actual !== expected) base.flagIssues.push(`assumption ${key}: expected ${expected}, got ${show(actual)}`);
  }

  // 5. provenance completeness over controls + calculations + envelope
  const refs: NumericRef[] = [];
  collectNumeric(brief.controls, "controls", refs);
  collectNumeric(brief.calculations, "calculations", refs);
  collectNumeric(brief.envelope, "envelope", refs);
  base.numericTotal = refs.length;
  for (const r of refs) {
    if (isSupported(r.pv)) base.numericCovered += 1;
    else base.provOffenders.push({ path: r.path, status: r.pv.status, value: r.pv.value as number });
  }

  // 6. checkProvenance + envelope schema validity
  base.checkProvIssues = checkProvenance(brief.envelope);
  base.valid = brief.validation.valid;
  base.validationErrors = brief.validation.errors;
  return base;
}

async function runParcel(p: GoldParcel): Promise<ParcelResult> {
  const t0 = performance.now();
  let site: SiteData | null = null;
  let brief: ZoningBrief | null = null;
  let error: string | null = null;
  try {
    site = await getSiteData(p.bbl);
    // Gold assumptions are the engine defaults (buildingType attached, siteCategory standard, program standard),
    // so no overrides are passed; evaluateParcel flags any mismatch.
    brief = computeBrief(site, { intendedUse: "residential", programs: [] });
  } catch (e) {
    error = msg(e);
  }
  const ms = Math.round(performance.now() - t0);
  return evaluateParcel(p, site, brief, error, ms);
}

function pct(n: number, d: number): string {
  return d === 0 ? "n/a" : `${((n / d) * 100).toFixed(1)}%`;
}

function parcelLabel(r: ParcelResult): string {
  return `${r.bbl} ${r.address}`;
}

function failLines(r: ParcelResult): string[] {
  const out: string[] = [];
  const lab = `[${parcelLabel(r)}]`;
  if (r.error) out.push(`FAIL ${lab} harness error: ${r.error}`);
  for (const f of r.fields) {
    if (f.pass) continue;
    const extra = [f.status ? `status=${f.status}` : null, f.note ? `note: ${f.note}` : null].filter(Boolean).join(", ");
    const tag = f.hallucinated ? "hallucinated value" : "field";
    out.push(`FAIL ${lab} ${f.field} (${tag}): expected ${show(f.expected)}, actual ${f.actual}${extra ? ` [${extra}]` : ""} — ${f.reason}`);
  }
  for (const k of r.flagsMissing) out.push(`FAIL ${lab} missing expected flag: ${k}`);
  for (const i of r.flagIssues) out.push(`FAIL ${lab} ${i}`);
  if (r.numericTotal > 0 && r.numericCovered < r.numericTotal) {
    out.push(`FAIL ${lab} provenance ${r.numericCovered}/${r.numericTotal}: ${r.provOffenders.map((o) => `${o.path} (${o.status})`).join(", ")}`);
  }
  for (const c of r.checkProvIssues) out.push(`FAIL ${lab} checkProvenance: ${c}`);
  if (!r.valid) out.push(`FAIL ${lab} envelope invalid: ${r.validationErrors.join("; ")}`);
  return out;
}

function parcelOk(r: ParcelResult): boolean {
  return failLines(r).length === 0;
}

function flagsCell(r: ParcelResult): string {
  return r.flagsMissing.length === 0 && r.flagIssues.length === 0 && !r.error ? "ok" : "FAIL";
}

function printTable(results: ParcelResult[]): void {
  const headers = ["parcel", "category", "fields", "flags", "prov%", "valid", "ms"];
  const rows = results.map((r) => [
    parcelLabel(r),
    r.category,
    `${r.fields.filter((f) => f.pass).length}/${r.fields.length}`,
    flagsCell(r),
    pct(r.numericCovered, r.numericTotal),
    r.valid ? "yes" : "no",
    String(r.ms),
  ]);
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join("  ");
  console.log(line(headers));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  rows.forEach((row) => console.log(line(row)));
}

function totals(results: ParcelResult[]) {
  const allFields = results.flatMap((r) => r.fields);
  const nullFields = allFields.filter((f) => f.expectNull);
  return {
    fieldsPass: allFields.filter((f) => f.pass).length,
    fieldsTotal: allFields.length,
    nullPass: nullFields.filter((f) => f.pass).length,
    nullTotal: nullFields.length,
    hallucinated: allFields.filter((f) => f.hallucinated).length,
    provCovered: results.reduce((a, r) => a + r.numericCovered, 0),
    provTotal: results.reduce((a, r) => a + r.numericTotal, 0),
    validCount: results.filter((r) => r.valid && !r.error).length,
    errorCount: results.filter((r) => r.error).length,
    checkProvIssues: results.reduce((a, r) => a + r.checkProvIssues.length, 0),
    failParcels: results.filter((r) => !parcelOk(r)).length,
  };
}

function mdCell(x: unknown): string {
  return String(x ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function mdTable(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.map(mdCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(mdCell).join(" | ")} |`),
  ].join("\n");
}

function writeReport(gold: GoldFile, results: ParcelResult[], t: ReturnType<typeof totals>): void {
  const out: string[] = [];
  out.push("# 1B Site Brief — eval report");
  out.push("");
  out.push(`Generated: ${new Date().toISOString()} by \`scripts/eval.ts\` (SOURCE_MODE=offline).`);
  out.push(`Gold: \`evals/gold.json\` (written ${gold.written}; manager-written from verified research only).`);
  out.push("");
  out.push("## Totals");
  out.push("");
  out.push(mdTable(["metric", "result"], [
    ["Field-level accuracy", `${t.fieldsPass}/${t.fieldsTotal} (${pct(t.fieldsPass, t.fieldsTotal)})`],
    ["Null-correctness", `${t.nullPass}/${t.nullTotal} expected-null fields correct; ${t.hallucinated} hallucinated value(s)`],
    ["Provenance completeness (target 100%)", `${t.provCovered}/${t.provTotal} (${pct(t.provCovered, t.provTotal)})`],
    ["checkProvenance issues", String(t.checkProvIssues)],
    ["Envelopes valid", `${t.validCount}/${results.length}${t.validCount === results.length ? " (all valid)" : ""}`],
    ["Parcels with harness errors", String(t.errorCount)],
    ["Parcels with any FAIL", `${t.failParcels}/${results.length}`],
  ]));
  out.push("");
  out.push("## Per parcel");
  out.push("");
  out.push(mdTable(
    ["parcel", "category", "fields", "flags", "provenance", "valid", "ms"],
    results.map((r) => [
      parcelLabel(r), r.category, `${r.fields.filter((f) => f.pass).length}/${r.fields.length}`,
      flagsCell(r), `${pct(r.numericCovered, r.numericTotal)} (${r.numericCovered}/${r.numericTotal})`,
      r.valid ? "yes" : "no", String(r.ms),
    ]),
  ));
  out.push("");
  out.push("## Failing fields");
  out.push("");
  const failingFields = results.flatMap((r) => r.fields.filter((f) => !f.pass).map((f) => ({ r, f })));
  if (failingFields.length === 0) out.push("None.");
  else {
    out.push(mdTable(
      ["parcel", "field", "expected", "actual", "status", "note / reason"],
      failingFields.map(({ r, f }) => [
        parcelLabel(r), f.field, show(f.expected), f.actual, f.status ?? "—",
        [f.reason, f.note].filter(Boolean).join(" — "),
      ]),
    ));
  }
  out.push("");
  out.push("## Flags, assumptions and special-district checks");
  out.push("");
  const flagRows = results.flatMap((r) => [
    ...r.flagsMissing.map((k) => [parcelLabel(r), "missing expected flag", k]),
    ...r.flagIssues.map((i) => [parcelLabel(r), "check", i]),
    ...(r.flagsUnexpected.length ? [[parcelLabel(r), "unexpected flags (info)", r.flagsUnexpected.join(", ")]] : []),
  ]);
  out.push(flagRows.length ? mdTable(["parcel", "kind", "detail"], flagRows) : "None.");
  out.push("");
  out.push("## Provenance offenders");
  out.push("");
  const offenderRows = results.flatMap((r) => r.provOffenders.map((o) => [parcelLabel(r), o.path, o.status, String(o.value)]));
  out.push(offenderRows.length ? mdTable(["parcel", "path", "status", "value"], offenderRows) : "None.");
  out.push("");
  out.push("## checkProvenance (envelope) issues");
  out.push("");
  const cpRows = results.flatMap((r) => r.checkProvIssues.map((c) => [parcelLabel(r), c]));
  out.push(cpRows.length ? mdTable(["parcel", "issue"], cpRows) : "None.");
  out.push("");
  out.push("## Gold conditional notes");
  out.push("");
  for (const r of results) {
    out.push(`- **${parcelLabel(r)}** (${r.category}): ${r.conditional ?? "no conditional"}`);
    if (r.notes) out.push(`  - gold notes: ${r.notes}`);
  }
  out.push("");
  fs.writeFileSync(REPORT_PATH, out.join("\n"));
}

async function main(): Promise<void> {
  const gold = JSON.parse(fs.readFileSync(GOLD_PATH, "utf8")) as GoldFile;
  const results: ParcelResult[] = [];
  for (const p of gold.parcels) {
    results.push(await runParcel(p));
  }

  console.log(`1B Site Brief eval — ${results.length} parcels (SOURCE_MODE=offline, gold written ${gold.written})`);
  console.log("");
  printTable(results);
  console.log("");
  const fails = results.flatMap(failLines);
  if (fails.length === 0) console.log("No FAIL lines.");
  else fails.forEach((l) => console.log(l));
  console.log("");

  const t = totals(results);
  console.log("Totals");
  console.log(`  Field-level accuracy:       ${t.fieldsPass}/${t.fieldsTotal} (${pct(t.fieldsPass, t.fieldsTotal)})`);
  console.log(`  Null-correctness:           ${t.nullPass}/${t.nullTotal} expected-null correct; ${t.hallucinated} hallucinated value(s)`);
  console.log(`  Provenance completeness:    ${t.provCovered}/${t.provTotal} (${pct(t.provCovered, t.provTotal)}) [target 100%]`);
  console.log(`  checkProvenance issues:     ${t.checkProvIssues}`);
  console.log(`  All envelopes valid:        ${t.validCount === results.length ? "yes" : "no"} (${t.validCount}/${results.length})`);
  console.log(`  Parcels with harness error: ${t.errorCount}`);
  console.log(`  Parcels with any FAIL:      ${t.failParcels}/${results.length}`);

  writeReport(gold, results, t);
  console.log("");
  console.log(`Report written: ${REPORT_PATH}`);
}

main().catch((e) => {
  console.error(`HARNESS ERROR: ${msg(e)}`);
}).finally(() => {
  process.exitCode = 0;
});
