// generateOption: parameters -> floors -> prisms -> metrics -> compliance (spec §2, §4-§6).
// Pure and deterministic: no Date, no Math.random. All numbers on the returned option are computed here.
import { evaluateCompliance, evaluateProgramFit, overallStatus } from "./compliance";
import { designFrame, sectionAt, sectionKeyAt } from "./envelope";
import {
  area,
  bboxInFrame,
  difference,
  inset,
  intersect,
  orientedRectFromFrame,
  perimeter,
  rectFromFrame,
  union,
  isEmpty,
  type Frame,
  type FrameBox,
} from "./geom2d";
import { classifyTypology, validateParams } from "./grammar";
import { computeMetrics } from "./metrics";
import { floorHeight, programForFloor } from "./program";
import { buildPrisms } from "./solids";
import type { Assumptions, EnvelopeModel, FloorPlate, MassingOption, MassingParams, MultiPolygon, Program, ProgramSchedule } from "./types";

const TRIM_EPS_SF = 0.01;
const MAX_Z_FT = 1500;
const BASE_Z = 1e-6; // "0+": evaluate the section just above grade

/** Stable id from a hash of the parameters (FNV-1a over key-sorted JSON). */
export function paramsId(p: MassingParams): string {
  const s = JSON.stringify(Object.fromEntries(Object.entries(p).sort(([a], [b]) => (a < b ? -1 : 1))));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `opt-${h.toString(16).padStart(8, "0")}`;
}

interface PartShape {
  poly: MultiPolygon; // part_j
  base: MultiPolygon; // part_j - void_j
  box: FrameBox;
  floors: number; // n_j
}

function stepStrip(f: Frame, pb: FrameBox, from: MassingParams["stepFrom"], depth: number): MultiPolygon {
  if (depth <= 0) return [];
  const big = 1;
  switch (from) {
    case "front":
      return [rectFromFrame(f, pb.u0 - big, pb.u1 + big, pb.v0 - big, pb.v0 + depth)];
    case "rear":
      return [rectFromFrame(f, pb.u0 - big, pb.u1 + big, pb.v1 - depth, pb.v1 + big)];
    case "left":
      return [rectFromFrame(f, pb.u0 - big, pb.u0 + depth, pb.v0 - big, pb.v1 + big)];
    case "right":
      return [rectFromFrame(f, pb.u1 - depth, pb.u1 + big, pb.v0 - big, pb.v1 + big)];
  }
}

