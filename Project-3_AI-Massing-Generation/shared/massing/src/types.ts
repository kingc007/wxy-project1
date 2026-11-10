// Massing engine contract. Owner: Project 3 manager. Spec: Project-3_AI-Massing-Generation/_manager/engine-spec.md
// Units: feet, square feet, cubic feet. Local frame: x east, y north, z up (same as ZoningEnvelope.lot.polygonLocal).
// Pure data only — no class instances, so options can cross Web Worker boundaries and be stored in IndexedDB.

export type Vec2 = [number, number];
/** One polygon: outer ring CCW, holes CW, rings unclosed. */
export interface Polygon {
  outer: Vec2[];
  holes: Vec2[][];
}
export type MultiPolygon = Polygon[];

export type Program = "residential" | "commercial" | "community_facility";
export const PROGRAMS: readonly Program[] = ["residential", "commercial", "community_facility"] as const;

// ---------- Envelope model (derived from a ZoningEnvelope v1.0.0) ----------
export type EdgeKind = "front" | "side" | "rear" | "unknown";
export type StreetWidth = "wide" | "narrow" | "unknown";

export interface Citation {
  source: string;
  section: string;
  url: string | null;
  quote: string;
  effectiveDate?: string | null;
  researchNote?: string | null;
}

/** A usable numeric control (status cited/data/computed/assumed/overridden, non-null value). */
export interface Control {
  path: string; // e.g. "/controls/maxBuildingHeight"
  label: string; // designer language, e.g. "Max building height"
  value: number;
  unit: "ft" | "sf" | "ratio" | "percent" | "stories" | "count";
  status: "cited" | "data" | "computed" | "assumed" | "overridden";
  citations: Citation[];
  note?: string | null;
}

/** A control present in the envelope but not usable for geometry (needs_input / manual / not_applicable / null). */
export interface UncheckedControl {
  path: string;
  label: string;
  status: string;
  /** not_applicable -> compliance "na" row (reason carries the control's note); the others -> Review. */
  kind: "not_applicable" | "needs_input" | "manual" | "not_modelled";
  reason: string;
}

export interface EnvelopeEdge {
  index: number;
  a: Vec2;
  b: Vec2;
  kind: EdgeKind;
  streetWidth: StreetWidth | null;
  length: number;
}

export interface SetbackRule {
  id: string;
  edgeIndices: number[];
  startHeight: Control;
  depth: Control;
}
export interface SkyExposureRule {
  id: string;
  edgeIndices: number[];
  startHeight: Control;
  slope: Control; // vertical per horizontal
  initialSetback: Control | null;
}

export interface EnvelopeModel {
  envelopeId: string;
  sample: boolean;
  simplified: boolean;
  simplifications: string[];
  lot: Polygon;
  /** Lot area used for zoning ratios (FAR, coverage, open space): the envelope's recorded lot area when present, else the polygon's. */
  lotArea: number;
  lotAreaSource: "data" | "polygon";
  /** Area of the drawn lot outline (`lot`), in sf. */
  polygonArea: number;
  edges: EnvelopeEdge[];
  frontageEdgeIndex: number;
  /** Usable controls, keyed by schema path. */
  maxFar: Partial<Record<Program, Control>>;
  maxBuildingHeight: Control | null;
  maxStories: Control | null;
  baseHeightMin: Control | null;
  baseHeightMax: Control | null;
  lotCoverageMax: Control | null;
  yards: { front: Control | null; rear: Control | null; side: Control | null };
  setbacks: SetbackRule[];
  skyExposure: SkyExposureRule[];
  unchecked: UncheckedControl[];
  notes: string[];
  /** Heights where sectionAt() changes; used to draw the envelope wireframe. */
  breakHeights: number[];
}

// ---------- Program schedule & assumptions (AI-parsed, user-confirmed) ----------
export type ValueSource = "brief" | "inferred" | "default" | "user";

export interface ProgramUse {
  use: Program;
  targetGfa: number | null; // sf
  targetUnits: number | null; // residential only
  floors: number | null; // explicit floor count, if the brief says so
  placement: "ground" | "lower" | "upper" | "any";
  source: ValueSource;
  accepted: boolean;
}

