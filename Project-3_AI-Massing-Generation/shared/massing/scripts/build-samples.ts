/* eslint-disable @typescript-eslint/no-explicit-any */
// Builds the three SAMPLE ZoningEnvelopes + the Fort Greene context dataset (Project 3 / 3A).
// Spec: Project-3_AI-Massing-Generation/_manager/sample-envelopes-spec.md
// Run:  npx tsx scripts/build-samples.ts      (exits non-zero on any validation error)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import proj4 from "proj4";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { type Pt, signedArea, round, polygonsIntersect } from "./sample-geom";

const SHARED = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."); // shared/massing
const VAULT = path.resolve(SHARED, "../../.."); // vault root
const NOTE_PATH = path.join(VAULT, "_Shared/research/nyc-zoning-sample-envelope-values.md");
const SCHEMA_PATH = path.join(VAULT, "_Shared/schemas/zoning-envelope.schema.json");
const RAW_DIR = path.resolve(SHARED, "../../3A_Massing-Studio/research/data");
const OUT_SAMPLES = path.join(SHARED, "data/samples");
const OUT_CONTEXT = path.join(SHARED, "data/context-fort-greene.json");

const GENERATED_AT = "2026-10-25T00:00:00Z";
const RETRIEVED = "2026-10-25";
const LAT = 40.689;
const LNG = -73.9755;
// epsg.io/2263.proj4, verbatim (3A research/epsg-2263-proj4.md claim 1)
const EPSG2263 =
  "+proj=lcc +lat_0=40.1666666666667 +lon_0=-74 +lat_1=41.0333333333333 +lat_2=40.6666666666667 +x_0=300000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs +type=crs";
const FOOTPRINT_URL =
  "https://data.cityofnewyork.us/resource/5zhs-2jue.geojson?$where=within_circle(the_geom,40.6890,-73.9755,180)&$limit=1000";
const FOOTPRINT_FETCHED = "2026-10-25T19:37:07Z";
const FOOTPRINT_ROWS_UPDATED = "2026-10-25T08:21:07Z";
const PARK_URL = "https://data.cityofnewyork.us/resource/enfh-gkve.geojson?$where=objectid=169827";
const PARK_FETCHED = "2026-10-25T19:37:08Z";

const toRef = (lon: number, lat: number): Pt => proj4("EPSG:4326", EPSG2263, [lon, lat]) as Pt;
const originRef = toRef(LNG, LAT);
const origin = { x: originRef[0], y: originRef[1] };

// ------------------------------------------------------------------ context
function toLocalRing(ring: number[][]): Pt[] {
  let pts: Pt[] = ring.map(([lon, lat]) => {
    const [x, y] = toRef(lon, lat);
    return [round(x - origin.x), round(y - origin.y)] as Pt;
  });
  const f = pts[0];
  const l = pts[pts.length - 1];
  if (f[0] === l[0] && f[1] === l[1]) pts = pts.slice(0, -1);
  return pts;
}
const ccw = (r: Pt[]) => (signedArea(r) >= 0 ? r : [...r].reverse());
const cw = (r: Pt[]) => (signedArea(r) <= 0 ? r : [...r].reverse());

interface Building {
  bin: number;
  height: number;
  groundElevation: number | null;
  polygon: { outer: Pt[]; holes: Pt[][] };
}

function buildContext() {
  const raw = JSON.parse(fs.readFileSync(path.join(RAW_DIR, "context-footprints-raw.geojson"), "utf8"));
  const buildings: Building[] = [];
  let dropped = 0;
  for (const f of raw.features) {
    const h = Number(f.properties.height_roof);
    if (!Number.isFinite(h) || h <= 0) {
      dropped++;
      continue;
    }
    if (f.geometry.coordinates.length !== 1) throw new Error(`multi-part footprint ${f.properties.bin} not supported`);
    const [outerRaw, ...holesRaw] = f.geometry.coordinates[0] as number[][][];
    const ge = f.properties.ground_elevation == null ? NaN : Number(f.properties.ground_elevation);
    buildings.push({
      bin: Number(f.properties.bin),
      height: h,
      groundElevation: Number.isFinite(ge) ? ge : null,
      polygon: { outer: ccw(toLocalRing(outerRaw)), holes: holesRaw.map((r) => cw(toLocalRing(r))) },
    });
  }
  const parkRaw = JSON.parse(fs.readFileSync(path.join(RAW_DIR, "park-raw.geojson"), "utf8")).features[0];
  if (parkRaw.geometry.coordinates.length !== 1) throw new Error("park has multiple parts");
  const [pOuter, ...pHoles] = parkRaw.geometry.coordinates[0] as number[][][];
  const park = {
    name: parkRaw.properties.name311 as string,
    polygon: { outer: ccw(toLocalRing(pOuter)), holes: pHoles.map((r) => cw(toLocalRing(r))) },
  };
  return { raw, buildings, dropped, park };
}

