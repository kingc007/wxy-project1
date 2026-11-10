// EnvelopeModel: ZoningEnvelope JSON (canonical schema v1.0.0, owned by Project 1) -> geometry-ready model.
// Spec: _manager/engine-spec.md section 1. Values are never invented: only controls whose status is
// cited/data/computed/assumed/overridden and whose value is a number become Controls; every other control that is
// present in the file is listed in `unchecked[]` and imposes no geometry.
import { difference, makeFrame, ringSignedArea, strip, type Frame } from "./geom2d";
import type {
  Citation,
  Control,
  EdgeKind,
  EnvelopeEdge,
  EnvelopeModel,
  MultiPolygon,
  Polygon,
  Program,
  SetbackRule,
  SkyExposureRule,
  StreetWidth,
  UncheckedControl,
  Vec2,
} from "./types";
import { PROGRAMS } from "./types";
import { fmtInt } from "./format";

// ---------- minimal raw envelope types (only fields we read) ----------
interface RawCitation {
  source: string;
  section: string;
  url?: string | null;
  quote: string;
  effectiveDate?: string | null;
  researchNote?: string | null;
}
interface RawProv {
  dataset: string;
  version?: string | null;
  field?: string | null;
  rawValue?: unknown;
  url?: string | null;
}
interface RawPV {
  value: number | null;
  unit: Control["unit"];
  status: string;
  citations?: RawCitation[];
  provenance?: RawProv[];
  formula?: string | null;
  note?: string | null;
}
interface RawSetback {
  id: string;
  appliesTo: string;
  edgeIndices?: number[];
  startHeight?: RawPV;
  depth?: RawPV;
  slope?: RawPV;
  initialSetback?: RawPV;
}
export interface RawEnvelope {
  envelopeId: string;
  flags: { sample: boolean; simplified: boolean; simplifications: string[] };
  polygonLocal: Vec2[];
  lotArea?: RawPV;
  edges: { index: number; kind: EdgeKind; width: StreetWidth | null }[];
  maxFar: Record<string, RawPV>;
  baseHeight: { min?: RawPV; max?: RawPV };
  maxBuildingHeight?: RawPV;
  maxStories?: RawPV;
  setbacks: RawSetback[];
  yards: { front?: RawPV; rear?: RawPV; side?: RawPV };
  lotCoverageMax?: RawPV;
  skyExposure: { status: string; note: string | null; planes: RawSetback[] };
}

export class EnvelopeParseError extends Error {
  constructor(path: string, problem: string) {
    super(`${path} ${problem}`);
    this.name = "EnvelopeParseError";
  }
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);

function req(o: unknown, key: string, path: string): unknown {
  if (!isObj(o) || !(key in o)) throw new EnvelopeParseError(`${path}/${key}`, "is missing");
  return o[key];
}

function readPoint(x: unknown, path: string): Vec2 {
  if (!Array.isArray(x) || x.length < 2 || typeof x[0] !== "number" || typeof x[1] !== "number" || !isFinite(x[0]) || !isFinite(x[1]))
    throw new EnvelopeParseError(path, "must be [x, y] numbers");
  return [x[0], x[1]];
}

function readCitation(x: unknown, path: string): RawCitation {
  if (!isObj(x) || typeof x.source !== "string" || typeof x.section !== "string" || typeof x.quote !== "string")
    throw new EnvelopeParseError(path, "must have source, section and quote strings");
  return {
    source: x.source,
    section: x.section,
    url: typeof x.url === "string" ? x.url : null,
    quote: x.quote,
    effectiveDate: typeof x.effectiveDate === "string" ? x.effectiveDate : null,
    researchNote: typeof x.researchNote === "string" ? x.researchNote : null,
  };
}

