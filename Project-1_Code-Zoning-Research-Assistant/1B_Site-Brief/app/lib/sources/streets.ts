// DCM Street Center Line (DCP Digital City Map). `Streetwidth` is a free-text string: plain numbers ("100", "90.2"),
// bounds (">75", ">60"), ranges ("73-100"), approximations ("~45", "Around 50") and words ("Unknown").
// ZR 12-10: wide street = "any street 75 feet or more in width" (research/zr-definitions-and-street-width.md).
// Whether DCM Streetwidth equals the ZR "width" is UNVERIFIED in that note, hence confidence "inferred" downstream.
import type { DataProvenance, Ring, StreetSegment } from "@/lib/types";
import { envelopeParam, queryLayer, queryUrl, SERVICE, type GeoJsonFeature } from "./arcgis";
import { distancePointToLines } from "./geom";

export const WIDE_STREET_MIN_FT = 75;
const DATASET = "DCM Street Center Line";
/** Feature types that are not live streets. */
const EXCLUDED_FEAT_TYPES = new Set(["Demapped_St", "Former_St"]);

/** StreetSegment plus the local direction of the closest centerline piece (unit vector), used to demand parallelism. */
export type StreetHit = StreetSegment & { direction?: [number, number] };

export function parseStreetWidth(raw: string | null): { widthFt: number | null; wide: boolean | null } {
  if (raw === null) return { widthFt: null, wide: null };
  const s = raw.trim();
  const NUM = "(\\d+(?:\\.\\d+)?)";
  let m = s.match(new RegExp(`^${NUM}$`));
  if (m) {
    const w = Number(m[1]);
    return { widthFt: w, wide: w >= WIDE_STREET_MIN_FT };
  }
  m = s.match(new RegExp(`^>\\s*${NUM}$`));
  if (m) return { widthFt: null, wide: Number(m[1]) >= WIDE_STREET_MIN_FT ? true : null };
  m = s.match(new RegExp(`^${NUM}\\s*-\\s*${NUM}$`));
  if (m) {
    const lo = Math.min(Number(m[1]), Number(m[2]));
    const hi = Math.max(Number(m[1]), Number(m[2]));
    return { widthFt: null, wide: lo >= WIDE_STREET_MIN_FT ? true : hi < WIDE_STREET_MIN_FT ? false : null };
  }
  return { widthFt: null, wide: null };
}

function lines(f: GeoJsonFeature): Ring[] {
  const g = f.geometry;
  if (!g) return [];
  if (g.type === "LineString") return [g.coordinates as Ring];
  if (g.type === "MultiLineString") return g.coordinates as Ring[];
  return [];
}

/** Centerline segments within radiusFt of a point (EPSG:2263), nearest first. */
export async function nearestStreets(point: [number, number], radiusFt: number): Promise<StreetHit[]> {
  const geometry = envelopeParam([[point]], radiusFt);
  const url = queryUrl(SERVICE.dcmStreets, { outFields: "Street_NM,Streetwidth,Feat_Type,Build_Status", outSR: 2263, geometry });
  const res = await queryLayer(url, DATASET);
  const out: StreetHit[] = [];
  for (const f of res.body.features) {
    const featType = f.properties.Feat_Type;
    if (typeof featType === "string" && EXCLUDED_FEAT_TYPES.has(featType)) continue;
    const d = distancePointToLines(point, lines(f));
    if (!d || d.distance > radiusFt) continue;
    const widthRaw = typeof f.properties.Streetwidth === "string" ? f.properties.Streetwidth : null;
    const name = typeof f.properties.Street_NM === "string" && f.properties.Street_NM.trim() ? f.properties.Street_NM : null;
    const provenance: DataProvenance = { dataset: DATASET, version: null, field: "Streetwidth", rawValue: widthRaw, url, fetchedAt: res.fetchedAt };
    out.push({ name, widthRaw, ...parseStreetWidth(widthRaw), distanceFt: d.distance, provenance, direction: d.direction });
  }
  return out.sort((a, b) => a.distanceFt - b.distanceFt);
}