/** Dominant street-grid angle (deg, [0,90)) per spec: length-weighted histogram of edge directions mod 90,
 *  1-degree bins, box-smoothed +-2 bins (circular), argmax (first max), bin centre. */
export function gridAngle(rings: Pt[][]): number {
  const hist = new Array(90).fill(0);
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % ring.length];
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len === 0) continue;
      let ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
      ang = ((ang % 90) + 90) % 90;
      hist[Math.min(89, Math.floor(ang))] += len;
    }
  }
  let best = 0;
  let bestV = -1;
  for (let i = 0; i < 90; i++) {
    let s = 0;
    for (let d = -2; d <= 2; d++) s += hist[(i + d + 90) % 90];
    if (s > bestV) {
      bestV = s;
      best = i;
    }
  }
  return best + 0.5;
}

// ------------------------------------------------------------------ zoning note citations
const NOTE = fs.readFileSync(NOTE_PATH, "utf8");
const NOTE_LINES = NOTE.split("\n");
const ZR = "https://zr.planning.nyc.gov";
const LA = "Last Amended 12/5/2024";
interface CitDef {
  section: string;
  url: string;
  effectiveDate: string;
  quote: string;
}
const CIT: Record<number, CitDef> = {
  1: { section: "12-10 (street, wide)", url: `${ZR}/article-i/chapter-2/12-10`, effectiveDate: "Last Amended 3/26/2026", quote: `A "wide street" is any street 75 feet or more in width.` },
  3: { section: "12-10 (street, narrow)", url: `${ZR}/article-i/chapter-2/12-10`, effectiveDate: "Last Amended 12/15/1961", quote: `A "narrow street" is any street less than 75 feet wide.` },
  4: { section: "12-10 (lot, corner)", url: `${ZR}/article-i/chapter-2/12-10`, effectiveDate: "Last Amended 3/26/2026 (page 12-10)", quote: `A "corner lot" is either a zoning lot bounded entirely by streets, or a zoning lot which adjoins the point of intersections of two or more streets and in which the interior angle formed by the extensions of the street lines ... forms an angle of 135 degrees or less.` },
  5: { section: "12-10 (lot, interior)", url: `${ZR}/article-i/chapter-2/12-10`, effectiveDate: "Last Amended 3/26/2026 (page 12-10)", quote: `An "interior lot" is any zoning lot neither a corner lot nor a through lot.` },
  6: { section: "12-10 (lot, through)", url: `${ZR}/article-i/chapter-2/12-10`, effectiveDate: "Last Amended 3/26/2026 (page 12-10)", quote: `A "through lot" is any zoning lot, not a corner lot, which adjoins two street lines opposite to each other and parallel or within 45 degrees of being parallel to each other.` },
  8: { section: "12-10 (sky exposure plane building)", url: `${ZR}/article-i/chapter-2/12-10`, effectiveDate: LA, quote: `is located in R6 through R10 Districts without a letter suffix, or in Commercial Districts mapped within, or with a residential equivalent of, R6 through R10 Districts without a letter suffix; ... utilizes the optional bulk regulations set forth in Section 23-73, inclusive, or Section 35-81, inclusive.` },
  10: { section: "23-22", url: `${ZR}/article-ii/chapter-3/23-22`, effectiveDate: LA, quote: `R7A R7-11 R7-21 | 4.00 | 5.01` },
  11: { section: "23-22", url: `${ZR}/article-ii/chapter-3/23-22`, effectiveDate: LA, quote: `R8A R8X R8 | 6.02 | 7.20` },
  13: { section: "23-733", url: `${ZR}/article-ii/chapter-3/23-733`, effectiveDate: LA, quote: `In R10 Districts, the maximum floor area ratio on a zoning lot shall be 12.0 for qualifying affordable housing or qualifying senior housing and 10.0 for other residences.` },
  19: { section: "24-11", url: `${ZR}/article-ii/chapter-4/24-11`, effectiveDate: LA, quote: `R7A | 4.00 | 80 | 65` },
  20: { section: "24-11", url: `${ZR}/article-ii/chapter-4/24-11`, effectiveDate: LA, quote: `R8A | 6.50 | 80 | 70` },
  21: { section: "24-11", url: `${ZR}/article-ii/chapter-4/24-11`, effectiveDate: LA, quote: `R10 | 10.00 | 75 | 65` },
  22: { section: "23-362", url: `${ZR}/article-ii/chapter-3/23-362`, effectiveDate: LA, quote: `the maximum residential lot coverage for interior lots or through lots shall be 80 percent and the maximum residential lot coverage for corner lots shall be 100 percent.` },
  27: { section: "23-432", url: `${ZR}/article-ii/chapter-3/23-432`, effectiveDate: LA, quote: `R7A R7-11 R7-21 | 40 | 75 | 85 | 85 | 115` },
  28: { section: "23-432", url: `${ZR}/article-ii/chapter-3/23-432`, effectiveDate: LA, quote: `R8A | 60 | 95 | 125 | 105 | 145` },
  31: { section: "23-432", url: `${ZR}/article-ii/chapter-3/23-432`, effectiveDate: LA, quote: `a setback shall be provided at a height not lower than the minimum base height or higher than the maximum base height in accordance with Section 23-433.` },
  32: { section: "23-433", url: `${ZR}/article-ii/chapter-3/23-433`, effectiveDate: LA, quote: `a setback with a depth of at least 10 feet shall be provided from any street wall fronting on a wide street, and a setback with a depth of at least 15 feet shall be provided from any street wall fronting on a narrow street.` },
  47: { section: "23-736", url: `${ZR}/article-ii/chapter-3/23-736`, effectiveDate: LA, quote: `R8 R9 or R10 Districts | 20 | 15 | 85 feet or nine stories, whichever is less | 85 | 2.7 | to 1 | 5.6 | to 1` },
  51: { section: "23-735", url: `${ZR}/article-ii/chapter-3/23-735`, effectiveDate: LA, quote: `the maximum lot coverages set forth in Section 23-36, inclusive, need not apply;` },
  52: { section: "23-322", url: `${ZR}/article-ii/chapter-3/23-322`, effectiveDate: LA, quote: `In the districts indicated, no front yard requirements shall apply.` },
  53: { section: "23-335", url: `${ZR}/article-ii/chapter-3/23-335`, effectiveDate: LA, quote: `for zoning lots containing all other types of residences, no side yards shall be required. However, if any open area extending along a side lot line is provided at any level, it shall have a minimum width of five feet, measured perpendicular to the side lot line.` },
  54: { section: "23-342", url: `${ZR}/article-ii/chapter-3/23-342`, effectiveDate: LA, quote: `a rear yard with a depth of not less than 20 feet shall be provided at every rear lot line on any zoning lot, and for portions above 75 feet, where permitted, a rear yard with a depth of 30 feet shall be provided` },
  55: { section: "23-344", url: `${ZR}/article-ii/chapter-3/23-344`, effectiveDate: LA, quote: `no rear yard shall be required within 100 feet of the point of intersection of two street lines intersecting at an angle of 135 degrees or less.` },
  58: { section: "23-343", url: `${ZR}/article-ii/chapter-3/23-343`, effectiveDate: LA, quote: `On any through lot that is 190 feet or more in maximum depth from street to street, for buildings or portions thereof at or below a height of 75 feet, a rear yard equivalent consisting of an open area with a minimum depth of 40 feet shall be provided, and above a height of 75 feet, where permitted, a rear yard equivalent of 60 feet shall be provided.` },
  61: { section: "23-343", url: `${ZR}/article-ii/chapter-3/23-343`, effectiveDate: LA, quote: `open areas adjoining and extending along the full length of either or both street lines, where the combined depth of such open areas is equivalent to the depth of the required rear yard equivalent;` },
};

