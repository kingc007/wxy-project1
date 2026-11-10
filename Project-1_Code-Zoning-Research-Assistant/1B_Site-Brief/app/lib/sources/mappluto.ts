// MapPLUTO lot polygons (DCP ArcGIS FeatureServer). outSR=2263 gives EPSG:2263 feet (research/manager-checks.md M3).
import type { DataProvenance, LotGeometry, Ring } from "@/lib/types";
import { envelopeParam, outerRings, queryLayer, queryUrl, SERVICE } from "./arcgis";
import { ringArea } from "./geom";

export const NEIGHBOR_ENVELOPE_PAD_FT = 10; // envelope padding when looking for adjacent tax lots
const DATASET = "MapPLUTO (DCP ArcGIS)";

export async function getLotGeometry(bbl: string): Promise<LotGeometry> {
  if (!/^[1-5]\d{9}$/.test(bbl)) throw new Error(`Invalid BBL: ${bbl}`);
  const make = (sr: 2263 | 4326) => queryUrl(SERVICE.mappluto, { where: `BBL=${bbl}`, outFields: "BBL,Address,Version", outSR: sr });
  const [u2263, u4326] = [make(2263), make(4326)];
  const [r2263, r4326] = await Promise.all([queryLayer(u2263, DATASET), queryLayer(u4326, DATASET)]);
  const largest = (rs: Ring[]) => rs.slice().sort((a, b) => ringArea(b) - ringArea(a))[0];
  const f2263 = r2263.body.features[0];
  const f4326 = r4326.body.features[0];
  if (!f2263 || !f4326) throw new Error(`No MapPLUTO polygon for BBL ${bbl}`);
  const ring2263 = largest(outerRings(f2263));
  const ring4326 = largest(outerRings(f4326));
  if (!ring2263 || !ring4326) throw new Error(`MapPLUTO feature for BBL ${bbl} has no polygon geometry`);
  const version = typeof f2263.properties.Version === "string" ? f2263.properties.Version : null;
  const provenance: DataProvenance = {
    dataset: DATASET, version, field: "geometry", rawValue: { BBL: f2263.properties.BBL },
    url: u2263, fetchedAt: r2263.fetchedAt,
  };
  return { bbl, ring2263, ring4326, provenance };
}

/** Tax lots intersecting the (padded) envelope of the lot, excluding the lot itself. Index-aligned arrays. */
export async function getNeighbors(ring2263: Ring, excludeBbl?: string): Promise<{ rings2263: Ring[]; rings4326: Ring[] }> {
  const geometry = envelopeParam([ring2263], NEIGHBOR_ENVELOPE_PAD_FT);
  const make = (sr: 2263 | 4326) => queryUrl(SERVICE.mappluto, { outFields: "BBL", outSR: sr, geometry, geometryType: "esriGeometryEnvelope", inSR: 2263, orderBy: "BBL" });
  const [a, b] = await Promise.all([queryLayer(make(2263), DATASET), queryLayer(make(4326), DATASET)]);
  const byBbl = new Map<string, Ring[]>();
  for (const f of b.body.features) byBbl.set(String(f.properties.BBL), outerRings(f));
  const own = ringArea(ring2263);
  const rings2263: Ring[] = [];
  const rings4326: Ring[] = [];
  for (const f of a.body.features) {
    const id = String(f.properties.BBL);
    if (excludeBbl && id === excludeBbl) continue;
    const r2 = outerRings(f);
    const r4 = byBbl.get(id) ?? [];
    r2.forEach((ring, i) => {
      // without excludeBbl, drop a polygon that is (nearly) the lot itself
      if (!excludeBbl && Math.abs(ringArea(ring) - own) < 0.01 * own && ring[0][0] === ring2263[0][0] && ring[0][1] === ring2263[0][1]) return;
      if (r4[i]) { rings2263.push(ring); rings4326.push(r4[i]); }
    });
  }
  return { rings2263, rings4326 };
}
