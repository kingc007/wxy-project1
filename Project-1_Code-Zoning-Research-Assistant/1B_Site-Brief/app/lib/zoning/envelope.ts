import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "../../schemas/zoning-envelope.schema.json";
import type { Assumption, Citation, DataProvenance, LotEdge, PValue, ReviewFlag, SiteData } from "../types";
import type { Controls, EnvelopeJson, SplitPortion, ValidationResult } from "./model";
import type { LocalGeometry } from "./geometry";
import { PLUTO_KEYS, plutoProv } from "./site-helpers";

export const GENERATOR = { name: "WXY Site Brief zoning engine", version: "0.1.0" };

export const SIMPLIFICATIONS = [
  "Street setbacks applied at max base height",
  "Rear yard step at 75 ft modelled as a setback plane",
  "Six-story limit in ZR 23-736 not modelled",
  "Lot width taken as PLUTO lot frontage",
  "Eligible-site, special-district, landmark and historic-district rules not modelled",
];

const UI_ONLY_KEYS = new Set(["ruleIds", "appliesBecause"]);

export function toSchemaCitation(c: Citation): Record<string, unknown> {
  const out: Record<string, unknown> = { source: c.source, section: c.section, quote: c.quote };
  const title = [c.title, c.lastAmended ? `Last amended ${c.lastAmended}` : null].filter(Boolean).join(" — ");
  if (c.paragraph !== undefined) out.paragraph = c.paragraph;
  if (title) out.title = title;
  if (c.url !== undefined) out.url = c.url;
  if (c.effectiveDate !== undefined) out.effectiveDate = c.effectiveDate;
  if (c.retrievedAt !== undefined) out.retrievedAt = c.retrievedAt;
  if (c.researchNote !== undefined) out.researchNote = c.researchNote;
  return out;
}

/** Deep copy for the envelope: strips UI-only keys and maps citations to the schema shape. */
export function toSchemaJson(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(toSchemaJson);
  if (x && typeof x === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      if (v === undefined || UI_ONLY_KEYS.has(k)) continue;
      out[k] = k === "citations" && Array.isArray(v) ? (v as Citation[]).map(toSchemaCitation) : toSchemaJson(v);
    }
    return out;
  }
  return x;
}