/** Citation for a claim row. The quote is typed once above and ASSERTED to occur in that row of the verified note. */
function cite(row: number): any {
  const def = CIT[row];
  if (!def) throw new Error(`no citation def for row ${row}`);
  const line = NOTE_LINES.find((l) => l.startsWith(`| ${row} |`));
  if (!line) throw new Error(`row ${row} not found in zoning note`);
  if (!line.includes(def.quote)) throw new Error(`row ${row}: quote not found verbatim in note row`);
  return {
    source: "NYC Zoning Resolution",
    section: def.section,
    paragraph: null,
    title: null,
    url: def.url,
    effectiveDate: def.effectiveDate,
    retrievedAt: RETRIEVED,
    quote: def.quote,
    researchNote: `_Shared/research/nyc-zoning-sample-envelope-values.md#${row}`,
  };
}

// ------------------------------------------------------------------ value helpers
type Unit = "ft" | "sf" | "ratio" | "percent" | "stories" | "count";
const citedV = (value: number, unit: Unit, rows: number[], note?: string): any => ({
  value, unit, status: "cited", confidence: "cited", citations: rows.map(cite), ...(note ? { note } : {}),
});
const notApplicable = (unit: Unit, note: string, rows: number[] = []): any => ({
  value: null, unit, status: "not_applicable", confidence: "inferred", ...(rows.length ? { citations: rows.map(cite) } : {}), note,
});
const assumedV = (value: number, unit: Unit, ids: string[], rows: number[] = [], note?: string): any => ({
  value, unit, status: "assumed", confidence: "inferred", assumptionIds: ids, ...(rows.length ? { citations: rows.map(cite) } : {}), ...(note ? { note } : {}),
});
const computedFA = (areaSf: number, far: number, farPath: string): any => {
  const v = Math.round(areaSf * far * 100) / 100;
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return { value: v, unit: "sf", status: "computed", confidence: "cited", formula: `${fmt(areaSf)} sf × ${far.toFixed(2)} = ${fmt(v)} sf`, inputs: ["/lot/area", farPath] };
};
const assumption = (id: string, statement: string, reason: string, affects: string[], rows: number[]): any => ({
  id, statement, reason, state: "accepted", affects, citations: rows.map(cite),
});
const MAX_STORIES_NOTE = "23-432 limits height in feet only; no stories limit found (research note: NOT FOUND)";
const SKY_SUFFIX_NOTE = "R7A has a letter suffix; sky exposure plane option applies only to districts without a suffix";

