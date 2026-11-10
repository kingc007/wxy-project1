import type { Assumption, DataProvenance, LotEdge, SiteData } from "../types";
import type { BriefInput, ExtAssumptionKey, RuleContext } from "./model";
import { PLUTO_KEYS, plutoProv, primaryFrontEdge } from "./site-helpers";

/** Assumption factory; permits the locally extended key union (see ExtAssumptionKey). */
function mk(a: Omit<Assumption, "key"> & { key: ExtAssumptionKey }): Assumption {
  return a as unknown as Assumption;
}

const WIDE_STREET_QUOTE = 'ZR 12-10: wide street = "any street 75 feet or more in width"';

function withRaw(p: DataProvenance | undefined, raw: unknown): DataProvenance[] | undefined {
  if (!p) return undefined;
  return [p.rawValue === undefined ? { ...p, rawValue: raw } : p];
}

function lotTypeAssumption(site: SiteData): Assumption {
  const code = site.pluto?.lotType ?? null;
  const prov = withRaw(plutoProv(site.pluto, ...PLUTO_KEYS.lotType), code);
  const base = { id: "lotType", key: "lotType" as const, state: "proposed" as const, options: ["interior", "corner", "through"], provenance: prov };
  if (code === 5) {
    return mk({ ...base, value: "interior", statement: "Assumed interior lot (not corner)", confidence: "cited",
      reason: 'PLUTO lottype = 5 — "5 Inside – a tax lot with frontage on only one street" (PLUTO data dictionary 26v2).' });
  }
  if (code === 3) {
    return mk({ ...base, value: "corner", statement: "Assumed corner lot", confidence: "cited",
      reason: 'PLUTO lottype = 3 — "3 Corner – a tax lot bordering on two intersecting streets" (PLUTO data dictionary 26v2).' });
  }
  if (code === 4) {
    return mk({ ...base, value: "through", statement: "Assumed through lot", confidence: "cited",
      reason: "PLUTO lottype = 4 (Through) per PLUTO data dictionary 26v2." });
  }
  if (code === 6) {
    return mk({ ...base, value: "interior", statement: "Assumed interior lot (PLUTO reports no street frontage)", confidence: "unverified",
      reason: 'PLUTO lottype = 6 — "6 Interior lot – a tax lot that has no street frontage" (PLUTO data dictionary 26v2); treated as interior, flagged for review.' });
  }
  return mk({ ...base, value: "unknown", statement: "Lot type needs input", confidence: "unverified",
    reason: code === null ? "PLUTO lottype not available." : `PLUTO lottype = ${code} does not map to interior, corner or through.` });
}

function streetAssumption(edges: LotEdge[]): Assumption {
  const e = primaryFrontEdge(edges);
  const s = e?.street ?? null;
  const base = { id: "street", key: "street" as const, state: "proposed" as const, options: ["wide", "narrow"], provenance: s ? [s.provenance] : undefined };
  if (!e || !s) {
    return mk({ ...base, value: "unknown", statement: "Street width of the primary frontage is unknown", confidence: "unverified",
      reason: e ? "No street data matched the primary front edge." : "No front lot edge identified." });
  }
  const src = `DCM Streetwidth = "${s.widthRaw ?? "n/a"}"${s.name ? ` for ${s.name}` : ""}`;
  if (s.wide === true) {
    return mk({ ...base, value: "wide", statement: "Assumed primary frontage is on a wide street", confidence: "inferred", reason: `${src}. ${WIDE_STREET_QUOTE}.` });
  }
  if (s.wide === false) {
    return mk({ ...base, value: "narrow", statement: "Assumed primary frontage is on a narrow street", confidence: "inferred", reason: `${src}. ${WIDE_STREET_QUOTE}.` });
  }
  return mk({ ...base, value: "unknown", statement: "Street width of the primary frontage is unknown", confidence: "unverified",
    reason: `${src} could not be classified as wide or narrow. ${WIDE_STREET_QUOTE}.` });
}

function within100Assumption(site: SiteData, edges: LotEdge[]): Assumption {
  const fronts = edges.filter((e) => e.kind === "front");
  const depth = site.pluto?.lotDepth ?? null;
  const base = {
    id: "within100ftWideStreet", key: "within100ftWideStreet" as const, state: "proposed" as const, options: [true, false],
    provenance: fronts.flatMap((e) => (e.street ? [e.street.provenance] : [])),
  };
  const wide = fronts.filter((e) => e.street?.wide === true);
  if (wide.length) {
    if (depth === null) {
      return mk({ ...base, value: true, statement: "Wide-street frontage; distance from the wide street cannot be checked", confidence: "unverified",
        reason: "A front edge is on a wide street but PLUTO lot depth is not available." });
    }
    return mk({ ...base, value: true, statement: "Assumed lot is within 100 ft of a wide street", confidence: "inferred",
      reason: `A front edge is on a wide street and PLUTO lot depth is ${depth} ft${depth > 100 ? " (> 100 ft: part of the lot is beyond 100 ft)" : " (≤ 100 ft)"}.` });
  }
  if (fronts.length && fronts.every((e) => e.street?.wide === false)) {
    return mk({ ...base, value: false, statement: "Assumed lot is not within 100 ft of a wide street", confidence: "inferred",
      reason: "All front edges are on narrow streets per DCM Streetwidth; wide streets elsewhere nearby are not checked." });
  }
  return mk({ ...base, value: false, statement: "Distance to a wide street is unknown", confidence: "unverified",
    reason: "Street width could not be determined for every front edge." });
}

