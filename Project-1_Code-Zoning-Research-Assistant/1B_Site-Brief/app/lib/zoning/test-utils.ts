// SAMPLE fixtures for engine tests: PLUTO values are verified (research/test-parcels.md, version 26v2);
// geometry, street data and zoning-layer shares are hand-made SAMPLE data.
import type { DataProvenance, DistrictHit, LotEdge, PlutoLot, SiteData } from "../types";

export const FETCHED = "2026-10-25T12:00:00.000Z";

export function prov(dataset: string, field: string | null, rawValue?: unknown): DataProvenance {
  return { dataset, version: dataset === "PLUTO" ? "26v2" : null, field, rawValue, url: null, fetchedAt: FETCHED };
}

export interface LotSpec {
  bbl: string;
  address: string;
  lotArea: number;
  lotFront: number;
  lotDepth: number;
  lotType: number;
  zoneDist: string[];
  overlays?: string[];
  specialDistricts?: string[];
  landmark?: string | null;
  histDist?: string | null;
  irrLot?: boolean;
}

export const LOTS: Record<string, LotSpec> = {
  L1: { bbl: "1020500004", address: "287 CONVENT AVENUE", lotArea: 4675, lotFront: 46.75, lotDepth: 100, lotType: 5, zoneDist: ["R6A"] },
  L2: { bbl: "1003450002", address: "152 ATTORNEY STREET", lotArea: 2500, lotFront: 25, lotDepth: 100, lotType: 5, zoneDist: ["R7A"] },
  L3: { bbl: "3039730022", address: "261 SHEPHERD AVENUE", lotArea: 5000, lotFront: 50, lotDepth: 100, lotType: 5, zoneDist: ["R8A"] },
  L4: { bbl: "2022720049", address: "501 EAST 145 STREET", lotArea: 2498, lotFront: 25, lotDepth: 99.93, lotType: 3, zoneDist: ["R6"], overlays: ["C1-4"] },
  L5: { bbl: "1003720008", address: "270 EAST 3 STREET", lotArea: 2021, lotFront: 23.25, lotDepth: 86.92, lotType: 3, zoneDist: ["R7A"], overlays: ["C2-5"] },
  L6: { bbl: "1003980028", address: "196 EAST 3 STREET", lotArea: 2568, lotFront: 24.25, lotDepth: 105.92, lotType: 5, zoneDist: ["R7A", "R8B"], overlays: ["C1-5"] },
  L7: { bbl: "2027570124", address: "1039 LOWELL STREET", lotArea: 2500, lotFront: 25, lotDepth: 100, lotType: 5, zoneDist: ["M1-1", "R7-1"] },
  L8: { bbl: "1007330055", address: "430 WEST 36 STREET", lotArea: 2513, lotFront: 25, lotDepth: 98.75, lotType: 5, zoneDist: ["R8A"], overlays: ["C2-5"], specialDistricts: ["HY"] },
  L9: { bbl: "2025500028", address: "618 EAST 138 STREET", lotArea: 5000, lotFront: 50, lotDepth: 100, lotType: 5, zoneDist: ["R6"], overlays: ["C1-4"], landmark: "INDIVIDUAL LANDMARK" },
  L10: { bbl: "1004630033", address: "123 2 AVENUE", lotArea: 2500, lotFront: 25, lotDepth: 100, lotType: 5, zoneDist: ["R7A"], overlays: ["C1-5"], histDist: "East Village / Lower East Side Historic District" },
};

export interface SiteOpts {
  /** street width on the front edge: "narrow" (60), "wide" (100), "unknown" */
  street?: "narrow" | "wide" | "unknown";
  /** second front edge (corner lots) */
  cornerStreet?: "narrow" | "wide";
  shares?: Record<string, number>;
  geometry?: boolean;
}

function streetSeg(kind: "narrow" | "wide" | "unknown", name: string) {
  const widthRaw = kind === "wide" ? "100" : kind === "narrow" ? "60" : "Unknown";
  return {
    name,
    widthRaw,
    widthFt: kind === "unknown" ? null : Number(widthRaw),
    wide: kind === "wide" ? true : kind === "narrow" ? false : null,
    distanceFt: 5,
    provenance: prov("DCM Street Center Line", "Streetwidth", widthRaw),
  };
}

/** SAMPLE site around a verified PLUTO row: rectangle, front edge on y=0 (and east edge for corner lots). */
export function makeSite(key: string, o: SiteOpts = {}): SiteData {
  const s = LOTS[key];
  const w = s.lotFront;
  const d = s.lotDepth;
  const ox = 985000;
  const oy = 200000;
  const ring: [number, number][] = [[ox, oy], [ox + w, oy], [ox + w, oy + d], [ox, oy + d]];
  const corner = s.lotType === 3;
  const edges: LotEdge[] = [
    { index: 0, from: ring[0], to: ring[1], lengthFt: w, kind: "front", street: streetSeg(o.street ?? "narrow", "SAMPLE STREET") },
    { index: 1, from: ring[1], to: ring[2], lengthFt: d, kind: corner ? "front" : "side", street: corner ? streetSeg(o.cornerStreet ?? "narrow", "SAMPLE AVENUE") : null },
    { index: 2, from: ring[2], to: ring[3], lengthFt: w, kind: "rear", street: null },
    { index: 3, from: ring[3], to: ring[0], lengthFt: d, kind: "side", street: null },
  ];
  const pp = (f: string, raw?: unknown) => prov("PLUTO", f, raw);
  const pluto: PlutoLot = {
    bbl: s.bbl, borough: null, address: s.address, lotArea: s.lotArea, lotFront: s.lotFront, lotDepth: s.lotDepth,
    bldgArea: null, numFloors: null, zoneDist: s.zoneDist, overlays: s.overlays ?? [], specialDistricts: s.specialDistricts ?? [],
    limitedHeight: null, splitZone: s.zoneDist.length > 1, landmark: s.landmark ?? null, histDist: s.histDist ?? null,
    lotType: s.lotType, irrLot: s.irrLot ?? false, version: "26v2",
    provenance: {
      lotArea: pp("lotarea", s.lotArea), lotFront: pp("lotfront", s.lotFront), lotDepth: pp("lotdepth", s.lotDepth),
      lotType: pp("lottype", s.lotType), zoneDist: pp("zonedist1", s.zoneDist[0]), landmark: pp("landmark"), histDist: pp("histdist"),
      irrLot: pp("irrlotcode"), specialDistricts: pp("spdist1"), overlays: pp("overlay1"),
    },
  };
  const districts: DistrictHit[] = s.zoneDist.map((code) => ({
    code, kind: "base", share: o.shares?.[code] ?? (s.zoneDist.length === 1 ? 1 : null), provenance: prov("DCP Zoning Districts (nyzd)", "ZONEDIST"),
  }));
  return {
    query: s.address,
    geocode: null,
    pluto,
    geometry: o.geometry === false ? null : { bbl: s.bbl, ring2263: ring, ring4326: [], provenance: prov("MapPLUTO (DCP ArcGIS)", "geometry") },
    neighbors4326: [],
    districts,
    edges,
    errors: [],
  };
}
