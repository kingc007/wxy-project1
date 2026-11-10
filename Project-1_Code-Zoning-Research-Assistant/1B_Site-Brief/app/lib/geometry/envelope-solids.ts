// Pure derivation of the drawable solids from an envelope: no three.js here, so it is unit-testable.
// SIMPLIFIED: footprints are the lot polygon inset per edge (yards, then street/rear/side setbacks by height band).
// Controls whose value is null are never drawn; they are listed in `notDrawn`.

import type { EnvelopeLike, EnvSetback, EnvSkyPlane } from "./envelope-input";
import { ensureCCW, inwardNormal, insetPolygonEdges, mergeCollinearEdges, type Pt } from "./polygon";

export interface Stage {
  id: string;
  label: string;
  z0: number;
  z1: number;
  footprint: Pt[];
  /** human-readable list of what shaped this footprint, for the text alternative */
  shapedBy: string[];
}

export interface SkyPlaneSolid {
  id: string;
  label: string;
  /** quad corners in local feet, z = height: [x, y, z] */
  corners: [number, number, number][];
  startHeight: number;
  initialSetback: number;
  slope: number;
}

export interface EnvelopeSolids {
  lot: Pt[];
  stages: Stage[];
  skyPlanes: SkyPlaneSolid[];
  /** reasons the volumes could not be built from the lot polygon (e.g. non-convex) */
  manualGeometry: string | null;
  notDrawn: string[];
  /** reference values shown in the text alternative but not drawn as geometry */
  reference: { label: string; value: string }[];
  topHeight: number | null;
  /** why nothing is drawn, when no volumes exist and the lot geometry itself is fine (null otherwise) */
  emptyMessage: string | null;
}

const fmt = (n: number) => `${Math.round(n * 100) / 100}`;

function edgesFor(env: EnvelopeLike, appliesTo: EnvSetback["appliesTo"], explicit?: number[]): number[] {
  const n = env.lot.polygonLocal.length;
  if (explicit && explicit.length > 0) return explicit.filter((i) => Number.isInteger(i) && i >= 0 && i < n);
  const edges = env.lot.edges;
  const pick = (pred: (e: (typeof edges)[number]) => boolean) => edges.filter(pred).map((e) => e.index).filter((i) => i < n);
  switch (appliesTo) {
    case "rear": return pick((e) => e.kind === "rear");
    case "side": return pick((e) => e.kind === "side");
    case "street_frontage": return pick((e) => e.kind === "front");
    case "wide_street_frontage": return pick((e) => e.kind === "front" && e.street?.width === "wide");
    case "narrow_street_frontage": return pick((e) => e.kind === "front" && e.street?.width === "narrow");
  }
}

/**
 * Merge nearly collinear, same-kind, same-street neighbouring edges (GIS rings often split one lot side into
 * several segments) and remap everything that refers to edges by index.
 */
function simplifyEnvelope(env: EnvelopeLike): EnvelopeLike {
  const poly = ensureCCW(env.lot.polygonLocal);
  const byIndex = new Map(env.lot.edges.map((e) => [e.index, e]));
  const keys = poly.map((_, i) => {
    const e = byIndex.get(i);
    return e ? `${e.kind}|${e.street?.name ?? ""}|${e.street?.width ?? ""}` : "?";
  });
  const m = mergeCollinearEdges(poly, keys);
  if (m.polygon.length === poly.length) return env;
  const remap = (idx?: number[]) =>
    idx ? [...new Set(idx.filter((i) => i >= 0 && i < poly.length).map((i) => m.originalToMerged[i]))] : idx;
  return {
    lot: {
      polygonLocal: m.polygon,
      edges: m.mergedToOriginal.map((orig, j) => {
        const first = byIndex.get(orig[0]);
        return { index: j, kind: first?.kind ?? "unknown", street: first?.street ?? null };
      }),
    },
    controls: {
      ...env.controls,
      setbacks: env.controls.setbacks.map((sb) => ({ ...sb, edgeIndices: remap(sb.edgeIndices) })),
      skyExposure: {
        ...env.controls.skyExposure,
        planes: env.controls.skyExposure.planes?.map((pl) => ({ ...pl, edgeIndices: remap(pl.edgeIndices) })),
      },
    },
  };
}

export const SPLIT_LOT_EMPTY_MESSAGE =
  "Split lot: height and setback are pro-rated by street frontage (ZR 77-28), which this prototype doesn't model. No envelope volume is drawn.";
export const NO_HEIGHTS_EMPTY_MESSAGE = "No heights are set, so no envelope volume is drawn.";

export function buildEnvelopeSolids(input: EnvelopeLike): EnvelopeSolids {
  const out = buildSolids(input);
  if (out.stages.length === 0 && !out.manualGeometry) {
    out.emptyMessage = input.splitLot?.isSplit ? SPLIT_LOT_EMPTY_MESSAGE : NO_HEIGHTS_EMPTY_MESSAGE;
  }
  return out;
}