function readPV(x: unknown, path: string): RawPV | undefined {
  if (x === undefined || x === null) return undefined;
  if (!isObj(x)) throw new EnvelopeParseError(path, "must be an object");
  if (typeof x.status !== "string") throw new EnvelopeParseError(`${path}/status`, "must be a string");
  if (!(x.value === null || typeof x.value === "number")) throw new EnvelopeParseError(`${path}/value`, "must be a number or null");
  if (typeof x.unit !== "string") throw new EnvelopeParseError(`${path}/unit`, "must be a string");
  const citations = Array.isArray(x.citations) ? x.citations.map((c, i) => readCitation(c, `${path}/citations/${i}`)) : undefined;
  const provenance = Array.isArray(x.provenance)
    ? x.provenance.filter(isObj).map((p) => ({
        dataset: String(p.dataset ?? ""),
        version: typeof p.version === "string" ? p.version : null,
        field: typeof p.field === "string" ? p.field : null,
        rawValue: p.rawValue,
        url: typeof p.url === "string" ? p.url : null,
      }))
    : undefined;
  return {
    value: x.value as number | null,
    unit: x.unit as Control["unit"],
    status: x.status,
    citations,
    provenance,
    formula: typeof x.formula === "string" ? x.formula : null,
    note: typeof x.note === "string" ? x.note : null,
  };
}

function readPlane(x: unknown, path: string, sky: boolean): RawSetback {
  if (!isObj(x) || typeof x.id !== "string" || typeof x.appliesTo !== "string") throw new EnvelopeParseError(path, "must have id and appliesTo");
  return {
    id: x.id,
    appliesTo: x.appliesTo,
    edgeIndices: Array.isArray(x.edgeIndices) ? x.edgeIndices.filter((n): n is number => typeof n === "number" && Number.isInteger(n)) : undefined,
    startHeight: readPV(x.startHeight, `${path}/startHeight`),
    depth: sky ? undefined : readPV(x.depth, `${path}/depth`),
    slope: sky ? readPV(x.slopeVerticalPerHorizontal, `${path}/slopeVerticalPerHorizontal`) : undefined,
    initialSetback: sky ? readPV(x.initialSetback, `${path}/initialSetback`) : undefined,
  };
}