// ------------------------------------------------------------------ lot placement
function lotPolygon(theta: number, frontage: number, depth: number): { poly: Pt[]; alphaDeg: number } {
  // choose alpha in {theta + k*90} whose front-edge outward normal (-v) points closest to SOUTH => maximise cos(alpha)
  let alpha = theta;
  let bestC = -2;
  for (let k = 0; k < 4; k++) {
    const a = theta + 90 * k;
    const c = Math.cos((a * Math.PI) / 180);
    if (c > bestC + 1e-12) {
      bestC = c;
      alpha = a;
    }
  }
  const r = (alpha * Math.PI) / 180;
  const u: Pt = [Math.cos(r), Math.sin(r)];
  const v: Pt = [-Math.sin(r), Math.cos(r)];
  const hw = frontage / 2;
  const hd = depth / 2;
  const corner = (su: number, sv: number): Pt => [round(su * hw * u[0] + sv * hd * v[0], 0.001), round(su * hw * u[1] + sv * hd * v[1], 0.001)];
  // CCW: front(-v) west->east, east side, rear(+v), west side
  return { poly: [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], alphaDeg: alpha };
}

// ------------------------------------------------------------------ envelope assembly
interface SampleCfg {
  id: string;
  code: string;
  frontage: number;
  depth: number;
}

function commonParts(cfg: SampleCfg, poly: Pt[], theta: number, alphaDeg: number) {
  const area = Math.abs(signedArea(poly));
  const dsFoot = {
    dataset: "NYC Building Footprints (5zhs-2jue)",
    version: `rowsUpdatedAt ${FOOTPRINT_ROWS_UPDATED}`,
    field: "the_geom, height_roof",
    url: FOOTPRINT_URL,
    fetchedAt: FOOTPRINT_FETCHED,
  };
  const dsLot = { dataset: "SAMPLE — hypothetical lot", fetchedAt: GENERATED_AT };
  return {
    area,
    head: {
      schemaVersion: "1.0.0",
      envelopeId: cfg.id,
      generatedAt: GENERATED_AT,
      generator: { name: "Project 3 sample builder", version: "0.1" },
    },
    jurisdiction: {
      id: "nyc",
      name: "New York City",
      code: {
        name: "NYC Zoning Resolution",
        versionLabel: "Sections as Last Amended 12/5/2024 (12-10: 3/26/2026)",
        effectiveDate: null,
        retrievedAt: `${RETRIEVED}T00:00:00Z`,
        url: ZR,
      },
    },
    site: { parcelId: `SAMPLE-${cfg.id}`, bbl: null, address: null, borough: "Brooklyn" },
    districts: [{ code: cfg.code, kind: "base", provenance: [{ dataset: "SAMPLE — hypothetical district assignment", fetchedAt: GENERATED_AT }] }],
    dsLot,
    provenance: {
      datasets: [dsFoot, dsLot],
      notes: [
        "SAMPLE: hypothetical lot, not a real parcel. Placed at lat 40.6890, lng -73.9755 (south of Fort Greene Park, Brooklyn) for context.",
        `Street-grid angle theta = ${theta}° (length-weighted histogram of context footprint edge directions mod 90°, 1° bins, ±2° smoothing). Lot edge 0 (front) direction angle = ${alphaDeg}° from east; front outward normal points closest to south (park is north).`,
        "Context footprints that intersect the lot were removed (SAMPLE: existing buildings on the hypothetical lot removed); see the .site.json sidecar.",
      ],
    },
    lotBase: (lotTypeValue: "interior" | "corner" | "through", ltIds: string[], edges: any[]) => ({
      crs: { reference: "EPSG:2263", lengthUnit: "ft" },
      origin: { x: round(origin.x, 0.001), y: round(origin.y, 0.001) },
      polygonLocal: poly,
      polygonReference: poly.map(([x, y]) => [round(origin.x + x, 0.01), round(origin.y + y, 0.01)]),
      geometrySource: dsLot,
      area: {
        value: round(area, 0.01), unit: "sf", status: "computed", confidence: "inferred",
        formula: `${cfg.frontage} ft × ${cfg.depth} ft = ${(cfg.frontage * cfg.depth).toLocaleString("en-US")} sf`,
        inputs: ["/lot/polygonLocal"],
      },
      frontage: { value: cfg.frontage, unit: "ft", status: "computed", confidence: "inferred", formula: `front edge length = ${cfg.frontage} ft`, inputs: ["/lot/polygonLocal"] },
      depth: { value: cfg.depth, unit: "ft", status: "computed", confidence: "inferred", formula: `lot depth = ${cfg.depth} ft`, inputs: ["/lot/polygonLocal"] },
      lotType: { value: lotTypeValue, status: "assumed", assumptionIds: ltIds },
      edges,
    }),
  };
}

