import type { DataProvenance, LotEdge, PlutoLot, PValue, SiteData, Unit } from "../types";
import { normDistrict } from "./rules";

const SLIVER = 0.02;
const NEAR_ALL = 0.98;

/** Provenance for a normalised PLUTO property; tolerates raw lower-case dataset field names as keys. */
export function plutoProv(pluto: PlutoLot | null, ...keys: string[]): DataProvenance | undefined {
  if (!pluto) return undefined;
  for (const k of keys) {
    const p = pluto.provenance[k];
    if (p) return p;
  }
  return undefined;
}

export const PLUTO_KEYS = {
  lotArea: ["lotArea", "lotarea"],
  lotFront: ["lotFront", "lotfront"],
  lotDepth: ["lotDepth", "lotdepth"],
  lotType: ["lotType", "lottype"],
  zoneDist: ["zoneDist", "zonedist1", "zonedist"],
  landmark: ["landmark"],
  histDist: ["histDist", "histdist"],
  irrLot: ["irrLot", "irrlotcode"],
  specialDistricts: ["specialDistricts", "spdist1"],
  overlays: ["overlays", "overlay1"],
} as const;

/** A PLUTO-derived lot dimension as a PValue: status "data" with provenance, else needs_input. */
export function plutoValue(pluto: PlutoLot | null, value: number | null | undefined, unit: Unit, keys: readonly string[], label: string): PValue {
  const prov = plutoProv(pluto, ...keys);
  if (value === null || value === undefined || !prov) {
    return {
      value: null,
      unit,
      status: "needs_input",
      confidence: "unverified",
      note: value === null || value === undefined ? `PLUTO ${label} not available` : `PLUTO ${label} has no provenance record`,
    };
  }
  return { value, unit, status: "data", confidence: "cited", provenance: [prov] };
}

/** Longest front edge (ties: lowest index). */
export function primaryFrontEdge(edges: LotEdge[]): LotEdge | null {
  const fronts = edges.filter((e) => e.kind === "front");
  if (!fronts.length) return null;
  return fronts.reduce((best, e) => (e.lengthFt > best.lengthFt ? e : best), fronts[0]);
}

export interface Portion {
  code: string;
  share: number | null;
}

/** Base-district portions of the lot (PLUTO zonedist1..4 plus significant layer hits) with layer shares. */
export function basePortions(site: SiteData): Portion[] {
  const hits = site.districts.filter((d) => d.kind === "base");
  const shareOf = (code: string): number | null => {
    const hs = hits.filter((h) => normDistrict(h.code) === code && h.share !== null);
    return hs.length ? hs.reduce((s, h) => s + (h.share as number), 0) : null;
  };
  const out: Portion[] = [];
  const add = (raw: string) => {
    const code = normDistrict(raw);
    if (!out.some((p) => p.code === code)) out.push({ code, share: shareOf(code) });
  };
  (site.pluto?.zoneDist ?? []).forEach(add);
  // PLUTO is the lot-level source; DCP layers are "not for lot-level determination" (nyc-data-endpoints.md).
  // Layer-only districts become a data_conflict flag (flags.ts), never extra portions, when PLUTO is present.
  if (site.pluto?.zoneDist.length) return out;
  for (const h of hits) {
    const code = normDistrict(h.code);
    const sh = shareOf(code);
    const inPluto = (site.pluto?.zoneDist ?? []).some((z) => normDistrict(z) === code);
    if (inPluto || sh === null || sh >= SLIVER) add(h.code);
  }
  return out;
}

export function isSplitLot(site: SiteData): boolean {
  if (site.pluto?.zoneDist.length) return site.pluto.zoneDist.length > 1;
  const codes = new Set(
    site.districts
      .filter((d) => d.kind === "base" && d.share !== null && d.share >= SLIVER && d.share <= NEAR_ALL)
      .map((d) => normDistrict(d.code)),
  );
  return codes.size > 1;
}

export function primaryDistrict(site: SiteData): string | null {
  const first = site.pluto?.zoneDist[0];
  if (first) return normDistrict(first);
  const hits = site.districts.filter((d) => d.kind === "base");
  if (!hits.length) return null;
  const best = hits.reduce((b, h) => ((h.share ?? 0) > (b.share ?? 0) ? h : b), hits[0]);
  return normDistrict(best.code);
}

export function hasWideFrontEdge(edges: LotEdge[]): boolean {
  return edges.some((e) => e.kind === "front" && e.street?.wide === true);
}

/** Base districts the DCP layers show on the lot (share >= SLIVER) that PLUTO does not list. */
export function layerOnlyDistricts(site: SiteData): { code: string; share: number | null }[] {
  const pl = (site.pluto?.zoneDist ?? []).map(normDistrict);
  if (!pl.length) return [];
  return site.districts
    .filter((d) => d.kind === "base" && (d.share === null || d.share >= SLIVER) && !pl.includes(normDistrict(d.code)))
    .map((d) => ({ code: d.code, share: d.share }));
}