/** Runtime guard + projection of an (already schema-validated) ZoningEnvelope JSON onto the fields the engine reads. */
export function parseEnvelope(env: unknown): RawEnvelope {
  if (!isObj(env)) throw new EnvelopeParseError("(root)", "must be an object");
  if (typeof env.envelopeId !== "string") throw new EnvelopeParseError("/envelopeId", "must be a string");
  const flags = req(env, "flags", "") as Obj;
  const lot = req(env, "lot", "") as Obj;
  const controls = req(env, "controls", "") as Obj;
  if (!isObj(flags)) throw new EnvelopeParseError("/flags", "must be an object");
  if (!isObj(lot)) throw new EnvelopeParseError("/lot", "must be an object");
  if (!isObj(controls)) throw new EnvelopeParseError("/controls", "must be an object");

  const poly = req(lot, "polygonLocal", "/lot");
  if (!Array.isArray(poly) || poly.length < 3) throw new EnvelopeParseError("/lot/polygonLocal", "must have at least 3 points");
  const polygonLocal = poly.map((p, i) => readPoint(p, `/lot/polygonLocal/${i}`));
  if (ringSignedArea(polygonLocal) <= 0) throw new EnvelopeParseError("/lot/polygonLocal", "must be counter-clockwise with non-zero area");

  const rawEdges = req(lot, "edges", "/lot");
  if (!Array.isArray(rawEdges) || rawEdges.length !== polygonLocal.length)
    throw new EnvelopeParseError("/lot/edges", "must have one entry per polygonLocal edge");
  const edges = rawEdges.map((e, i) => {
    if (!isObj(e) || !["front", "side", "rear", "unknown"].includes(e.kind as string)) throw new EnvelopeParseError(`/lot/edges/${i}/kind`, "must be front, side, rear or unknown");
    const w = isObj(e.street) ? e.street.width : null;
    const width: StreetWidth | null = w === "wide" || w === "narrow" || w === "unknown" ? w : null;
    return { index: i, kind: e.kind as EdgeKind, width };
  });

  const maxFar: Record<string, RawPV> = {};
  if (isObj(controls.maxFar)) {
    for (const [k, v] of Object.entries(controls.maxFar)) {
      const pv = readPV(v, `/controls/maxFar/${k}`);
      if (pv) maxFar[k] = pv;
    }
  }
  const bh = isObj(controls.baseHeight) ? controls.baseHeight : {};
  const yards = isObj(controls.yards) ? controls.yards : {};
  const lc = isObj(controls.lotCoverage) ? controls.lotCoverage : {};
  const sky = isObj(controls.skyExposure) ? controls.skyExposure : {};
  return {
    envelopeId: env.envelopeId,
    flags: {
      sample: flags.sample === true,
      simplified: flags.simplified === true,
      simplifications: Array.isArray(flags.simplifications) ? flags.simplifications.filter((s): s is string => typeof s === "string") : [],
    },
    polygonLocal,
    lotArea: readPV(lot.area, "/lot/area"),
    edges,
    maxFar,
    baseHeight: { min: readPV(bh.min, "/controls/baseHeight/min"), max: readPV(bh.max, "/controls/baseHeight/max") },
    maxBuildingHeight: readPV(controls.maxBuildingHeight, "/controls/maxBuildingHeight"),
    maxStories: readPV(controls.maxStories, "/controls/maxStories"),
    setbacks: Array.isArray(controls.setbacks) ? controls.setbacks.map((s, i) => readPlane(s, `/controls/setbacks/${i}`, false)) : [],
    yards: {
      front: readPV(yards.front, "/controls/yards/front"),
      rear: readPV(yards.rear, "/controls/yards/rear"),
      side: readPV(yards.side, "/controls/yards/side"),
    },
    lotCoverageMax: readPV(lc.max, "/controls/lotCoverage/max"),
    skyExposure: {
      status: typeof sky.status === "string" ? sky.status : "not_applicable",
      note: typeof sky.note === "string" ? sky.note : null,
      planes: Array.isArray(sky.planes) ? sky.planes.map((s, i) => readPlane(s, `/controls/skyExposure/planes/${i}`, true)) : [],
    },
  };
}

// ---------- controls ----------
const USABLE = new Set(["cited", "data", "computed", "assumed", "overridden"]);

function citationsOf(pv: RawPV): Citation[] {
  const out: Citation[] = (pv.citations ?? []).map((c) => ({
    source: c.source,
    section: c.section,
    url: c.url ?? null,
    quote: c.quote,
    effectiveDate: c.effectiveDate ?? null,
    researchNote: c.researchNote ?? null,
  }));
  for (const p of pv.provenance ?? []) {
    out.push({
      source: p.dataset,
      section: p.field ?? p.version ?? "",
      url: p.url ?? null,
      quote: p.rawValue !== undefined ? `${p.field ?? "value"} = ${JSON.stringify(p.rawValue)}` : "",
    });
  }
  if (pv.status === "computed" && pv.formula) out.push({ source: "Computed", section: "formula", url: null, quote: pv.formula });
  return out;
}

type Resolved = { control: Control; unchecked?: undefined } | { control?: undefined; unchecked: UncheckedControl } | { control?: undefined; unchecked?: undefined };

function resolve(pv: RawPV | undefined, path: string, label: string): Resolved {
  if (!pv) return {};
  if (USABLE.has(pv.status) && typeof pv.value === "number" && isFinite(pv.value)) {
    return {
      control: {
        path,
        label,
        value: pv.value,
        unit: pv.unit,
        status: pv.status as Control["status"],
        citations: citationsOf(pv),
        note: pv.note ?? null,
      },
    };
  }
  if (pv.status === "not_applicable")
    return { unchecked: { path, label, status: pv.status, kind: "not_applicable", reason: pv.note ?? "Not applicable" } };
  const reason = USABLE.has(pv.status) ? "Not checked — no value" : `Not checked — ${pv.status}`;
  const kind = pv.status === "manual" ? "manual" : "needs_input";
  return { unchecked: { path, label, status: USABLE.has(pv.status) ? "no_value" : pv.status, kind, reason } };
}