const yardsFront = () => citedV(0, "ft", [52]);
const yardsSide = () => citedV(0, "ft", [53]);
const farBlock = (res: [number, number[]], cf: [number, number[]]) => ({
  residential: citedV(res[0], "ratio", res[1]),
  community_facility: citedV(cf[0], "ratio", cf[1]),
});
const floorAreaBlock = (area: number, far: { residential: number; community_facility: number }) => ({
  residential: computedFA(area, far.residential, "/controls/maxFar/residential"),
  community_facility: computedFA(area, far.community_facility, "/controls/maxFar/community_facility"),
});

function buildA(theta: number) {
  const cfg: SampleCfg = { id: "sample-a-r7a-interior", code: "R7A", frontage: 100, depth: 100 };
  const { poly, alphaDeg } = lotPolygon(theta, cfg.frontage, cfg.depth);
  const c = commonParts(cfg, poly, theta, alphaDeg);
  const env = {
    ...c.head,
    flags: {
      draft: true, sample: true, simplified: true,
      simplifications: [
        "Setback taken at the max base height (75 ft); designers may set back lower between 40 and 75 ft (ZR 23-432/23-433).",
        "Setback depth measured from the street line (street wall assumed at the street line).",
        "Street wall location (70% within 10 ft, ZR 23-431) checked by a simplified street-wall test.",
        "Qualifying affordable/senior housing variants (FAR 5.01, base height 85 ft, height 115 ft) not modelled.",
      ],
    },
    jurisdiction: c.jurisdiction,
    site: c.site,
    lot: c.lotBase("interior", ["asm-a-lottype"], [
      { index: 0, kind: "front", street: { name: null, width: "narrow", assumptionIds: ["asm-a-street"] } },
      { index: 1, kind: "side", street: null },
      { index: 2, kind: "rear", street: null },
      { index: 3, kind: "side", street: null },
    ]),
    districts: c.districts,
    controls: {
      intendedUse: "residential",
      programs: [],
      maxFar: farBlock([4, [10]], [4, [19]]),
      maxFloorArea: floorAreaBlock(c.area, { residential: 4, community_facility: 4 }),
      baseHeight: { min: citedV(40, "ft", [27]), max: citedV(75, "ft", [27, 31]) },
      maxBuildingHeight: citedV(85, "ft", [27]),
      maxStories: notApplicable("stories", MAX_STORIES_NOTE),
      setbacks: [
        { id: "setback-narrow-front", appliesTo: "narrow_street_frontage", edgeIndices: [0], startHeight: citedV(75, "ft", [27, 31]), depth: citedV(15, "ft", [32]) },
        { id: "setback-upper-rear", appliesTo: "rear", edgeIndices: [2], startHeight: citedV(75, "ft", [54]), depth: citedV(30, "ft", [54], "Upper rear yard: 30 ft above 75 ft.") },
      ],
      yards: { front: yardsFront(), rear: citedV(20, "ft", [54]), side: yardsSide() },
      lotCoverage: { max: citedV(80, "percent", [22]) },
      skyExposure: { status: "not_applicable", note: `${SKY_SUFFIX_NOTE} (ZR 12-10 'sky exposure plane building'; research note row 8).` },
    },
    assumptions: [
      assumption("asm-a-street", "The front street is a narrow street (< 75 ft wide).", "SAMPLE lot has no real street; street width is assumed so the narrow-street setback depth (15 ft) applies.", ["/lot/edges/0/street/width", "/controls/setbacks/0/depth"], [3]),
      assumption("asm-a-lottype", "The lot is an interior lot (one street frontage, no corner).", "SAMPLE lot is hypothetical; interior lot type is assumed.", ["/lot/lotType", "/controls/yards/rear", "/controls/lotCoverage/max"], [5]),
    ],
    reviewFlags: [{ kind: "other", message: "SAMPLE lot: no use regulations checked; R7A without a commercial overlay has no commercial FAR." }],
    provenance: c.provenance,
    massingLink: null,
  };
  return { env, poly, cfg, theta, alphaDeg };
}

