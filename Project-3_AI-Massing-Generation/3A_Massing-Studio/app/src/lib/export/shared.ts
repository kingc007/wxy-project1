// Shared constants/helpers for the export layer. Pure; no library imports besides engine types.
import type { Assumptions, Citation, ComplianceRow, EnvelopeModel, Metrics, Program } from "@wxy/massing";

export const PROGRAM_LABEL: Record<Program, string> = {
  residential: "Residential",
  commercial: "Commercial",
  community_facility: "Community facility",
};
export const PROGRAM_SHORT: Record<Program, string> = { residential: "RES", commercial: "COM", community_facility: "CF" };
/** Light-theme program colours (design-system.md, validated palette). */
export const PROGRAM_HEX: Record<Program, string> = {
  residential: "#2a78d6",
  commercial: "#eb6834",
  community_facility: "#1baf7a",
};
export const PROGRAM_HEX_DARK: Record<Program, string> = {
  residential: "#3987e5",
  commercial: "#d95926",
  community_facility: "#199e70",
};
export const CONTEXT_HEX = "#d0cec7";
export const ENVELOPE_HEX = "#2E46C9";
export const GRAPHITE = "#22252A";
export const DISCLAIMER =
  "Study-grade massing; metrics computed by the WXY Massing Studio geometry engine; verify with a zoning professional";

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

/** Metric key -> user-string suffix (raw numbers, unit in the key name). */
const METRIC_KEYS: [keyof Metrics, string][] = [
  ["lotArea", "lot_area_sf"],
  ["gfa", "gfa_sf"],
  ["zfa", "zfa_sf"],
  ["far", "far"],
  ["floors", "floors"],
  ["height", "height_ft"],
  ["footprint", "footprint_sf"],
  ["lotCoveragePct", "lot_coverage_pct"],
  ["openSpacePct", "open_space_pct"],
  ["facadeArea", "facade_area_sf"],
  ["facadePerGfa", "facade_per_gfa"],
  ["volume", "volume_cf"],
  ["compactness", "compactness"],
  ["unitsEst", "units_est"],
  ["streetWallHeight", "street_wall_height_ft"],
  ["trimmedVolume", "trimmed_volume_cf"],
  ["courtyardSunHours", "courtyard_sun_hours"],
];
const PROGRAMS_ORDER: Program[] = ["residential", "commercial", "community_facility"];

/** Ordered list of [suffix, raw string] for every metric. Null -> "unavailable". */
export function metricEntries(m: Metrics): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, suffix] of METRIC_KEYS) {
    const v = m[k] as number | null;
    out.push([suffix, v === null || v === undefined ? "unavailable" : String(v)]);
  }
  for (const p of PROGRAMS_ORDER) out.push([`gfa_${p}_sf`, String(m.gfaByProgram[p])]);
  for (const p of PROGRAMS_ORDER) out.push([`far_${p}`, String(m.farByProgram[p])]);
  return out;
}

export function citationText(cs: readonly Citation[]): string {
  if (!cs.length) return "no citation";
  return cs.map((c) => `${c.section} ${c.url ?? "no url"}`.trim()).join("; ");
}

/** wxy.rule.<id> value: "status | allowed | proposed | citation section+url". */
export function ruleValue(r: ComplianceRow): string {
  return `${r.status} | ${r.allowed} | ${r.proposed} | ${citationText(r.citations)}`;
}

export function assumptionEntries(a: Assumptions): [string, string][] {
  const out: [string, string][] = [];
  const add = (k: string, v: { value: number; source: string; rationale: string }) =>
    out.push([k, `${v.value} | ${v.source} | ${v.rationale}`]);
  for (const p of PROGRAMS_ORDER) add(`floor_to_floor_ft.${p}`, a.floorToFloor[p]);
  add("ground_floor_height_ft", a.groundFloorHeight);
  add("avg_unit_net_sf", a.avgUnitNetSf);
  add("efficiency", a.efficiency);
  return out;
}

/** All cited controls of the envelope: [schema path, value text]. */
export function citationEntries(env: EnvelopeModel): [string, string][] {
  const out: [string, string][] = [];
  const add = (c: { path: string; label: string; value: number; unit: string; status: string; citations: Citation[] } | null | undefined) => {
    if (!c) return;
    out.push([c.path, `${c.label} | ${c.value} ${c.unit} | ${c.status} | ${citationText(c.citations)}`]);
  };
  for (const p of PROGRAMS_ORDER) add(env.maxFar[p]);
  add(env.maxBuildingHeight);
  add(env.maxStories);
  add(env.baseHeightMin);
  add(env.baseHeightMax);
  add(env.lotCoverageMax);
  add(env.yards.front);
  add(env.yards.rear);
  add(env.yards.side);
  for (const s of env.setbacks) {
    add(s.startHeight);
    add(s.depth);
  }
  for (const s of env.skyExposure) {
    add(s.startHeight);
    add(s.slope);
    add(s.initialSetback);
  }
  // de-duplicate paths (shared controls across rules): keep first
  const seen = new Set<string>();
  return out.filter(([k]) => (seen.has(k) ? false : (seen.add(k), true)));
}

export function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function floorsRange(floors: readonly number[]): { a: number; b: number } {
  // floor indices are 0-based in the engine; present 1-based to designers
  return { a: Math.min(...floors) + 1, b: Math.max(...floors) + 1 };
}