// ---------- model ----------
const LABELS = {
  far: "Floor area ratio (FAR)",
  height: "Max building height",
  stories: "Max stories",
  baseMin: "Base height (street wall), min",
  baseMax: "Base height (street wall), max",
  coverage: "Lot coverage",
  front: "Front yard",
  rear: "Rear yard",
  side: "Side yards",
  setback: "Setback above base height",
  sep: "Sky exposure plane",
} as const;

function edgeLen(a: Vec2, b: Vec2): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function resolveEdges(
  appliesTo: string,
  explicit: number[] | undefined,
  edges: EnvelopeEdge[],
  notes: string[],
  id: string,
): number[] {
  if (explicit && explicit.length) {
    const ok = explicit.filter((i) => i >= 0 && i < edges.length);
    if (ok.length !== explicit.length) notes.push(`Rule "${id}" lists edge indices outside the lot; those were ignored.`);
    return [...new Set(ok)].sort((a, b) => a - b);
  }
  const out: number[] = [];
  let unknownMatched = false;
  for (const e of edges) {
    let hit = false;
    if (appliesTo === "street_frontage") hit = e.kind === "front";
    else if (appliesTo === "wide_street_frontage" || appliesTo === "narrow_street_frontage") {
      if (e.kind === "front") {
        const want = appliesTo === "wide_street_frontage" ? "wide" : "narrow";
        if (e.streetWidth === want) hit = true;
        else if (e.streetWidth === "unknown" || e.streetWidth === null) {
          hit = true;
          unknownMatched = true;
        }
      }
    } else if (appliesTo === "rear") hit = e.kind === "rear";
    else if (appliesTo === "side") hit = e.kind === "side";
    if (hit) out.push(e.index);
  }
  if (unknownMatched)
    notes.push(`Rule "${id}" (${appliesTo}): a front edge has unknown street width, so it is treated as matching both wide and narrow (conservative).`);
  if (!out.length) notes.push(`Rule "${id}" (${appliesTo}) matches no lot edge and imposes no geometry.`);
  return out;
}