function buildB(theta: number) {
  const cfg: SampleCfg = { id: "sample-b-r8a-corner", code: "R8A", frontage: 100, depth: 100 };
  const { poly, alphaDeg } = lotPolygon(theta, cfg.frontage, cfg.depth);
  const c = commonParts(cfg, poly, theta, alphaDeg);
  const env = {
    ...c.head,
    flags: {
      draft: true, sample: true, simplified: true,
      simplifications: [
        "Setback taken at the max base height (95 ft); designers may set back lower between 60 and 95 ft (ZR 23-432/23-433).",
        "Setback depth measured from the street line (street wall assumed at the street line).",
        "Street wall location (70% within 8 ft on a wide street, ZR 23-431) checked by a simplified street-wall test.",
        "Qualifying affordable/senior housing variants (FAR 7.20, base height 105 ft, height 145 ft) not modelled.",
        "Corner rear-yard exemption applied to the whole lot.",
        "Street wall rule applied along the wide street only (ZR 23-436).",
      ],
    },
    jurisdiction: c.jurisdiction,
    site: c.site,
    lot: c.lotBase("corner", ["asm-b-lottype"], [
      { index: 0, kind: "front", street: { name: null, width: "wide", assumptionIds: ["asm-b-wide"] } },
      { index: 1, kind: "front", street: { name: null, width: "narrow", assumptionIds: ["asm-b-narrow"] } },
      { index: 2, kind: "side", street: null },
      { index: 3, kind: "side", street: null },
    ]),
    districts: c.districts,
    controls: {
      intendedUse: "residential",
      programs: [],
      maxFar: farBlock([6.02, [11]], [6.5, [20]]),
      maxFloorArea: floorAreaBlock(c.area, { residential: 6.02, community_facility: 6.5 }),
      baseHeight: { min: citedV(60, "ft", [28]), max: citedV(95, "ft", [28, 31]) },
      maxBuildingHeight: citedV(125, "ft", [28]),
      maxStories: notApplicable("stories", MAX_STORIES_NOTE),
      setbacks: [
        { id: "setback-wide-front", appliesTo: "wide_street_frontage", edgeIndices: [0], startHeight: citedV(95, "ft", [28, 31]), depth: citedV(10, "ft", [32]) },
        { id: "setback-narrow-front", appliesTo: "narrow_street_frontage", edgeIndices: [1], startHeight: citedV(95, "ft", [28, 31]), depth: citedV(15, "ft", [32]) },
      ],
      yards: {
        front: yardsFront(),
        rear: citedV(0, "ft", [55], "Corner lot: no rear yard within 100 ft of the street intersection (23-344); SIMPLIFIED to the whole 100×100 lot"),
        side: yardsSide(),
      },
      lotCoverage: { max: citedV(100, "percent", [22], "Corner lot: 100 percent.") },
      skyExposure: { status: "not_applicable", note: "R8A has a letter suffix; sky exposure plane option applies only to districts without a suffix (ZR 12-10 'sky exposure plane building'; research note row 8)." },
    },
    assumptions: [
      assumption("asm-b-wide", "The south front street (edge 0) is a wide street (>= 75 ft wide).", "SAMPLE lot has no real street; width is assumed so the wide-street setback depth (10 ft) applies.", ["/lot/edges/0/street/width", "/controls/setbacks/0/depth"], [1]),
      assumption("asm-b-narrow", "The east front street (edge 1) is a narrow street (< 75 ft wide).", "SAMPLE lot has no real street; width is assumed so the narrow-street setback depth (15 ft) applies.", ["/lot/edges/1/street/width", "/controls/setbacks/1/depth"], [3]),
      assumption("asm-b-lottype", "The lot is a corner lot (two street frontages meeting at about 90 degrees).", "SAMPLE lot is hypothetical; corner lot type is assumed.", ["/lot/lotType", "/controls/yards/rear", "/controls/lotCoverage/max"], [4]),
    ],
    reviewFlags: [{ kind: "other", message: "SAMPLE lot: no use regulations checked; R8A without a commercial overlay has no commercial FAR." }],
    provenance: c.provenance,
    massingLink: null,
  };
  return { env, poly, cfg, theta, alphaDeg };
}

