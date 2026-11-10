// DCP zoning GIS layers (nyzd, nyco, nysp, nycmih, nylh). DCP says these layers are "not intended for determining
// zoning at the individual tax lot level" (research/nyc-data-endpoints.md claim 50), so PLUTO is primary and these
// hits are a cross-check; the engine does the comparison. Shares are computed here in planar EPSG:2263.
import type { DataProvenance, DistrictHit, Ring } from "@/lib/types";
import { esriPolygon, queryLayer, queryUrl, SERVICE, type GeoJsonFeature } from "./arcgis";
import { bbox, clipToBox, intersectionArea, ringArea } from "./geom";

/** Hits covering less than this fraction of the lot are treated as boundary-alignment slivers and dropped. */
export const MIN_DISTRICT_SHARE = 0.001;

interface LayerSpec {
  key: string;
  dataset: string;
  layer: string;
  kind: DistrictHit["kind"];
  fields: string;
  codeField: string;
  labelField: string | null;
}

export const LAYERS: LayerSpec[] = [
  { key: "nyzd", dataset: "DCP Zoning Districts (nyzd)", layer: SERVICE.nyzd, kind: "base", fields: "ZONEDIST", codeField: "ZONEDIST", labelField: null },
  { key: "nyco", dataset: "DCP Commercial Overlays (nyco)", layer: SERVICE.nyco, kind: "commercial_overlay", fields: "OVERLAY", codeField: "OVERLAY", labelField: null },
  { key: "nysp", dataset: "DCP Special Purpose Districts (nysp)", layer: SERVICE.nysp, kind: "special_purpose", fields: "SDNAME,SDLBL", codeField: "SDLBL", labelField: "SDNAME" },
  { key: "nylh", dataset: "DCP Limited Height Districts (nylh)", layer: SERVICE.nylh, kind: "limited_height", fields: "LHNAME,LHLBL", codeField: "LHLBL", labelField: "LHNAME" },
  { key: "nycmih", dataset: "DCP Mandatory Inclusionary Housing (nycmih)", layer: SERVICE.nycmih, kind: "inclusionary_area", fields: "MIH_Option,ProjectNam,Status", codeField: "MIH_Option", labelField: "ProjectNam" },
];

function featureShare(lot: Ring, f: GeoJsonFeature, lotArea: number): number {
  const g = f.geometry;
  if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) return 0;
  const a = intersectionArea(lot, g.coordinates as number[][][] | number[][][][], g.type === "MultiPolygon");
  return Math.min(1, Math.max(0, a / lotArea));
}

/** Padding (as a multiple of the lot's extent, min 0.0005 deg) of the window used to trim map geometry. */
const MAP_WINDOW_PAD_FACTOR = 3;

async function queryOne(spec: LayerSpec, ring2263: Ring, ring4326?: Ring): Promise<DistrictHit[]> {
  const make = (sr: 2263 | 4326) => queryUrl(spec.layer, {
    outFields: `OBJECTID,${spec.fields}`, outSR: sr, geometry: esriPolygon(ring2263), geometryType: "esriGeometryPolygon", inSR: 2263,
  });
  const url = make(2263);
  const [res, res4326] = await Promise.all([queryLayer(url, spec.dataset), queryLayer(make(4326), spec.dataset)]);
  const geo4326 = new Map<unknown, GeoJsonFeature>(res4326.body.features.map((f) => [f.properties.OBJECTID, f]));
  let window: ReturnType<typeof bbox> | null = null;
  if (ring4326) {
    const b = bbox([ring4326]);
    const pad = Math.max(0.0005, MAP_WINDOW_PAD_FACTOR * Math.max(b.xmax - b.xmin, b.ymax - b.ymin));
    window = { xmin: b.xmin - pad, ymin: b.ymin - pad, xmax: b.xmax + pad, ymax: b.ymax + pad };
  }
  const mapRings = (f: GeoJsonFeature): Ring[] => {
    const g = geo4326.get(f.properties.OBJECTID)?.geometry;
    if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) return [];
    const coords = g.coordinates as number[][][] | number[][][][];
    if (window) return clipToBox(coords, g.type === "MultiPolygon", window);
    return g.type === "Polygon" ? [g.coordinates[0] as Ring] : g.coordinates.map((p) => p[0] as Ring);
  };
  const lotArea = ringArea(ring2263);
  const merged = new Map<string, DistrictHit>();
  for (const f of res.body.features) {
    const code = f.properties[spec.codeField];
    if (typeof code !== "string" || code.trim() === "") continue;
    const share = featureShare(ring2263, f, lotArea);
    if (share < MIN_DISTRICT_SHARE) continue;
    const existing = merged.get(code);
    if (existing) {
      existing.share = Math.min(1, (existing.share ?? 0) + share);
      existing.geometry4326 = [...(existing.geometry4326 ?? []), ...mapRings(f)];
      continue;
    }
    const label = spec.labelField ? f.properties[spec.labelField] : null;
    const provenance: DataProvenance = {
      dataset: spec.dataset, version: null, // layers expose no version string, only dataLastEditDate (claim 51)
      field: spec.codeField, rawValue: code, url, fetchedAt: res.fetchedAt,
    };
    merged.set(code, { code, kind: spec.kind, label: typeof label === "string" ? label : null, share, geometry4326: mapRings(f), provenance });
  }
  return [...merged.values()];
}

export interface DistrictsResult {
  hits: DistrictHit[];
  errors: { source: string; message: string }[];
}

/** Query all five layers; a failing layer is reported in `errors` and does not hide the others. */
export async function getDistrictsDetailed(ring2263: Ring, ring4326?: Ring): Promise<DistrictsResult> {
  const settled = await Promise.allSettled(LAYERS.map((s) => queryOne(s, ring2263, ring4326)));
  const hits: DistrictHit[] = [];
  const errors: DistrictsResult["errors"] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") hits.push(...r.value);
    else errors.push({ source: LAYERS[i].dataset, message: r.reason instanceof Error ? r.reason.message : String(r.reason) });
  });
  hits.sort((a, b) => (b.share ?? 0) - (a.share ?? 0));
  return { hits, errors };
}

export async function getDistricts(ring2263: Ring, ring4326?: Ring): Promise<DistrictHit[]> {
  const { hits, errors } = await getDistrictsDetailed(ring2263, ring4326);
  if (errors.length === LAYERS.length) throw new Error(errors.map((e) => e.message).join("; "));
  return hits;
}