export function buildEnvelopeModel(envJson: unknown): EnvelopeModel {
  const raw = parseEnvelope(envJson);
  const notes: string[] = [];
  const unchecked: UncheckedControl[] = [];
  const take = (r: Resolved): Control | null => {
    if (r.unchecked) unchecked.push(r.unchecked);
    return r.control ?? null;
  };

  const lot: Polygon = { outer: raw.polygonLocal.map((p) => [p[0], p[1]] as Vec2), holes: [] };
  const polygonArea = ringSignedArea(lot.outer);
  const n = lot.outer.length;
  const edges: EnvelopeEdge[] = raw.edges.map((e, i) => {
    const a = lot.outer[i];
    const b = lot.outer[(i + 1) % n];
    return { index: i, a: [a[0], a[1]], b: [b[0], b[1]], kind: e.kind, streetWidth: e.width, length: edgeLen(a, b) };
  });

  // Lot area: zoning ratios (FAR, coverage, open space) use the recorded lot area when the envelope carries one
  // (e.g. PLUTO lotarea), so they match Site Brief. The drawn outline stays the geometry; it is often a few percent off.
  const la = resolve(raw.lotArea, "/lot/area", "Lot area");
  const lotArea = la.control && la.control.value > 0 ? la.control.value : polygonArea;
  const lotAreaSource: EnvelopeModel["lotAreaSource"] = lotArea === polygonArea ? "polygon" : "data";
  if (la.control && Math.abs(la.control.value - polygonArea) / polygonArea > 0.01)
    notes.push(
      `Lot area from data (${fmtInt(la.control.value)} sf) is used for FAR, coverage and open space; the drawn lot outline measures ${fmtInt(polygonArea)} sf.`,
    );

  // Frontage = longest front edge (ties -> lowest index)
  let frontageEdgeIndex = -1;
  for (const e of edges) if (e.kind === "front" && (frontageEdgeIndex < 0 || e.length > edges[frontageEdgeIndex].length + 1e-9)) frontageEdgeIndex = e.index;
  if (frontageEdgeIndex < 0) {
    frontageEdgeIndex = 0;
    for (const e of edges) if (e.length > edges[frontageEdgeIndex].length + 1e-9) frontageEdgeIndex = e.index;
    notes.push(`No edge is marked front; the longest edge (${frontageEdgeIndex}) is used as the design frame.`);
  }

  // Controls
  const maxFar: Partial<Record<Program, Control>> = {};
  for (const [key, pv] of Object.entries(raw.maxFar)) {
    const r = resolve(pv, `/controls/maxFar/${key}`, `${LABELS.far}, ${key.replace(/_/g, " ")}`);
    if ((PROGRAMS as readonly string[]).includes(key)) {
      const c = take(r);
      if (c) maxFar[key as Program] = c;
    } else if (r.control) {
      unchecked.push({ path: r.control.path, label: r.control.label, status: "not_modelled", kind: "not_modelled", reason: "Not checked — this use or program variant is not modelled" });
    } else take(r);
  }
  const maxBuildingHeight = take(resolve(raw.maxBuildingHeight, "/controls/maxBuildingHeight", LABELS.height));
  const maxStories = take(resolve(raw.maxStories, "/controls/maxStories", LABELS.stories));
  const baseHeightMin = take(resolve(raw.baseHeight.min, "/controls/baseHeight/min", LABELS.baseMin));
  const baseHeightMax = take(resolve(raw.baseHeight.max, "/controls/baseHeight/max", LABELS.baseMax));
  const lotCoverageMax = take(resolve(raw.lotCoverageMax, "/controls/lotCoverage/max", LABELS.coverage));
  const yards = {
    front: take(resolve(raw.yards.front, "/controls/yards/front", LABELS.front)),
    rear: take(resolve(raw.yards.rear, "/controls/yards/rear", LABELS.rear)),
    side: take(resolve(raw.yards.side, "/controls/yards/side", LABELS.side)),
  };

  const setbacks: SetbackRule[] = [];
  raw.setbacks.forEach((s, i) => {
    const start = resolve(s.startHeight, `/controls/setbacks/${i}/startHeight`, `${LABELS.setback}, ${s.id}: start height`);
    const depth = resolve(s.depth, `/controls/setbacks/${i}/depth`, `${LABELS.setback}, ${s.id}: depth`);
    const sc = take(start);
    const dc = take(depth);
    if (!s.startHeight) unchecked.push({ path: `/controls/setbacks/${i}/startHeight`, label: `${LABELS.setback}, ${s.id}`, status: "missing", kind: "needs_input", reason: "Not checked — start height missing" });
    if (!s.depth) unchecked.push({ path: `/controls/setbacks/${i}/depth`, label: `${LABELS.setback}, ${s.id}`, status: "missing", kind: "needs_input", reason: "Not checked — depth missing" });
    if (sc && dc) setbacks.push({ id: s.id, edgeIndices: resolveEdges(s.appliesTo, s.edgeIndices, edges, notes, s.id), startHeight: sc, depth: dc });
  });

  const skyExposure: SkyExposureRule[] = [];
  if (raw.skyExposure.status === "implemented") {
    raw.skyExposure.planes.forEach((s, i) => {
      const sc = take(resolve(s.startHeight, `/controls/skyExposure/planes/${i}/startHeight`, `${LABELS.sep}, ${s.id}: start height`));
      const slope = take(resolve(s.slope, `/controls/skyExposure/planes/${i}/slopeVerticalPerHorizontal`, `${LABELS.sep}, ${s.id}: slope`));
      const init = take(resolve(s.initialSetback, `/controls/skyExposure/planes/${i}/initialSetback`, `${LABELS.sep}, ${s.id}: initial setback`));
      if (!s.startHeight || !s.slope) {
        unchecked.push({ path: `/controls/skyExposure/planes/${i}`, label: `${LABELS.sep}, ${s.id}`, status: "missing", kind: "needs_input", reason: "Not checked — start height or slope missing" });
        return;
      }
      if (sc && slope) {
        if (slope.value <= 0) {
          unchecked.push({ path: slope.path, label: slope.label, status: "invalid", kind: "needs_input", reason: "Not checked — slope must be greater than zero" });
          return;
        }
        skyExposure.push({ id: s.id, edgeIndices: resolveEdges(s.appliesTo, s.edgeIndices, edges, notes, s.id), startHeight: sc, slope, initialSetback: init });
      }
    });
  } else if (raw.skyExposure.status === "manual") {
    unchecked.push({ path: "/controls/skyExposure", label: LABELS.sep, status: "manual", kind: "manual", reason: "Not checked — manual" });
  } else if (raw.skyExposure.status === "not_applicable") {
    unchecked.push({ path: "/controls/skyExposure", label: LABELS.sep, status: "not_applicable", kind: "not_applicable", reason: raw.skyExposure.note ?? "Not applicable" });
  }

  const fe = edges[frontageEdgeIndex];
  if (fe.kind === "front" && fe.streetWidth !== "wide" && fe.streetWidth !== "narrow")
    notes.push("Frontage street width is unknown; the street-wall location test uses 10 ft (the narrow-street distance).");

  // Engine-level simplifications (always stated)
  if (yards.front || yards.rear || yards.side) notes.push("SIMPLIFIED: yards apply at all heights; ground-floor permitted obstructions are not modelled.");
  if (yards.front || yards.rear || yards.side || setbacks.length || skyExposure.length)
    notes.push("SIMPLIFIED: restricted strips extend along the lot line by their depth at convex corners and stop at reflex corners, so irregular lots are approximate.");
  if (skyExposure.length) notes.push("SIMPLIFIED: the sky exposure plane is evaluated at the top of each floor.");
  if ((yards.front || yards.rear || yards.side) && edges.some((e) => e.kind === "unknown"))
    notes.push("Edges of kind 'unknown' receive no yard.");

  const model: EnvelopeModel = {
    envelopeId: raw.envelopeId,
    sample: raw.flags.sample,
    simplified: raw.flags.simplified,
    simplifications: raw.flags.simplifications,
    lot,
    lotArea,
    lotAreaSource,
    polygonArea,
    edges,
    frontageEdgeIndex,
    maxFar,
    maxBuildingHeight,
    maxStories,
    baseHeightMin,
    baseHeightMax,
    lotCoverageMax,
    yards,
    setbacks,
    skyExposure,
    unchecked,
    notes,
    breakHeights: [],
  };
  model.breakHeights = computeBreakHeights(model);
  return model;
}