export interface AssumptionInput {
  intendedUse: BriefInput["intendedUse"];
  programs: string[];
  overrides?: Record<string, string | boolean>;
}

function coerce(a: Assumption, v: string | boolean): string | boolean | undefined {
  if (typeof a.options[0] === "boolean") {
    if (v === true || v === "true") return true;
    if (v === false || v === "false") return false;
    return undefined;
  }
  const s = String(v);
  if (a.key === "buildingType") return s || undefined; // free-form building types allowed
  return a.options.includes(s) ? s : undefined;
}

export function deriveAssumptions(site: SiteData, input: AssumptionInput, edges: LotEdge[] = site.edges): Assumption[] {
  const lotArea = site.pluto?.lotArea ?? null;
  const program = input.programs.includes("qualifying_affordable")
    ? "qualifying_affordable"
    : input.programs.includes("qualifying_residential_site") ? "qualifying_residential_site" : "standard";
  const list: Assumption[] = [
    lotTypeAssumption(site),
    streetAssumption(edges),
    within100Assumption(site, edges),
    mk({ id: "buildingType", key: "buildingType", value: "attached", statement: "Assumed attached building (no side yards)",
      reason: "Default assumption: no dataset gives the intended building type.", state: "proposed",
      options: ["attached", "semi_detached", "detached", "zero_lot_line"], confidence: "unverified" }),
    mk({ id: "siteCategory", key: "siteCategory", value: "standard", statement: "Assumed standard lot (not an eligible site under ZR 23-434)",
      reason: lotArea === null ? "PLUTO lot area not available; eligible-site criteria are not evaluated." : `PLUTO lot area is ${lotArea.toLocaleString("en-US")} sf; eligible-site criteria are not evaluated.`,
      state: "proposed", options: ["standard", "eligible_site"], confidence: "inferred",
      provenance: plutoProv(site.pluto, ...PLUTO_KEYS.lotArea) ? [plutoProv(site.pluto, ...PLUTO_KEYS.lotArea) as DataProvenance] : undefined }),
    mk({ id: "program", key: "program", value: program,
      statement: program === "standard" ? "Standard program (no affordable-housing bonus)" : `Program: ${program.replace(/_/g, " ")}`,
      reason: "Selected by the user.", state: "accepted", options: ["standard", "qualifying_affordable", "qualifying_residential_site"], confidence: "cited" }),
    mk({ id: "intendedUse", key: "intendedUse", value: input.intendedUse, statement: `Intended use: ${input.intendedUse.replace(/_/g, " ")}`,
      reason: "Selected by the user.", state: "accepted", options: ["residential", "commercial", "community_facility", "manufacturing", "mixed"], confidence: "cited" }),
  ];
  const overrides = input.overrides ?? {};
  return list.map((a) => {
    if (!(a.key in overrides)) return a;
    const v = coerce(a, overrides[a.key]);
    if (v === undefined || v === a.value) return a;
    return {
      ...a,
      value: v,
      state: "overridden" as const,
      statement: `${a.statement} — overridden to ${String(v)}`,
      reason: `Overridden by user. Source value: ${String(a.value)} (${a.reason})`,
      confidence: "inferred" as const,
    };
  });
}

export function assumptionValue(assumptions: Assumption[], key: ExtAssumptionKey): string | boolean | undefined {
  return assumptions.find((a) => (a.key as ExtAssumptionKey) === key)?.value;
}

/** Programs actually in effect (an overridden `program` assumption replaces the input toggles). */
export function effectivePrograms(assumptions: Assumption[], inputPrograms: string[]): string[] {
  const a = assumptions.find((x) => x.key === "program");
  const base = inputPrograms.filter((p) => p === "qualifying_affordable" || p === "qualifying_residential_site");
  if (a?.state === "overridden") return a.value === "standard" ? [] : [String(a.value)];
  return base;
}

export function effectiveUse(assumptions: Assumption[]): BriefInput["intendedUse"] {
  return String(assumptionValue(assumptions, "intendedUse")) as BriefInput["intendedUse"];
}

/** Rule-matching context from assumptions. Unverified street/distance assumptions are left unknown. */
export function assumptionContext(assumptions: Assumption[], lotWidth: number | null): RuleContext {
  const ctx: RuleContext = { lotWidth };
  const get = (k: ExtAssumptionKey) => assumptions.find((a) => (a.key as ExtAssumptionKey) === k && a.state !== "rejected");
  const lt = get("lotType")?.value;
  if (lt === "interior" || lt === "corner" || lt === "through") ctx.lotType = lt;
  const st = get("street");
  if (st && (st.value === "wide" || st.value === "narrow")) ctx.street = st.value;
  const w = get("within100ftWideStreet");
  if (w && typeof w.value === "boolean" && (w.confidence !== "unverified" || w.state === "overridden")) ctx.within100ftWideStreet = w.value;
  ctx.program = get("program")?.value === "qualifying_affordable" ? "qualifying_affordable" : "standard";
  const bt = get("buildingType")?.value;
  if (typeof bt === "string") ctx.buildingType = bt;
  const sc = get("siteCategory")?.value;
  if (typeof sc === "string") ctx.siteCategory = sc;
  return ctx;
}
