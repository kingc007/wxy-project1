// PLUTO via Socrata (dataset 64uk-42ks). Verified: research/test-parcels.md claims 1-2, 4-7, L1-L10.
// Socrata omits null keys, returns numbers as strings, and splitzone/irrlotcode as booleans.
import type { DataProvenance, PlutoLot } from "@/lib/types";
import { fetchJson } from "./http";

export const PLUTO_URL = "https://data.cityofnewyork.us/resource/64uk-42ks.json";

type Row = Record<string, unknown>;

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}
function bool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === "Y" || v === "true" || v === "t") return true;
  if (v === "N" || v === "false" || v === "f") return false;
  return null;
}

export function parsePlutoRow(row: Row, bbl: string, url: string, fetchedAt: string): PlutoLot {
  const version = str(row.version);
  const provenance: Record<string, DataProvenance> = {};
  const prov = (key: string, field: string, rawValue: unknown) => {
    provenance[key] = { dataset: "PLUTO", version, field, rawValue, url, fetchedAt };
  };
  const pick = (key: string, field: string) => {
    prov(key, field, row[field]);
    return row[field];
  };
  const list = (key: string, fields: string[]) => {
    const vals = fields.map((f) => str(row[f]));
    prov(key, fields.join(","), fields.map((f) => row[f] ?? null));
    return vals.filter((v): v is string => v !== null);
  };

  const lot: PlutoLot = {
    bbl,
    borough: str(pick("borough", "borough")),
    address: str(pick("address", "address")),
    lotArea: num(pick("lotArea", "lotarea")),
    lotFront: num(pick("lotFront", "lotfront")),
    lotDepth: num(pick("lotDepth", "lotdepth")),
    bldgArea: num(pick("bldgArea", "bldgarea")),
    numFloors: num(pick("numFloors", "numfloors")),
    zoneDist: list("zoneDist", ["zonedist1", "zonedist2", "zonedist3", "zonedist4"]),
    overlays: list("overlays", ["overlay1", "overlay2"]),
    specialDistricts: list("specialDistricts", ["spdist1", "spdist2", "spdist3"]),
    limitedHeight: str(pick("limitedHeight", "ltdheight")),
    splitZone: bool(pick("splitZone", "splitzone")),
    landmark: str(pick("landmark", "landmark")),
    histDist: str(pick("histDist", "histdist")),
    lotType: num(pick("lotType", "lottype")),
    irrLot: bool(pick("irrLot", "irrlotcode")),
    version,
    provenance,
  };
  return lot;
}

export async function getPluto(bbl: string): Promise<PlutoLot> {
  if (!/^[1-5]\d{9}$/.test(bbl)) throw new Error(`Invalid BBL: ${bbl}`);
  const url = `${PLUTO_URL}?$where=${encodeURIComponent(`bbl=${bbl}`)}`;
  const res = await fetchJson<Row[]>(url, { source: "PLUTO" });
  if (!Array.isArray(res.body) || res.body.length === 0) throw new Error(`No PLUTO row for BBL ${bbl}`);
  return parsePlutoRow(res.body[0], bbl, url, res.fetchedAt);
}
