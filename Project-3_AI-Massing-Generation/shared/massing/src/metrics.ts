// Metrics (spec §5): the ONLY source of numbers. Computed from floor plates; raw (unrounded) values.
import { designFrame } from "./envelope";
import { area, intersect, mpKey, toFrame, union } from "./geom2d";
import type { Assumptions, EnvelopeModel, FloorPlate, Metrics, MultiPolygon, Program } from "./types";
import { PROGRAMS } from "./types";

const EDGE_TOL = 0.05;

function zeroByProgram(): Record<Program, number> {
  return { residential: 0, commercial: 0, community_facility: 0 };
}

/** True if some ring edge of the plate lies entirely within `limit` ft of the frontage line (frame v <= limit). */
function plateReachesStreet(model: EnvelopeModel, plate: MultiPolygon, limit: number): boolean {
  const f = designFrame(model);
  for (const poly of plate) {
    for (const ring of [poly.outer, ...poly.holes]) {
      for (let i = 0; i < ring.length; i++) {
        const a = toFrame(f, ring[i]);
        const b = toFrame(f, ring[(i + 1) % ring.length]);
        if (a[1] <= limit + EDGE_TOL && b[1] <= limit + EDGE_TOL && Math.hypot(b[0] - a[0], b[1] - a[1]) > EDGE_TOL) return true;
      }
    }
  }
  return false;
}

/**
 * Street-wall location distance D (ft): how close to the street line a plate edge must be to count as street wall.
 * Source: _Shared/research/nyc-zoning-sample-envelope-values.md (ZR 23-431), verified note rows:
 *  - row 34, wide street: "Along wide streets, at least 70 percent of the aggregate width of street walls shall be
 *    located within eight feet of the street line ..."  -> 8 ft
 *  - row 35, narrow street: "Along narrow streets, at least 70 percent of the aggregate width of street wall shall be
 *    located within 10 feet of the street line ..." -> 10 ft
 * Unknown street width uses 10 ft (noted on the model). SIMPLIFIED: the 70 %-of-width test is reduced to "some plate
 * edge lies within D", and the rule exceptions (R6B/R7B/R8B) are not modelled.
 */
export function streetWallDistance(model: EnvelopeModel): number {
  return model.edges[model.frontageEdgeIndex]?.streetWidth === "wide" ? 8 : 10;
}

/**
 * Top of the highest floor k such that floors 0..k all have a plate edge within D of the frontage line,
 * D = streetWallDistance, measured from the front yard line when there is a front yard (so limit = front yard + D).
 */
export function streetWallHeight(model: EnvelopeModel, floors: readonly FloorPlate[]): number {
  const limit = (model.yards.front?.value ?? 0) + streetWallDistance(model);
  let h = 0;
  for (const fl of floors) {
    if (!plateReachesStreet(model, fl.polygons, limit)) break;
    h = fl.z + fl.height;
  }
  return h;
}

export function computeMetrics(model: EnvelopeModel, floors: readonly FloorPlate[], assumptions: Assumptions): Metrics {
  const lotArea = model.lotArea;
  const gfaByProgram = zeroByProgram();
  let gfa = 0;
  let facade = 0;
  let volume = 0;
  let trimmedVolume = 0;
  for (const f of floors) {
    gfa += f.area;
    gfaByProgram[f.program] += f.area;
    facade += f.perimeter * f.height;
    volume += f.area * f.height;
    trimmedVolume += f.trimmedArea * f.height;
  }
  const farByProgram = zeroByProgram();
  for (const p of PROGRAMS) farByProgram[p] = gfaByProgram[p] / lotArea;

  // lot coverage: union of distinct plate shapes projected to plan
  const distinct = new Map<string, MultiPolygon>();
  for (const f of floors) distinct.set(mpKey(f.polygons), f.polygons);
  const footprintUnion = distinct.size ? union(...distinct.values()) : [];
  const lotCoveragePct = (area(footprintUnion) / lotArea) * 100;
  const footprint = floors.length ? floors[0].area : 0;

  // surface of a stack of vertical prisms: walls + exposed caps (area minus overlap with neighbour floor)
  let caps = 0;
  const overlap = (a: FloorPlate, b: FloorPlate): number =>
    mpKey(a.polygons) === mpKey(b.polygons) ? a.area : area(intersect(a.polygons, b.polygons));
  for (let k = 0; k < floors.length; k++) {
    const f = floors[k];
    caps += k === 0 ? f.area : f.area - overlap(f, floors[k - 1]);
    caps += k === floors.length - 1 ? f.area : f.area - overlap(f, floors[k + 1]);
  }
  const surface = facade + caps;

  const last = floors[floors.length - 1];
  const eff = assumptions.efficiency.value;
  return {
    lotArea,
    gfa,
    gfaByProgram,
    zfa: gfa, // SIMPLIFIED: no ZR floor-area deductions
    far: gfa / lotArea,
    farByProgram,
    floors: floors.length,
    height: last ? last.z + last.height : 0, // SIMPLIFIED: no bulkheads/parapets
    footprint,
    lotCoveragePct, // SIMPLIFIED: plan projection of all plates
    openSpacePct: ((lotArea - footprint) / lotArea) * 100,
    facadeArea: facade,
    facadePerGfa: gfa > 0 ? facade / gfa : 0,
    volume,
    compactness: volume > 0 ? surface / Math.pow(volume, 2 / 3) : 0,
    unitsEst: Math.floor((gfaByProgram.residential * eff) / assumptions.avgUnitNetSf.value + 1e-9),
    streetWallHeight: streetWallHeight(model, floors),
    trimmedVolume,
    courtyardSunHours: null,
  };
}