export interface DesignMove {
  text: string; // as phrased in the brief
  kind: "step_toward" | "courtyard" | "tower" | "street_wall" | "passage" | "other";
  direction: "north" | "south" | "east" | "west" | "front" | "rear" | "left" | "right" | null;
}

export interface ProgramSchedule {
  uses: ProgramUse[];
  groundFloorUse: Program;
  openSpaceTargetPct: number | null;
  publicCourtyard: boolean;
  moves: DesignMove[];
  confirmed: boolean;
}

export interface AssumedValue {
  value: number;
  source: ValueSource;
  rationale: string;
}
export interface Assumptions {
  floorToFloor: Record<Program, AssumedValue>; // ft
  groundFloorHeight: AssumedValue; // ft
  avgUnitNetSf: AssumedValue; // sf
  efficiency: AssumedValue; // net / gross, 0–1
}

// ---------- Parametric grammar ----------
export type Typology =
  | "podium_tower"
  | "perimeter_courtyard"
  | "stepped_terraces"
  | "slab_bar"
  | "split_massing"
  | "carved_volume";
export type TypologyLabel = Typology | "block";

export interface MassingParams {
  baseFloors: number;
  baseDepth: number;
  parts: number;
  gapWidth: number;
  ringDepth: number;
  upperMode: "none" | "extrude" | "tower";
  upperFloors: number;
  towerCoverage: number; // percent of lot area, 8–45
  towerAspect: number;
  towerU: number;
  towerV: number;
  towerRotation: number; // degrees
  stepEvery: number;
  stepDepth: number;
  stepFrom: "front" | "rear" | "left" | "right";
  carveWidth: number;
  carveDepth: number;
  carveU: number;
  carveFromFloor: number;
  carveSide: "front" | "rear";
  heightBias: number;
  clipToEnvelope: boolean;
}

export interface ParamSpec {
  key: keyof MassingParams;
  label: string;
  unit: string;
  kind: "int" | "number" | "enum" | "bool";
  min?: number;
  max?: number;
  step?: number;
  options?: readonly string[];
  typological: boolean;
  help: string;
}

// ---------- Engine output ----------
export interface FloorPlate {
  index: number;
  z: number; // bottom elevation
  height: number;
  program: Program;
  polygons: MultiPolygon;
  area: number;
  perimeter: number;
  desiredArea: number; // before envelope clipping
  trimmedArea: number;
}

export interface Prism {
  id: string;
  polygon: Polygon;
  z0: number;
  z1: number;
  program: Program;
  floors: number[]; // floor indices merged into this prism
}

export interface Metrics {
  lotArea: number;
  gfa: number;
  gfaByProgram: Record<Program, number>;
  zfa: number;
  far: number;
  farByProgram: Record<Program, number>;
  floors: number;
  height: number;
  footprint: number;
  lotCoveragePct: number;
  openSpacePct: number;
  facadeArea: number;
  facadePerGfa: number;
  volume: number;
  compactness: number;
  unitsEst: number;
  streetWallHeight: number;
  trimmedVolume: number;
  courtyardSunHours: number | null; // filled by sun module when requested
}

/** "na" = the envelope marks the control not_applicable; shown for transparency, excluded from the overall status. */
export type RuleStatus = "pass" | "fail" | "review" | "na";
export interface ComplianceRow {
  id: string;
  rule: string; // designer label
  shortRule: string; // compact label for boards and tiles, e.g. "FAR · residential"
  allowed: string; // formatted, e.g. "85 ft"
  allowedValue: number | null;
  proposed: string;
  proposedValue: number | null;
  status: RuleStatus;
  detail: string | null; // e.g. "Floor 9 crosses the setback by 120 sf"
  citations: Citation[];
  simplified: boolean;
}

export interface ProgramFitRow {
  use: Program | "units";
  target: number;
  proposed: number;
  deltaPct: number;
  met: boolean; // within ±5 %
}

export interface MassingOption {
  id: string;
  typology: TypologyLabel;
  params: MassingParams;
  floors: FloorPlate[];
  prisms: Prism[];
  metrics: Metrics;
  compliance: ComplianceRow[];
  overall: { status: Exclude<RuleStatus, "na">; failCount: number; reviewCount: number; label: string };
  programFit: ProgramFitRow[];
  notes: string[];
}
