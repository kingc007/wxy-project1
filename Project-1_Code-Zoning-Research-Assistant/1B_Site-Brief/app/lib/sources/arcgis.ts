// Shared helpers for the DCP ArcGIS FeatureServer query endpoints.
// Parameter semantics (geometry / geometryType / inSR / spatialRel / outSR / f=geojson) confirmed against
// https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service-layer/ (2026-10-25).
import type { Ring } from "@/lib/types";
import { bbox } from "./geom";
import { fetchJson, type FetchResult } from "./http";

export const ARCGIS_ORG = "https://services5.arcgis.com/GfwWNkhOj9bNBqoJ";
/** Layer ids resolved from <FeatureServer>?f=json on 2026-10-25: every layer below has a single layer, id 0. */
export const SERVICE = {
  mappluto: `${ARCGIS_ORG}/ArcGIS/rest/services/MAPPLUTO/FeatureServer/0`,
  nyzd: `${ARCGIS_ORG}/ArcGIS/rest/services/nyzd/FeatureServer/0`,
  nyco: `${ARCGIS_ORG}/ArcGIS/rest/services/nyco/FeatureServer/0`,
  nysp: `${ARCGIS_ORG}/ArcGIS/rest/services/nysp/FeatureServer/0`,
  nycmih: `${ARCGIS_ORG}/ArcGIS/rest/services/nycmih/FeatureServer/0`,
  nylh: `${ARCGIS_ORG}/ArcGIS/rest/services/nylh/FeatureServer/0`,
  dcmStreets: `${ARCGIS_ORG}/arcgis/rest/services/DCM_Street_Center_Line/FeatureServer/0`,
} as const;

export interface GeoJsonFeature {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: number[][][] } | { type: "MultiPolygon"; coordinates: number[][][][] }
    | { type: "LineString"; coordinates: number[][] } | { type: "MultiLineString"; coordinates: number[][][] } | null;
  properties: Record<string, unknown>;
}
export interface GeoJsonCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
  error?: { code?: number; message?: string };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function queryUrl(
  layer: string,
  p: { where?: string; outFields: string; outSR: 2263 | 4326; geometry?: string; geometryType?: string; inSR?: number; orderBy?: string },
): string {
  const q = new URLSearchParams();
  q.set("where", p.where ?? "1=1");
  if (p.geometry) {
    q.set("geometry", p.geometry);
    q.set("geometryType", p.geometryType ?? "esriGeometryEnvelope");
    q.set("inSR", String(p.inSR ?? 2263));
    q.set("spatialRel", "esriSpatialRelIntersects");
  }
  q.set("outFields", p.outFields);
  q.set("outSR", String(p.outSR));
  if (p.orderBy) q.set("orderByFields", p.orderBy);
  q.set("f", "geojson");
  return `${layer}/query?${q.toString()}`;
}

/** Esri JSON polygon (ring coordinates rounded to 0.01 ft to keep URLs short and deterministic). */
export function esriPolygon(ring: Ring, wkid = 2263): string {
  const closed = ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
    ? [...ring, ring[0]] : ring;
  return JSON.stringify({ rings: [closed.map(([x, y]) => [r2(x), r2(y)])], spatialReference: { wkid } });
}

export function envelopeParam(rings: Ring[], padFt: number): string {
  const b = bbox(rings);
  return [b.xmin - padFt, b.ymin - padFt, b.xmax + padFt, b.ymax + padFt].map(r2).join(",");
}

export async function queryLayer(url: string, source: string): Promise<FetchResult<GeoJsonCollection>> {
  const res = await fetchJson<GeoJsonCollection>(url, { source });
  if (!res.body || !Array.isArray(res.body.features)) {
    const msg = res.body?.error?.message ?? "unexpected response (no features array)";
    throw new Error(`${source}: ${msg}`);
  }
  return res;
}

/** Outer rings of a Polygon/MultiPolygon feature (holes ignored). */
export function outerRings(f: GeoJsonFeature): Ring[] {
  const g = f.geometry;
  if (!g) return [];
  if (g.type === "Polygon") return g.coordinates.length ? [g.coordinates[0] as Ring] : [];
  if (g.type === "MultiPolygon") return g.coordinates.map((p) => p[0] as Ring);
  return [];
}