export function generateOption(
  model: EnvelopeModel,
  schedule: ProgramSchedule,
  assumptions: Assumptions,
  params: MassingParams,
  opts?: { id?: string },
): MassingOption {
  const v = validateParams(params);
  if (!v.ok) throw new Error(`Invalid massing parameters: ${v.errors.join("; ")}`);
  const notes: string[] = [];
  const frame = designFrame(model);
  const clip = params.clipToEnvelope;
  const lotMP: MultiPolygon = [model.lot];
  const sectionFor = (zTop: number): MultiPolygon => (clip ? sectionAt(model, zTop) : lotMP);
  const lotBox = bboxInFrame(frame, lotMP) as FrameBox;

  // 1. base band and parts
  const base0 = sectionFor(BASE_Z);
  const band = rectFromFrame(frame, lotBox.u0 - 1, lotBox.u1 + 1, Math.min(lotBox.v0, 0) - 1, params.baseDepth);
  const B = intersect(base0, [band]);
  const parts: PartShape[] = [];
  const bBox = bboxInFrame(frame, B);
  if (bBox) {
    const total = bBox.u1 - bBox.u0;
    const w = (total - (params.parts - 1) * params.gapWidth) / params.parts;
    if (w <= 0) notes.push("Gap between volumes is wider than the buildable area; no volumes were made.");
    else {
      for (let j = 0; j < params.parts; j++) {
        const u0 = j === 0 ? bBox.u0 - 1 : bBox.u0 + j * (w + params.gapWidth);
        const u1 = j === params.parts - 1 ? bBox.u1 + 1 : bBox.u0 + j * (w + params.gapWidth) + w;
        const poly = intersect(B, [rectFromFrame(frame, u0, u1, bBox.v0 - 1, bBox.v1 + 1)]);
        const box = bboxInFrame(frame, poly);
        if (!box || isEmpty(poly)) continue;
        // 2. courtyard
        let basePoly = poly;
        if (params.ringDepth > 0) {
          const vd = inset(poly, params.ringDepth);
          if (isEmpty(vd)) notes.push(`Courtyard ring depth ${params.ringDepth} ft leaves no courtyard in volume ${j + 1}.`);
          else basePoly = difference(poly, vd);
        }
        const t = params.parts === 1 ? 0 : -1 + (2 * j) / (params.parts - 1);
        const n = Math.max(params.baseFloors, params.baseFloors + Math.round(params.upperFloors * (1 + params.heightBias * t)));
        parts.push({ poly, base: basePoly, box, floors: n });
      }
    }
  } else notes.push("No buildable area at grade.");

  // 3. carve
  let carve: MultiPolygon = [];
  if (bBox && params.carveWidth > 0 && params.carveDepth > 0) {
    const uc = bBox.u0 + params.carveU * (bBox.u1 - bBox.u0);
    const [v0, v1] = params.carveSide === "front" ? [-1, params.carveDepth] : [bBox.v1 - params.carveDepth, bBox.v1 + 1];
    carve = [rectFromFrame(frame, uc - params.carveWidth / 2, uc + params.carveWidth / 2, v0, v1)];
  }

  // Tower rectangle: computed ONCE from the bbox of the section at grade (the lot when not clipping), then clipped per
  // floor, so the tower never drifts with height. The whole rotated rectangle is kept inside the bbox when it fits.
  let towerRect: MultiPolygon | null = null;
  if (params.upperMode === "tower") {
    const bb = bboxInFrame(frame, sectionFor(BASE_Z));
    if (bb) {
      const A = (params.towerCoverage / 100) * model.lotArea;
      const long = Math.sqrt(A * params.towerAspect);
      const short = Math.sqrt(A / params.towerAspect);
      const th = (params.towerRotation * Math.PI) / 180;
      const hu = (long * Math.abs(Math.cos(th)) + short * Math.abs(Math.sin(th))) / 2;
      const hv = (long * Math.abs(Math.sin(th)) + short * Math.abs(Math.cos(th))) / 2;
      const place = (lo: number, hi: number, half: number, t: number) => (hi - lo - 2 * half >= 0 ? lo + half + t * (hi - lo - 2 * half) : (lo + hi) / 2);
      const cu = place(bb.u0, bb.u1, hu, params.towerU);
      const cv = place(bb.v0, bb.v1, hv, params.towerV);
      towerRect = [orientedRectFromFrame(frame, cu, cv, long, short, params.towerRotation)];
    }
  }

  const maxFloors =
    parts.length === 0
      ? 0
      : params.upperMode === "tower"
        ? params.baseFloors + params.upperFloors
        : params.upperMode === "extrude"
          ? Math.max(...parts.map((p) => p.floors))
          : params.baseFloors;

  const desiredCache = new Map<string, MultiPolygon>();
  const memo = (key: string, make: () => MultiPolygon): MultiPolygon => {
    let r = desiredCache.get(key);
    if (!r) {
      r = make();
      desiredCache.set(key, r);
    }
    return r;
  };
  const plateCache = new Map<string, MultiPolygon>();

  const floors: FloorPlate[] = [];
  const programs: Program[] = [];
  const areas: number[] = [];
  let z = 0;
  for (let k = 0; k < maxFloors && z <= MAX_Z_FT; k++) {
    const program = programForFloor(schedule, k, programs, areas);
    const h = floorHeight(assumptions, program, k);
    const zTop = z + h;
    const carveActive = carve.length > 0 && k >= params.carveFromFloor;
    const cKey = carveActive ? "c1" : "c0";
    const carveNow = carveActive ? carve : [];

    // 4-5. desired footprint D_k
    let dKey: string;
    let D: MultiPolygon;
    if (k < params.baseFloors) {
      dKey = `base|${cKey}`;
      D = memo(dKey, () => difference(union(...parts.map((p) => p.base)), carveNow));
    } else if (params.upperMode === "none") {
      break;
    } else if (params.upperMode === "extrude") {
      const s = params.stepEvery > 0 ? Math.floor((k - params.baseFloors) / params.stepEvery) + 1 : 0;
      const mask = parts.map((p) => (k < p.floors ? "1" : "0")).join("");
      dKey = `ext|${mask}|${s}|${cKey}`;
      D = memo(dKey, () =>
        union(
          ...parts.map((p, j) => {
            if (mask[j] !== "1") return [];
            let shape = difference(p.base, carveNow);
            if (s > 0) shape = difference(shape, stepStrip(frame, p.box, params.stepFrom, s * params.stepDepth));
            return shape;
          }),
        ),
      );
    } else {
      if (k >= params.baseFloors + params.upperFloors || !towerRect) break;
      dKey = `tower|${cKey}`;
      D = memo(dKey, () => difference(towerRect, carveNow));
    }
    if (isEmpty(D)) break;

    // 6. clip to envelope
    let P: MultiPolygon;
    if (clip) {
      const sk = sectionKeyAt(model, zTop);
      if (sk === null) break;
      const pk = `${dKey}@${sk}`;
      let hit = plateCache.get(pk);
      if (!hit) {
        hit = intersect(D, sectionAt(model, zTop));
        plateCache.set(pk, hit);
      }
      P = hit;
    } else P = D;
    if (isEmpty(P)) break;

    const desiredArea = area(D);
    const a = area(P);
    const trimmed = clip && desiredArea - a > TRIM_EPS_SF ? desiredArea - a : 0;
    floors.push({ index: k, z, height: h, program, polygons: P, area: a, perimeter: perimeter(P), desiredArea, trimmedArea: trimmed });
    programs.push(program);
    areas.push(a);
    z = zTop;
  }
  if (!floors.length) notes.push("No floors fit inside the envelope with these parameters.");

  const prisms = buildPrisms(floors);
  const metrics = computeMetrics(model, floors, assumptions);
  const compliance = evaluateCompliance(model, floors, metrics);
  return {
    id: opts?.id ?? paramsId(params),
    typology: classifyTypology(params),
    params: { ...params },
    floors,
    prisms,
    metrics,
    compliance,
    overall: overallStatus(compliance),
    programFit: evaluateProgramFit(schedule, metrics),
    notes,
  };
}
