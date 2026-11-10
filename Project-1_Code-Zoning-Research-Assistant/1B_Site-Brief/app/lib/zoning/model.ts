// Types local to the zoning engine (lib/zoning). Contract types live in ../types.ts (manager-owned).
import type {
  Assumption, AssumptionKey, Citation, PValue, ReviewFlag, Rule, RuleWhen, Unit,
} from "../types";

/** AssumptionKey extended locally with `siteCategory` until the manager adds it to types.ts. */
export type ExtAssumptionKey = AssumptionKey | "siteCategory";

export type RuleWhenExt = RuleWhen & { siteCategory?: string; underlyingDistrict?: string[] };
export type ExtRule = Omit<Rule, "when"> & { when: RuleWhenExt };

export interface RuleFile {
  jurisdiction: string;
  code: string;
  source: string;
  retrieved: string;
  districtsCovered: string[];
  provenanceRule: string;
  rules: ExtRule[];
  residentialEquivalents?: { district: string; residentialEquivalent: string; citation: Citation }[];
  commercialOverlays?: { overlays: string[]; rule: string; citation: Citation };
  splitLot?: {
    farMethod: "area_weighted";
    citation: Citation;
    heightSetback?: { rule: string; citation: Citation };
    portions?: { citation: Citation };
  };
}

/** Context the rule matcher compares against each rule's `when`. Undefined = unknown (never matches a condition). */
export interface RuleContext {
  lotType?: "interior" | "corner" | "through";
  street?: "wide" | "narrow";
  within100ftWideStreet?: boolean;
  program?: "standard" | "qualifying_affordable";
  buildingType?: string;
  siteCategory?: string;
  underlyingDistrict?: string;
  lotWidth?: number | null;
}

export type StreetKind = "wide" | "narrow";
export type IntendedUse = "residential" | "commercial" | "community_facility" | "manufacturing" | "mixed";

export interface SetbackPlane {
  id: string;
  appliesTo: "wide_street_frontage" | "narrow_street_frontage" | "street_frontage" | "rear" | "side";
  edgeIndices?: number[];
  startHeight: PValue;
  depth: PValue;
}

export interface SkyExposurePlane {
  id: string;
  appliesTo: "wide_street_frontage" | "narrow_street_frontage" | "street_frontage";
  edgeIndices?: number[];
  startHeight: PValue;
  initialSetback: PValue;
  slopeVerticalPerHorizontal: PValue;
}

export interface Controls {
  intendedUse: IntendedUse | null;
  programs: string[];
  maxFar: Record<string, PValue>;
  maxFloorArea: Record<string, PValue>;
  baseHeight: { min: PValue; max: PValue };
  maxBuildingHeight: PValue;
  maxStories: PValue;
  setbacks: SetbackPlane[];
  yards: { front: PValue; rear: PValue; side: PValue };
  lotCoverage: { max: PValue };
  skyExposure: { status: "implemented" | "not_applicable" | "manual"; note?: string | null; planes: SkyExposurePlane[] };
}

export interface Calculation { id: string; label: string; pvalue: PValue }
export interface BulkRow { rule: string; label: string; value: PValue }

export interface SplitPortion {
  districtCodes: string[];
  share: number | null;
  controls: Controls;
  calculations: Calculation[];
}

export interface BriefInput {
  intendedUse: IntendedUse;
  programs: string[]; // "qualifying_affordable" | "qualifying_residential_site"
  overrides?: Record<string, string | boolean>;
  verifiedBy?: string;
  /** ISO date-time; injectable for deterministic output */
  now?: string;
  /** true when the SiteData is synthetic */
  sample?: boolean;
}

export interface ValidationResult { valid: boolean; errors: string[] }

export type EnvelopeJson = Record<string, unknown>;

export interface ZoningBrief {
  assumptions: Assumption[];
  flags: ReviewFlag[];
  controls: Controls;
  calculations: Calculation[];
  bulkTable: BulkRow[];
  /** farMethod is brief-only (the envelope schema's splitLot has no such key) */
  splitLot: { isSplit: boolean; farMethod?: "area_weighted"; portions: SplitPortion[] };
  envelope: EnvelopeJson;
  validation: ValidationResult;
}

export type { Assumption, Citation, PValue, Unit };