function computeBreakHeights(m: EnvelopeModel): number[] {
  const s = new Set<number>([0]);
  for (const r of m.setbacks) s.add(r.startHeight.value);
  for (const r of m.skyExposure) s.add(r.startHeight.value);
  if (m.maxBuildingHeight) s.add(m.maxBuildingHeight.value);
  if (m.skyExposure.length) {
    // Sample the plane every 5 ft up to the height cap, or (no usable cap — e.g. the optional SEP regulations) until the
    // section closes. 1,500 ft is the engine's safety cap (engine-spec §2 step 6).
    const top = m.maxBuildingHeight ? m.maxBuildingHeight.value : 1500;
    const from = Math.min(...m.skyExposure.map((r) => r.startHeight.value));
    for (let z = Math.ceil(from / 5) * 5; z < top; z += 5) {
      s.add(z);
      if (!m.maxBuildingHeight && sectionAt(m, z + 5).length === 0) {
        s.add(z + 5);
        break;
      }
    }
  }
  return [...s].filter((z) => z >= 0).sort((a, b) => a - b);
}

// ---------- queries ----------
/** Design frame: u along the frontage edge (p_i -> p_i+1), v = inward normal. */
export function designFrame(m: EnvelopeModel): Frame {
  const e = m.edges[m.frontageEdgeIndex];
  return makeFrame(e.a, e.b);
}