function buildSolids(input: EnvelopeLike): EnvelopeSolids {
  const env = simplifyEnvelope(input);
  const lot = ensureCCW(env.lot.polygonLocal);
  const n = lot.length;
  const c = env.controls;
  const notDrawn: string[] = [];
  const reference: EnvelopeSolids["reference"] = [];
  const out: EnvelopeSolids = { lot, stages: [], skyPlanes: [], manualGeometry: null, notDrawn, reference, topHeight: null, emptyMessage: null };

  // --- yards -> per-edge insets (applied at every height)
  const yardInsets: number[] = new Array(n).fill(0);
  const shaped: string[] = [];
  const yardDefs = [
    ["front", c.yards.front, "Front yard"],
    ["rear", c.yards.rear, "Rear yard"],
    ["side", c.yards.side, "Side yard"],
  ] as const;
  for (const [kind, v, label] of yardDefs) {
    if (v.value == null) { notDrawn.push(label); continue; }
    if (v.value <= 0) continue;
    for (const e of env.lot.edges) if (e.kind === kind && e.index < n) yardInsets[e.index] += v.value;
    shaped.push(`${label} ${fmt(v.value)} ft`);
  }

  // --- heights
  const baseMax = c.baseHeight.max.value;
  if (baseMax == null) notDrawn.push("Base height max");
  if (c.baseHeight.min.value != null) reference.push({ label: "Base height min", value: `${fmt(c.baseHeight.min.value)} ft (reference, not drawn)` });
  const bldgMax = c.maxBuildingHeight.value;
  if (bldgMax == null) notDrawn.push("Max building height");

  // --- setbacks with complete values
  interface Active { sb: EnvSetback; start: number; depth: number; edges: number[] }
  const active: Active[] = [];
  for (const sb of c.setbacks) {
    if (sb.depth.value == null) { notDrawn.push(`Setback ${sb.id} depth`); continue; }
    if (sb.startHeight.value == null) { notDrawn.push(`Setback ${sb.id} start height`); continue; }
    const edges = edgesFor(env, sb.appliesTo, sb.edgeIndices);
    if (edges.length === 0) { notDrawn.push(`Setback ${sb.id} (no matching lot edge)`); continue; }
    active.push({ sb, start: sb.startHeight.value, depth: sb.depth.value, edges });
  }

  const top = bldgMax ?? baseMax;
  out.topHeight = top;
  if (top == null || top <= 0) {
    return out;
  }

  const cuts = new Set<number>();
  if (baseMax != null && baseMax > 0 && baseMax < top) cuts.add(baseMax);
  for (const a of active) if (a.start > 0 && a.start < top) cuts.add(a.start);
  const bounds = [0, ...[...cuts].sort((a, b) => a - b), top];

  for (let k = 0; k + 1 < bounds.length; k++) {
    const z0 = bounds[k];
    const z1 = bounds[k + 1];
    const insets = [...yardInsets];
    const bits = [...shaped];
    for (const a of active) {
      if (a.start <= z0 + 1e-9) {
        for (const e of a.edges) insets[e] += a.depth;
        bits.push(`${a.sb.id} ${fmt(a.depth)} ft above ${fmt(a.start)} ft`);
      }
    }
    const fp = insetPolygonEdges(lot, insets);
    if (!fp) {
      out.manualGeometry = out.manualGeometry ?? "Lot is not a convex polygon, or the required yards and setbacks consume it. Envelope geometry must be built manually.";
      return { ...out, stages: [] };
    }
    out.stages.push({
      id: `stage-${k}`,
      label: k === 0 ? "Base volume" : `Upper volume ${k}`,
      z0, z1, footprint: fp, shapedBy: bits,
    });
  }

  // --- sky exposure (SIMPLIFIED)
  if (c.skyExposure.status === "manual") {
    notDrawn.push("Sky exposure plane (manual geometry)");
  } else if (c.skyExposure.status === "implemented") {
    for (const p of c.skyExposure.planes ?? []) {
      const solid = skyPlaneSolid(env, lot, p, top);
      if (typeof solid === "string") notDrawn.push(solid);
      else out.skyPlanes.push(...solid);
    }
  }
  return out;
}

function skyPlaneSolid(env: EnvelopeLike, lot: Pt[], p: EnvSkyPlane, top: number): SkyPlaneSolid[] | string {
  if (p.startHeight.value == null) return `Sky exposure ${p.id} start height`;
  if (p.slopeVerticalPerHorizontal.value == null || p.slopeVerticalPerHorizontal.value <= 0) return `Sky exposure ${p.id} slope`;
  if (p.initialSetback && p.initialSetback.value == null) return `Sky exposure ${p.id} initial setback`;
  const start = p.startHeight.value;
  const s0 = p.initialSetback?.value ?? 0;
  const slope = p.slopeVerticalPerHorizontal.value;
  if (start >= top) return [];
  const edges = edgesFor(env, p.appliesTo, p.edgeIndices);
  if (edges.length === 0) return `Sky exposure ${p.id} (no matching lot edge)`;
  const res: SkyPlaneSolid[] = [];
  for (const e of edges) {
    const a = lot[e];
    const b = lot[(e + 1) % lot.length];
    const nrm = inwardNormal(lot, e);
    let extent = 0;
    for (const v of lot) extent = Math.max(extent, (v[0] - a[0]) * nrm[0] + (v[1] - a[1]) * nrm[1]);
    const tTop = s0 + (top - start) / slope;
    const t1 = Math.min(tTop, extent);
    if (t1 <= s0) continue;
    const z1 = start + slope * (t1 - s0);
    const q = (pt: Pt, t: number, z: number): [number, number, number] => [pt[0] + nrm[0] * t, pt[1] + nrm[1] * t, z];
    res.push({
      id: `${p.id}-e${e}`,
      label: `Sky exposure plane ${p.id}`,
      corners: [q(a, s0, start), q(b, s0, start), q(b, t1, z1), q(a, t1, z1)],
      startHeight: start, initialSetback: s0, slope,
    });
  }
  return res;
}