/** JSON-pointer-like paths of controls that depend on each assumption id. */
export function assumptionAffects(controls: unknown): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  const walk = (node: unknown, path: string) => {
    if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${path}/${i}`));
    if (node && typeof node === "object") {
      const o = node as Record<string, unknown>;
      if (Array.isArray(o.assumptionIds) && "status" in o && "unit" in o) {
        for (const id of o.assumptionIds as string[]) (map[id] ??= []).push(path);
      }
      for (const [k, v] of Object.entries(o)) if (typeof v === "object") walk(v, `${path}/${k}`);
    }
  };
  walk(controls, "/controls");
  return map;
}

function dedupeProv(ps: DataProvenance[]): DataProvenance[] {
  const seen = new Set<string>();
  return ps.filter((p) => {
    const k = JSON.stringify(p);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export interface EnvelopeArgs {
  site: SiteData;
  geometry: LocalGeometry | null;
  edges: LotEdge[];
  primaryEdgeIndex: number | null;
  lot: { area: PValue; frontage: PValue; depth: PValue };
  assumptions: Assumption[];
  flags: ReviewFlag[];
  controls: Controls;
  split: { isSplit: boolean; portions: SplitPortion[] };
  now: string;
  sample: boolean;
  verifiedBy?: string;
}

export function buildEnvelope(a: EnvelopeArgs): EnvelopeJson {
  const { site, geometry } = a;
  const p = site.pluto;
  const bbl = p?.bbl ?? site.geocode?.bbl ?? null;

  // districts
  const districts: { code: string; kind: string; share: number | null; provenance: DataProvenance[] }[] = [];
  for (const d of site.districts) districts.push({ code: d.code, kind: d.kind, share: d.share, provenance: [d.provenance] });
  const fallbackProv = p ? Object.values(p.provenance)[0] : undefined;
  const addFromPluto = (codes: string[], kind: string, keys: readonly string[]) => {
    for (const code of codes) {
      if (districts.some((d) => d.code === code && d.kind === kind)) continue;
      const pr = plutoProv(p, ...keys) ?? fallbackProv;
      if (pr) districts.push({ code, kind, share: null, provenance: [pr] });
    }
  };
  addFromPluto(p?.zoneDist ?? [], "base", PLUTO_KEYS.zoneDist);
  addFromPluto(p?.overlays ?? [], "commercial_overlay", PLUTO_KEYS.overlays);
  addFromPluto(p?.specialDistricts ?? [], "special_purpose", PLUTO_KEYS.specialDistricts);
  if (p?.landmark) addFromPluto([p.landmark], "landmark", PLUTO_KEYS.landmark);
  if (p?.histDist) addFromPluto([p.histDist], "historic_district", PLUTO_KEYS.histDist);

  // lot type
  const lt = a.assumptions.find((x) => x.key === "lotType");
  const ltValue = lt && (lt.value === "interior" || lt.value === "corner" || lt.value === "through") ? lt.value : null;

  const affects = assumptionAffects(a.controls);
  const assumptionsOut = a.assumptions.map((x) => ({
    id: x.id,
    statement: x.statement,
    reason: x.reason,
    state: x.state,
    ...(x.state === "overridden" ? { overrideValue: x.value } : {}),
    ...(affects[x.id]?.length ? { affects: affects[x.id] } : {}),
    ...(x.citations?.length ? { citations: x.citations } : {}),
    ...(x.provenance?.length ? { provenance: x.provenance } : {}),
  }));

  const datasets = dedupeProv([
    ...(p ? Object.values(p.provenance) : []),
    ...(site.geometry ? [site.geometry.provenance] : []),
    ...(site.geocode ? [site.geocode.provenance] : []),
    ...site.districts.map((d) => d.provenance),
    ...a.edges.flatMap((e) => (e.street ? [e.street.provenance] : [])),
  ]);
  const notes = [
    "Draft for review by a licensed professional; not a zoning determination.",
    ...(a.verifiedBy ? [`Reviewed by ${a.verifiedBy}`] : []),
  ];

  const env: Record<string, unknown> = {
    schemaVersion: "1.0.0",
    envelopeId: `site-brief-${bbl ?? "unknown"}-${a.now}`,
    generatedAt: a.now,
    generator: GENERATOR,
    flags: { draft: true, sample: a.sample, simplified: true, simplifications: SIMPLIFICATIONS },
    jurisdiction: {
      id: "nyc",
      name: "New York City",
      code: {
        name: "NYC Zoning Resolution",
        versionLabel: "zr.planning.nyc.gov — sections as last amended (per-citation lastAmended)",
        url: "https://zr.planning.nyc.gov",
      },
    },
    site: {
      parcelId: bbl ?? "unknown",
      bbl: bbl && /^[1-5][0-9]{9}$/.test(bbl) ? bbl : null,
      address: p?.address ?? site.geocode?.label ?? null,
      borough: p?.borough ?? null,
    },
    lot: {
      crs: { reference: "EPSG:2263", lengthUnit: "ft" },
      origin: geometry?.origin ?? { x: 0, y: 0 },
      polygonLocal: geometry?.polygonLocal ?? [],
      polygonReference: geometry?.polygonReference ?? null,
      ...(site.geometry ? { geometrySource: site.geometry.provenance } : {}),
      area: a.lot.area,
      frontage: a.lot.frontage,
      depth: a.lot.depth,
      lotType: {
        value: ltValue,
        status: ltValue === null ? "needs_input" : lt?.state === "overridden" ? "overridden" : "assumed",
        ...(lt?.provenance?.length ? { provenance: lt.provenance } : {}),
        assumptionIds: ["lotType"],
      },
      edges: a.edges.map((e) => ({
        index: e.index,
        kind: e.kind,
        ...(e.street
          ? {
              street: {
                name: e.street.name,
                width: e.street.wide === true ? "wide" : e.street.wide === false ? "narrow" : "unknown",
                ...(e.index === a.primaryEdgeIndex ? { assumptionIds: ["street"] } : {}),
              },
            }
          : {}),
      })),
    },
    districts,
    ...(a.split.isSplit
      ? {
          splitLot: {
            isSplit: true,
            portions: a.split.portions.map((q) => ({ districtCodes: q.districtCodes, share: q.share, polygonLocal: null, controls: q.controls })),
          },
        }
      : {}),
    controls: a.controls,
    assumptions: assumptionsOut,
    reviewFlags: a.flags,
    provenance: { datasets, notes },
  };
  // toSchemaJson strips UI-only keys + maps citations; JSON round trip drops undefined.
  return JSON.parse(JSON.stringify(toSchemaJson(env))) as EnvelopeJson;
}

let validator: ReturnType<Ajv2020["compile"]> | null = null;
function getValidator() {
  if (!validator) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    validator = ajv.compile(schema);
  }
  return validator;
}

export function validateEnvelope(envelope: unknown): ValidationResult {
  const v = getValidator();
  const valid = v(envelope) as boolean;
  return {
    valid,
    errors: valid ? [] : (v.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? "invalid"}`),
  };
}
