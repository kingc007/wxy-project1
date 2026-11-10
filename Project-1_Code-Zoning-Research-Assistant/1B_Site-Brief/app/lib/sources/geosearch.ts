// NYC GeoSearch v2 (Planning Labs). No key. Browser preflight returns 403, so call only from the server.
// Verified: research/nyc-data-endpoints.md claims 1-2 and test-parcels.md G1-G11.
import type { DataProvenance, GeocodeResult } from "@/lib/types";
import { fetchJson } from "./http";
import { getPluto } from "./pluto";
import { getLotGeometry } from "./mappluto";

const BASE = "https://geosearch.planninglabs.nyc/v2";
export const BBL_RE = /^[1-5]\d{9}$/;

interface GeoSearchFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: { label?: string; addendum?: { pad?: { bbl?: string; version?: string } } };
}
interface GeoSearchResponse { features?: GeoSearchFeature[] }

export function isBbl(q: string): boolean {
  return BBL_RE.test(q.trim());
}

async function run(endpoint: "search" | "autocomplete", q: string, size: number): Promise<GeocodeResult[]> {
  const url = `${BASE}/${endpoint}?text=${encodeURIComponent(q.trim())}&size=${size}`;
  const res = await fetchJson<GeoSearchResponse>(url, { source: "NYC GeoSearch" });
  const out: GeocodeResult[] = [];
  for (const f of res.body.features ?? []) {
    const bbl = f.properties?.addendum?.pad?.bbl;
    const coords = f.geometry?.coordinates;
    if (!bbl || !BBL_RE.test(bbl) || !coords) continue; // streets / intersections carry no BBL
    const version = f.properties?.addendum?.pad?.version;
    const provenance: DataProvenance = {
      dataset: "NYC GeoSearch",
      version: version ? `PAD ${version}` : null,
      field: "addendum.pad.bbl",
      rawValue: bbl,
      url,
      fetchedAt: res.fetchedAt,
    };
    out.push({ label: f.properties?.label ?? bbl, bbl, lon: coords[0], lat: coords[1], provenance });
  }
  return out;
}

/** A raw BBL bypasses the geocoder: PLUTO supplies the address, MapPLUTO the centroid (both are cached for reuse). */
async function fromBbl(bbl: string): Promise<GeocodeResult[]> {
  const [pluto, geom] = await Promise.all([getPluto(bbl), getLotGeometry(bbl)]);
  const ring = geom.ring4326;
  const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1) : ring;
  const lon = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [{
    label: pluto.address ? `${pluto.address} (BBL ${bbl})` : `BBL ${bbl}`,
    bbl,
    lon,
    lat,
    provenance: pluto.provenance.address ?? { dataset: "PLUTO", version: pluto.version, field: "bbl", rawValue: bbl, url: null, fetchedAt: geom.provenance.fetchedAt },
  }];
}

export async function search(q: string): Promise<GeocodeResult[]> {
  const t = q.trim();
  if (!t) return [];
  return isBbl(t) ? fromBbl(t) : run("search", t, 1);
}

export async function autocomplete(q: string): Promise<GeocodeResult[]> {
  const t = q.trim();
  if (t.length < 2) return [];
  return isBbl(t) ? fromBbl(t) : run("autocomplete", t, 6);
}
