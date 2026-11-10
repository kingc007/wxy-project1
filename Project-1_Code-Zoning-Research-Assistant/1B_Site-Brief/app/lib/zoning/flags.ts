import type { DataProvenance, ReviewFlag, SiteData } from "../types";
import { districtHasAnyRule, isDistrictCovered, normDistrict } from "./rules";
import { PLUTO_KEYS, basePortions, hasWideFrontEdge, isSplitLot, layerOnlyDistricts, plutoProv, primaryFrontEdge } from "./site-helpers";
import type { LotEdge } from "../types";

function prov(...ps: (DataProvenance | undefined)[]): DataProvenance[] | undefined {
  const out = ps.filter((p): p is DataProvenance => !!p);
  return out.length ? out : undefined;
}

export function computeFlags(site: SiteData, edges: LotEdge[] = site.edges): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  const p = site.pluto;
  if (p?.landmark) {
    flags.push({ kind: "landmark", message: `PLUTO landmark: "${p.landmark}". Landmark status is not modelled; confirm applicable restrictions before relying on this envelope.`, provenance: prov(plutoProv(p, ...PLUTO_KEYS.landmark)) });
  }
  if (p?.histDist) {
    flags.push({ kind: "historic_district", message: `PLUTO historic district: "${p.histDist}". Historic district rules are not modelled; confirm applicable restrictions before relying on this envelope.`, provenance: prov(plutoProv(p, ...PLUTO_KEYS.histDist)) });
  }
  const sp = [...new Set([...(p?.specialDistricts ?? []), ...site.districts.filter((d) => d.kind === "special_purpose").map((d) => d.code)])];
  if (sp.length) {
    flags.push({ kind: "special_district", message: `Special district ${sp.join(", ")}: Special district rules may modify or supersede the underlying district; not modelled.`, provenance: prov(plutoProv(p, ...PLUTO_KEYS.specialDistricts), ...site.districts.filter((d) => d.kind === "special_purpose").map((d) => d.provenance)) });
  }
  const portions = basePortions(site);
  if (isSplitLot(site)) {
    flags.push({ kind: "split_lot", message: `Lot lies in more than one base zoning district (${portions.map((x) => x.code).join(", ")}). Controls are resolved per portion; combined controls that differ are marked manual.`, provenance: prov(plutoProv(p, ...PLUTO_KEYS.zoneDist), ...site.districts.filter((d) => d.kind === "base").map((d) => d.provenance)) });
  }
  if (p?.irrLot === true) {
    flags.push({ kind: "irregular_lot", message: "PLUTO marks this as an irregularly shaped lot; frontage, depth and lot-width rules may not apply as modelled.", provenance: prov(plutoProv(p, ...PLUTO_KEYS.irrLot)) });
  }
  const unsupported = portions.filter((x) => !isDistrictCovered(x.code)).map((x) => x.code);
  if (unsupported.length) {
    flags.push({ kind: "unsupported_district", message: `Base district ${unsupported.join(", ")} is not covered by this prototype's rule set; district-dependent controls need input.`, provenance: prov(plutoProv(p, ...PLUTO_KEYS.zoneDist)) });
  }
  if (!portions.length) {
    flags.push({ kind: "unsupported_district", message: "No base zoning district identified for this lot; district-dependent controls need input." });
  }
  const overlays = [...new Set([...(p?.overlays ?? []), ...site.districts.filter((d) => d.kind === "commercial_overlay").map((d) => d.code)].map(normDistrict))];
  for (const o of overlays) {
    if (districtHasAnyRule(o)) continue;
    flags.push({ kind: "other", message: `Commercial overlay ${o}: commercial FAR rules not yet in this prototype's rule set — Needs input`, provenance: prov(plutoProv(p, ...PLUTO_KEYS.overlays)) });
  }
  const z1 = p?.zoneDist[0];
  const baseHits = site.districts.filter((d) => d.kind === "base");
  if (z1 && baseHits.length && !baseHits.some((h) => normDistrict(h.code) === normDistrict(z1))) {
    flags.push({ kind: "data_conflict", message: `PLUTO zonedist1 ${z1} is not among the zoning-layer base districts (${baseHits.map((h) => h.code).join(", ")}). PLUTO is used for rules; verify the district.`, provenance: prov(plutoProv(p, ...PLUTO_KEYS.zoneDist), ...baseHits.map((h) => h.provenance)) });
  }
  const extra = layerOnlyDistricts(site);
  if (extra.length) {
    flags.push({ kind: "data_conflict", message: `DCP zoning layer also shows ${extra.map((e) => `${e.code}${e.share !== null ? ` (${Math.round(e.share * 100)}% of lot)` : ""}`).join(", ")}, which PLUTO does not list. PLUTO is used for rules; the layers are not for lot-level determination. Check whether the lot is split.`, provenance: prov(plutoProv(p, ...PLUTO_KEYS.zoneDist), ...site.districts.filter((d) => d.kind === "base").map((d) => d.provenance)) });
  }
  if (p?.lotType === 6) {
    flags.push({ kind: "other", message: "PLUTO lottype 6: tax lot with no street frontage. Treated as an interior lot; street-dependent rules need review.", provenance: prov(plutoProv(p, ...PLUTO_KEYS.lotType)) });
  }
  if (hasWideFrontEdge(edges) && (p?.lotDepth ?? 0) > 100) {
    flags.push({ kind: "other", message: "Lot depth exceeds 100 ft on a wide street: the portion beyond 100 ft of the wide street may be governed by different rows (ZR 23-22 fn 1/2)." });
  }
  if ((p?.lotArea ?? 0) >= 20000) {
    flags.push({ kind: "other", message: "Lot may qualify as an eligible site (ZR 23-434); coverage and height differ — not modelled", provenance: prov(plutoProv(p, ...PLUTO_KEYS.lotArea)) });
  }
  if (!primaryFrontEdge(edges)) {
    flags.push({ kind: "manual_geometry", message: "No front lot edge with street data was identified; street setback and sky exposure planes were not generated." });
  }
  return flags;
}