function buildC(theta: number) {
  const cfg: SampleCfg = { id: "sample-c-r10-through-sep", code: "R10", frontage: 200, depth: 200 };
  const { poly, alphaDeg } = lotPolygon(theta, cfg.frontage, cfg.depth);
  const c = commonParts(cfg, poly, theta, alphaDeg);
  const REY = ["asm-c-rey"];
  const env = {
    ...c.head,
    flags: {
      draft: true, sample: true, simplified: true,
      simplifications: [
        "Optional sky exposure plane regulations (23-73) used; tower penetration of the plane (23-737) not modelled.",
        "Sky exposure plane evaluated per floor at the floor's top.",
        "Rear yard equivalent split equally along both street lines (SAMPLE design choice).",
        "Street wall rules for sky exposure plane buildings not researched.",
      ],
    },
    jurisdiction: c.jurisdiction,
    site: c.site,
    lot: c.lotBase("through", ["asm-c-lottype"], [
      { index: 0, kind: "front", street: { name: null, width: "wide", assumptionIds: ["asm-c-wide"] } },
      { index: 1, kind: "side", street: null },
      { index: 2, kind: "front", street: { name: null, width: "narrow", assumptionIds: ["asm-c-narrow"] } },
      { index: 3, kind: "side", street: null },
    ]),
    districts: c.districts,
    controls: {
      intendedUse: "residential",
      programs: [],
      maxFar: farBlock([10, [13]], [10, [21]]),
      maxFloorArea: floorAreaBlock(c.area, { residential: 10, community_facility: 10 }),
      baseHeight: {
        min: { value: null, unit: "ft", status: "needs_input", confidence: "unverified", note: "Minimum base height for buildings using the sky exposure plane option was not researched" },
        max: citedV(85, "ft", [47], "Maximum front wall height under the sky exposure plane option: '85 feet or nine stories, whichever is less'."),
      },
      maxBuildingHeight: notApplicable("ft", "Height governed by the sky exposure plane under the optional regulations", [47]),
      maxStories: notApplicable("stories", "No stories limit researched; height governed by the sky exposure plane (front wall limit is '85 feet or nine stories, whichever is less', row 47)."),
      setbacks: [
        { id: "rey-open-area-low", appliesTo: "street_frontage", edgeIndices: [0, 2], startHeight: assumedV(0, "ft", REY, [58, 61]), depth: assumedV(20, "ft", REY, [58, 61], "Rear yard equivalent (40 ft) as 20 ft open area at each street line, at or below 75 ft.") },
        { id: "rey-open-area-high", appliesTo: "street_frontage", edgeIndices: [0, 2], startHeight: citedV(75, "ft", [58]), depth: assumedV(30, "ft", REY, [58, 61], "Rear yard equivalent (60 ft) as 30 ft open area at each street line, above 75 ft.") },
      ],
      yards: {
        front: yardsFront(),
        rear: notApplicable("ft", "Through lot: no rear lot line; rear yard equivalent encoded in setbacks[] (see asm-c-rey)", [58]),
        side: yardsSide(),
      },
      lotCoverage: { max: notApplicable("percent", "For sky exposure plane buildings the lot coverages of 23-36 need not apply (ZR 23-735).", [51]) },
      skyExposure: {
        status: "implemented",
        note: "Optional sky exposure plane regulations (ZR 23-73), R8/R9/R10 row of ZR 23-736 (standard front setbacks); SIMPLIFIED, see flags.simplifications.",
        planes: [
          { id: "sep-wide", appliesTo: "wide_street_frontage", edgeIndices: [0], startHeight: citedV(85, "ft", [47]), initialSetback: citedV(15, "ft", [47]), slopeVerticalPerHorizontal: citedV(5.6, "ratio", [47]) },
          { id: "sep-narrow", appliesTo: "narrow_street_frontage", edgeIndices: [2], startHeight: citedV(85, "ft", [47]), initialSetback: citedV(20, "ft", [47]), slopeVerticalPerHorizontal: citedV(2.7, "ratio", [47]) },
        ],
      },
    },
    assumptions: [
      assumption("asm-c-wide", "The south front street (edge 0) is a wide street (>= 75 ft wide).", "SAMPLE lot has no real street; width is assumed so the wide-street sky exposure plane values apply.", ["/lot/edges/0/street/width", "/controls/skyExposure/planes/0"], [1]),
      assumption("asm-c-narrow", "The north front street (edge 2) is a narrow street (< 75 ft wide).", "SAMPLE lot has no real street; width is assumed so the narrow-street sky exposure plane values apply.", ["/lot/edges/2/street/width", "/controls/skyExposure/planes/1"], [3]),
      assumption("asm-c-lottype", "The lot is a through lot (two opposite street frontages, 200 ft apart).", "SAMPLE lot is hypothetical; through lot type is assumed.", ["/lot/lotType", "/controls/yards/rear"], [6]),
      assumption("asm-c-rey", "Rear yard equivalent provided as open areas along both street lines (ZR 23-343 alternative): 40 ft combined → 20 ft at each street line at or below 75 ft; 60 ft combined → 30 ft each above 75 ft", "ZR 23-343 requires a rear yard equivalent of 40 ft (at or below 75 ft) / 60 ft (above 75 ft) on through lots 190 ft or more deep and allows open areas along both street lines; splitting equally is a SAMPLE design choice.", ["/controls/setbacks/0", "/controls/setbacks/1", "/controls/yards/rear"], [58, 61]),
    ],
    reviewFlags: [
      { kind: "other", message: "Towers (ZR 23-435 / 23-737) not modelled in this SAMPLE." },
      { kind: "other", message: "Lot is 40,000 sf: large-lot street wall rule (50% within 15 ft, ZR 23-431) may apply; not checked." },
    ],
    provenance: c.provenance,
    massingLink: null,
  };
  return { env, poly, cfg, theta, alphaDeg };
}

