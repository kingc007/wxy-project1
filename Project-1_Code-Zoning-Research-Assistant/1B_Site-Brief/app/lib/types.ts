// Shared contract for the 1B engine (owned by the manager). Builders implement against these types;
// change them only via the manager.

/** Where a data value came from (dataset field). Mirrors ZoningEnvelope $defs/dataProvenance. */
export interface DataProvenance {
  dataset: string; // e.g. "PLUTO", "MapPLUTO (DCP ArcGIS)", "DCP Zoning Districts (nyzd)", "NYC GeoSearch", "DCM Street Center Line"
  version: string | null; // e.g. "26v2", "PAD 26c"; null when the source exposes none (then say so in UI)
  field: string | null;
  rawValue?: unknown;
  url: string | null;
  fetchedAt: string; // ISO date-time
}

/** A citation to code text. Mirrors ZoningEnvelope $defs/citation (+ lastAmended / claim). */
export interface Citation {
  source: string; // "NYC Zoning Resolution"
  section: string; // "23-22"
  paragraph?: string | null;
  title?: string | null;
  url: string | null;
  effectiveDate?: string | null;
  lastAmended?: string | null; // as printed, e.g. "12/5/2024"
  retrievedAt?: string | null;
  quote: string;
  researchNote?: string | null;
  claim?: number | string | null;
}

export type ValueStatus =
  | "cited" | "data" | "computed" | "assumed" | "overridden"
  | "needs_input" | "not_applicable" | "manual";
export type Confidence = "cited" | "inferred" | "unverified" | "conflicting";
export type Unit = "ft" | "sf" | "ratio" | "percent" | "stories" | "count";

/** Mirrors ZoningEnvelope $defs/provenancedValue. */
export interface PValue {
  value: number | null;
  unit: Unit;
  status: ValueStatus;
  confidence: Confidence;
  citations?: Citation[];
  provenance?: DataProvenance[];
  formula?: string | null;
  inputs?: string[];
  assumptionIds?: string[];
  override?: { originalValue: number | null; by: string | null; at: string | null; reason: string | null } | null;
  note?: string | null;
  /** UI-only: rule id(s) from the rules table and a human "applies because" string. Stripped from the envelope. */
  ruleIds?: string[];
  appliesBecause?: string;
}

// ---------- Sources ----------
export interface GeocodeResult {
  label: string;
  bbl: string; // 10 digits
  lon: number;
  lat: number;
  provenance: DataProvenance;
}

export interface PlutoLot {
  bbl: string;
  borough: string | null;
  address: string | null;
  lotArea: number | null;
  lotFront: number | null;
  lotDepth: number | null;
  bldgArea: number | null;
  numFloors: number | null;
  zoneDist: string[]; // zonedist1..4 non-null, in order
  overlays: string[]; // overlay1..2
  specialDistricts: string[]; // spdist1..3
  limitedHeight: string | null;
  splitZone: boolean | null;
  landmark: string | null;
  histDist: string | null;
  lotType: number | null; // PLUTO code (dictionary 26v2: 3 Corner, 4 Through, 5 Inside, 6 Interior lot ...)
  irrLot: boolean | null;
  version: string | null;
  /** provenance for each normalised field, keyed by the property name above */
  provenance: Record<string, DataProvenance>;
}

export type Ring = [number, number][]; // closed or unclosed; engine normalises

export interface LotGeometry {
  bbl: string;
  ring2263: Ring; // EPSG:2263 feet (outSR=2263)
  ring4326: Ring; // lon/lat for the map
  provenance: DataProvenance;
}

export interface DistrictHit {
  code: string;
  kind: "base" | "commercial_overlay" | "special_purpose" | "limited_height" | "inclusionary_area";
  label?: string | null;
  /** fraction of the lot polygon covered, computed in code (planar, EPSG:2263) */
  share: number | null;
  geometry4326?: Ring[]; // for map display
  provenance: DataProvenance;
}

export interface StreetSegment {
  name: string | null;
  widthRaw: string | null; // DCM `Streetwidth` as returned (string: "100", ">75", "Unknown" ...)
  widthFt: number | null; // parsed when numeric
  wide: boolean | null; // ZR 12-10: wide street = 75 ft or more; '>75' => true; unknown => null
  distanceFt: number;
  provenance: DataProvenance;
}

export interface LotEdge {
  index: number;
  from: [number, number];
  to: [number, number]; // EPSG:2263
  lengthFt: number;
  kind: "front" | "side" | "rear" | "unknown";
  street?: StreetSegment | null;
}

export interface SiteData {
  query: string;
  geocode: GeocodeResult | null;
  pluto: PlutoLot | null;
  geometry: LotGeometry | null;
  neighbors4326: Ring[];
  districts: DistrictHit[];
  edges: LotEdge[];
  errors: { source: string; message: string; cachedAt?: string | null }[];
}

// ---------- Assumptions ----------
export type AssumptionKey =
  | "lotType" // interior | corner | through
  | "street" // primary frontage wide | narrow
  | "within100ftWideStreet" // boolean
  | "buildingType" // attached | semi_detached | detached | ...
  | "program" // standard | qualifying_affordable | qualifying_residential_site
  | "intendedUse" // residential | commercial | community_facility | manufacturing | mixed
  | "siteCategory"; // standard | eligible_site (ZR 23-434)

export interface Assumption {
  id: string;
  key: AssumptionKey;
  value: string | boolean;
  statement: string; // "Assumed interior lot (not corner)"
  reason: string; // "PLUTO lottype = 5 (Inside)"
  state: "proposed" | "accepted" | "rejected" | "overridden";
  options: (string | boolean)[];
  confidence: Confidence;
  provenance?: DataProvenance[];
  citations?: Citation[];
}

export interface ReviewFlag {
  kind:
    | "landmark" | "historic_district" | "special_district" | "split_lot" | "irregular_lot"
    | "pending_rezoning" | "unsupported_district" | "manual_geometry" | "data_conflict" | "other";
  message: string;
  citations?: Citation[];
  provenance?: DataProvenance[];
}

// ---------- Rules table (shared/rules/nyc-zr-*.json) ----------
export interface RuleWhen {
  lotType?: ("interior" | "corner" | "through")[];
  street?: "wide" | "narrow";
  within100ftWideStreet?: boolean;
  program?: "standard" | "qualifying_affordable";
  buildingType?: string | string[];
  lotWidthLt?: number;
  lotWidthGte?: number;
  siteCategory?: "standard" | "eligible_site";
  underlyingDistrict?: string[];
}
export interface Rule {
  id: string;
  districts: string[];
  field: string;
  value: number;
  unit: Unit;
  when: RuleWhen;
  citation: Citation & { claim: number | string; researchNote: string };
  note?: string | null;
}