/** Sky-exposure inset (horizontal distance from the lot line) of one plane at height z. */
export function skyExposureInsetAt(rule: SkyExposureRule, z: number): number {
  if (!(z > rule.startHeight.value)) return 0;
  return Math.max(rule.initialSetback?.value ?? 0, (z - rule.startHeight.value) / rule.slope.value);
}

function yardFor(m: EnvelopeModel, e: EnvelopeEdge): number {
  const c = e.kind === "front" ? m.yards.front : e.kind === "rear" ? m.yards.rear : e.kind === "side" ? m.yards.side : null;
  return c ? c.value : 0;
}

/** Horizontal distance from lot line i inward where building is not permitted at height z: max(yard, setback, SEP). */
export function envelopeInsetAt(m: EnvelopeModel, edgeIndex: number, z: number): number {
  const e = m.edges[edgeIndex];
  if (!e) throw new Error(`envelopeInsetAt: no edge ${edgeIndex}`);
  let d = yardFor(m, e);
  for (const r of m.setbacks) if (r.edgeIndices.includes(edgeIndex) && z > r.startHeight.value) d = Math.max(d, r.depth.value);
  for (const r of m.skyExposure) if (r.edgeIndices.includes(edgeIndex)) d = Math.max(d, skyExposureInsetAt(r, z));
  return d;
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

/** Restricted strip of depth d along lot edge i, extended by d at convex vertices and 0 at reflex vertices. */
export function edgeStrip(m: EnvelopeModel, edgeIndex: number, d: number): Polygon {
  const n = m.edges.length;
  const e = m.edges[edgeIndex];
  const p = m.edges[(edgeIndex + n - 1) % n];
  const q = m.edges[(edgeIndex + 1) % n];
  const dir = (x: EnvelopeEdge): Vec2 => [(x.b[0] - x.a[0]) / x.length, (x.b[1] - x.a[1]) / x.length];
  const de = dir(e);
  const dp = dir(p);
  const dq = dir(q);
  const convexA = cross(dp[0], dp[1], de[0], de[1]) > 1e-9;
  const convexB = cross(de[0], de[1], dq[0], dq[1]) > 1e-9;
  return strip(e.a, e.b, d, convexA ? d : 0, convexB ? d : 0);
}

const sectionCache = new WeakMap<EnvelopeModel, Map<string, MultiPolygon>>();

/** Stable key of the buildable section at height z (equal keys => identical section). `null` key => above max height. */
export function sectionKeyAt(m: EnvelopeModel, z: number): string | null {
  if (m.maxBuildingHeight && z > m.maxBuildingHeight.value + 1e-9) return null;
  return m.edges.map((e) => envelopeInsetAt(m, e.index, z).toFixed(6)).join("|");
}

/**
 * Buildable section at height z: lot minus the union of restricted strips; empty above max building height.
 * The returned array is cached and shared - treat as immutable.
 */
export function sectionAt(m: EnvelopeModel, z: number): MultiPolygon {
  const key = sectionKeyAt(m, z);
  if (key === null) return [];
  let cache = sectionCache.get(m);
  if (!cache) {
    cache = new Map();
    sectionCache.set(m, cache);
  }
  const hit = cache.get(key);
  if (hit) return hit;
  const strips: Polygon[] = [];
  for (const e of m.edges) {
    const d = envelopeInsetAt(m, e.index, z);
    if (d > 1e-9) strips.push(edgeStrip(m, e.index, d));
  }
  const res = strips.length ? difference([m.lot], strips) : [m.lot];
  cache.set(key, res);
  return res;
}