// ------------------------------------------------------------------ main
function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

function main() {
  const ctx = buildContext();
  const theta = gridAngle(ctx.buildings.map((b) => b.polygon.outer));
  console.log(`grid angle theta = ${theta} deg`);

  const header = {
    sample: true,
    note: "SAMPLE context for hypothetical lots",
    datasetId: "5zhs-2jue",
    datasetName: "NYC Building Footprints (BUILDING)",
    queryUrl: FOOTPRINT_URL,
    fetchedAt: FOOTPRINT_FETCHED,
    rowsUpdatedAt: FOOTPRINT_ROWS_UPDATED,
    attribution: "NYC OTI Building Footprints (dataset 5zhs-2jue), NYC Open Data",
    park: { datasetId: "enfh-gkve", queryUrl: PARK_URL, fetchedAt: PARK_FETCHED, attribution: "NYC Parks Properties (dataset enfh-gkve), NYC Open Data" },
    conversion: "EPSG:4326 → EPSG:2263 via proj4 2.22.0, epsg.io definition; local = EPSG:2263 − origin; heights above ground per data dictionary",
    crs: { reference: "EPSG:2263", lengthUnit: "ft" },
    origin: { x: round(origin.x, 0.001), y: round(origin.y, 0.001), lat: LAT, lng: LNG },
    gridAngleDeg: theta,
    counts: { rawFeatures: ctx.raw.features.length, droppedNoHeight: ctx.dropped, buildings: ctx.buildings.length },
    heightUnit: "ft above ground_elevation (height_roof)",
  };
  fs.mkdirSync(path.dirname(OUT_CONTEXT), { recursive: true });
  const bLines = ctx.buildings.map((b) => "    " + JSON.stringify(b)).join(",\n");
  fs.writeFileSync(
    OUT_CONTEXT,
    `{\n  "header": ${JSON.stringify(header, null, 2).replace(/\n/g, "\n  ")},\n  "park": ${JSON.stringify(ctx.park)},\n  "buildings": [\n${bLines}\n  ]\n}\n`,
  );

  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  let failed = false;
  for (const s of [buildA(theta), buildB(theta), buildC(theta)]) {
    const removed = ctx.buildings.filter((b) => polygonsIntersect(b.polygon.outer, s.poly)).map((b) => b.bin);
    if (!validate(s.env)) {
      failed = true;
      console.error(`INVALID ${s.cfg.id}:`, JSON.stringify(validate.errors, null, 2));
    }
    writeJson(path.join(OUT_SAMPLES, `${s.cfg.id}.json`), s.env);
    writeJson(path.join(OUT_SAMPLES, `${s.cfg.id}.site.json`), {
      sample: true,
      envelopeId: s.cfg.id,
      lat: LAT,
      lng: LNG,
      latLngSource: "3A research/nyc-footprints-data.md (chosen point)",
      gridAngleDeg: theta,
      frontEdgeAngleDeg: s.alphaDeg,
      parkName: ctx.park.name,
      parkPolygonLocal: ctx.park.polygon,
      contextFile: "data/context-fort-greene.json",
      removedContextBins: removed,
      removalNote: "SAMPLE: existing buildings on the hypothetical lot removed",
    });
    console.log(`${s.cfg.id}: area ${Math.abs(signedArea(s.poly))} sf, removed ${removed.length} BINs [${removed.join(", ")}], kept ${ctx.buildings.length - removed.length}`);
  }
  console.log(`context: raw ${ctx.raw.features.length}, dropped (null/0 height) ${ctx.dropped}, buildings ${ctx.buildings.length}`);
  if (failed) process.exit(1);
  console.log("all three envelopes validate against the canonical schema");
}

main();
