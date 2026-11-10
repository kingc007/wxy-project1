// Orchestrator: query -> SiteData. A failure in one source is recorded in SiteData.errors and never thrown.
import type { GeocodeResult, LotEdge, LotGeometry, PlutoLot, SiteData } from "@/lib/types";
import { getDistrictsDetailed } from "./zoning-layers";
import { classifyEdges, edgeMidpoint, FRONT_STREET_MAX_DISTANCE_FT, lotEdges } from "./edges";
import { isBbl, search } from "./geosearch";
import { runWithFetchLog, type FetchMeta } from "./http";
import { getLotGeometry, getNeighbors } from "./mappluto";
import { getPluto } from "./pluto";
import { nearestStreets, type StreetHit } from "./streets";

export type StepId = "locate" | "lot" | "districts";
export type StepState = "running" | "done" | "error";
export type OnStep = (step: StepId, state: StepState) => void;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function getSiteData(query: string, onStep: OnStep = () => {}): Promise<SiteData> {
  const log: FetchMeta[] = [];
  const site = await runWithFetchLog(log, () => build(query, onStep));
  for (const m of log) {
    if (m.stale) {
      site.errors.push({
        source: m.source ?? "unknown",
        message: `Live fetch failed (${m.staleReason ?? "unknown reason"}); showing a cached copy.`,
        cachedAt: m.fetchedAt,
      });
    }
  }
  return site;
}

async function build(query: string, onStep: OnStep): Promise<SiteData> {
  const site: SiteData = { query, geocode: null, pluto: null, geometry: null, neighbors4326: [], districts: [], edges: [], errors: [] };
  const fail = (source: string, e: unknown) => site.errors.push({ source, message: msg(e) });

  // 1. locate
  onStep("locate", "running");
  const q = query.trim();
  try {
    const results: GeocodeResult[] = await search(q);
    if (results.length === 0) throw new Error(`No NYC address or BBL found for "${q}"`);
    site.geocode = results[0];
  } catch (e) {
    fail(isBbl(q) ? "PLUTO / MapPLUTO" : "NYC GeoSearch", e);
    onStep("locate", "error");
    return site;
  }
  onStep("locate", "done");
  const bbl = site.geocode.bbl;

  // 2. lot: PLUTO + polygon, then neighbours + streets + edges
  onStep("lot", "running");
  let lotFailed = false;
  const [plutoR, geomR] = await Promise.allSettled([getPluto(bbl), getLotGeometry(bbl)]);
  if (plutoR.status === "fulfilled") site.pluto = plutoR.value as PlutoLot;
  else { fail("PLUTO", plutoR.reason); lotFailed = true; }
  let geometry: LotGeometry | null = null;
  if (geomR.status === "fulfilled") geometry = site.geometry = geomR.value;
  else { fail("MapPLUTO (DCP ArcGIS)", geomR.reason); lotFailed = true; }

  if (geometry) {
    let neighbors2263: LotGeometry["ring2263"][] = [];
    try {
      const n = await getNeighbors(geometry.ring2263, bbl);
      neighbors2263 = n.rings2263;
      site.neighbors4326 = n.rings4326;
    } catch (e) { fail("MapPLUTO (DCP ArcGIS)", e); }

    const raw = lotEdges(geometry.ring2263);
    let streetsByEdge: StreetHit[][] = raw.map(() => []);
    let streetsOk = true;
    try {
      streetsByEdge = await Promise.all(raw.map((e) => nearestStreets(edgeMidpoint(e), FRONT_STREET_MAX_DISTANCE_FT)));
    } catch (e) { streetsOk = false; fail("DCM Street Center Line", e); }
    const edges: LotEdge[] = classifyEdges(geometry.ring2263, neighbors2263, streetsByEdge);
    site.edges = streetsOk ? edges : edges.map((e) => ({ ...e, kind: "unknown", street: null }));
    lotFailed = lotFailed || !streetsOk;
  }
  onStep("lot", lotFailed ? "error" : "done");

  // 3. zoning layers (cross-check against PLUTO happens in the engine)
  onStep("districts", "running");
  if (geometry) {
    const d = await getDistrictsDetailed(geometry.ring2263, geometry.ring4326);
    site.districts = d.hits;
    for (const er of d.errors) site.errors.push(er);
    onStep("districts", d.errors.length ? "error" : "done");
  } else {
    onStep("districts", "error");
  }
  return site;
}
