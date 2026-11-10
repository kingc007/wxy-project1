// Deterministic text + allowed-number lists derived from the EnvelopeModel / schedule / assumptions.
// Everything here is computed from engine data; nothing is typed by hand or by the model.
import {
  PROGRAMS,
  buildEnvelopeModel,
  designFrame,
  fmtFar,
  fmtFt,
  fmtInt,
  fmtPct,
  fmtSf,
  formatEnvelopeErrors,
  initGeometry,
  validateEnvelope,
} from "@wxy/massing";
import type { AllowedNumber, Assumptions, Control, EnvelopeModel, MassingOption, ProgramSchedule } from "@wxy/massing";

export type Compass = "north" | "south" | "east" | "west";
export type Side = "front" | "rear" | "left" | "right";
const COMPASS_VEC: Record<Compass, [number, number]> = { north: [0, 1], south: [0, -1], east: [1, 0], west: [-1, 0] };

/** Which side of the design frame (street = front) a compass direction points to. Left = -u, right = +u, rear = +v. */
export function compassToSide(model: EnvelopeModel, dir: Compass): Side {
  const f = designFrame(model);
  const c = COMPASS_VEC[dir];
  const du = c[0] * f.u[0] + c[1] * f.u[1];
  const dv = c[0] * f.v[0] + c[1] * f.v[1];
  if (Math.abs(dv) >= Math.abs(du)) return dv > 0 ? "rear" : "front";
  return du > 0 ? "right" : "left";
}

/** Signed (du, dv) of a compass direction in the design frame, for moving a tower toward it. */
export function compassInFrame(model: EnvelopeModel, dir: Compass): { du: number; dv: number } {
  const f = designFrame(model);
  const c = COMPASS_VEC[dir];
  return { du: c[0] * f.u[0] + c[1] * f.u[1], dv: c[0] * f.v[0] + c[1] * f.v[1] };
}

/** Narrower dimension of the lot in the design frame (ft). */
export function lotWidth(model: EnvelopeModel): number {
  const f = designFrame(model);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [x, y] of model.lot.outer) {
    const du = (x - f.origin[0]) * f.u[0] + (y - f.origin[1]) * f.u[1];
    const dv = (x - f.origin[0]) * f.v[0] + (y - f.origin[1]) * f.v[1];
    u0 = Math.min(u0, du); u1 = Math.max(u1, du); v0 = Math.min(v0, dv); v1 = Math.max(v1, dv);
  }
  return Math.min(u1 - u0, v1 - v0);
}

export type LoadedModel = { ok: true; model: EnvelopeModel } | { ok: false; message: string };

/** Validate a ZoningEnvelope JSON against the canonical schema, then build the model. Initialises the geometry engine. */
export async function loadModel(envelopeJson: unknown): Promise<LoadedModel> {
  const v = validateEnvelope(envelopeJson);
  if (!v.ok) return { ok: false, message: formatEnvelopeErrors(v.errors) };
  try {
    await initGeometry();
    return { ok: true, model: buildEnvelopeModel(v.envelope) };
  } catch (e) {
    return { ok: false, message: `This file isn't a valid zoning envelope: ${e instanceof Error ? e.message : "could not be read"}.` };
  }
}

const ctl = (c: Control | null | undefined): number[] => (c ? [c.value] : []);

/** All envelope / schedule / assumption numbers an AI sentence may legitimately cite. */
export function contextAllowed(model: EnvelopeModel, schedule: ProgramSchedule, assumptions: Assumptions): AllowedNumber[] {
  const out: AllowedNumber[] = [];
  const add = (label: string, value: number | null | undefined, decimals = 2) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return;
    out.push({ label, value, decimals });
  };
  add("site.lotArea", model.lotArea, -1);
  add("site.lotWidth", lotWidth(model), 1);
  for (const e of model.edges) add(`site.edge${e.index}.length`, e.length, 1);
  for (const [use, c] of Object.entries(model.maxFar)) add(`envelope.maxFar.${use}`, c?.value);
  for (const v of [
    ...ctl(model.maxBuildingHeight),
    ...ctl(model.maxStories),
    ...ctl(model.baseHeightMin),
    ...ctl(model.baseHeightMax),
    ...ctl(model.lotCoverageMax),
    ...ctl(model.yards.front),
    ...ctl(model.yards.rear),
    ...ctl(model.yards.side),
  ])
    add("envelope.control", v);
  for (const s of model.setbacks) {
    add(`envelope.${s.id}.start`, s.startHeight.value);
    add(`envelope.${s.id}.depth`, s.depth.value);
  }
  for (const s of model.skyExposure) {
    add(`envelope.${s.id}.start`, s.startHeight.value);
    add(`envelope.${s.id}.slope`, s.slope.value);
    add(`envelope.${s.id}.initial`, s.initialSetback?.value);
  }
  for (const u of schedule.uses) {
    add(`schedule.${u.use}.gfa`, u.targetGfa, -1);
    add(`schedule.${u.use}.units`, u.targetUnits, 0);
    add(`schedule.${u.use}.floors`, u.floors, 0);
  }
  add("schedule.openSpaceTargetPct", schedule.openSpaceTargetPct, 1);
  for (const p of PROGRAMS) add(`assumptions.floorToFloor.${p}`, assumptions.floorToFloor[p].value, 1);
  add("assumptions.groundFloorHeight", assumptions.groundFloorHeight.value, 1);
  add("assumptions.avgUnitNetSf", assumptions.avgUnitNetSf.value, 0);
  add("assumptions.efficiency", assumptions.efficiency.value, 2);
  add("assumptions.efficiencyPct", assumptions.efficiency.value * 100, 0);
  return out;
}

/** Counts the tool results show the model (failing rules etc.), so it may cite them. */
export function optionCounts(option: MassingOption): AllowedNumber[] {
  return [
    { label: "overall.failCount", value: option.overall.failCount, decimals: 0 },
    { label: "overall.reviewCount", value: option.overall.reviewCount, decimals: 0 },
    { label: "programFit.rows", value: option.programFit.length, decimals: 0 },
  ];
}

/** Compact, deterministic site description for the model's user message. */
export function siteText(model: EnvelopeModel, schedule: ProgramSchedule, assumptions: Assumptions): string {
  const L: string[] = [];
  L.push(`Site ${model.envelopeId}${model.sample ? " (SAMPLE)" : ""}: lot ${fmtSf(model.lotArea)}.`);
  L.push(
    "Edges (index, kind, street width, length): " +
      model.edges.map((e) => `${e.index} ${e.kind}${e.streetWidth ? ` ${e.streetWidth}` : ""} ${fmtFt(e.length)}`).join("; ") +
      ".",
  );
  L.push(`Frontage edge: ${model.frontageEdgeIndex}. "front" is the street side; "rear" the far side; left and right are seen from the street.`);
  L.push(
    "Compass to design frame: " +
      (["north", "east", "south", "west"] as Compass[]).map((d) => `${d} = ${compassToSide(model, d)}`).join(", ") +
      ".",
  );
  const c: string[] = [];
  for (const [use, v] of Object.entries(model.maxFar)) if (v) c.push(`max FAR ${use} ${fmtFar(v.value)}`);
  if (model.maxBuildingHeight) c.push(`max height ${fmtFt(model.maxBuildingHeight.value)}`);
  if (model.maxStories) c.push(`max stories ${fmtInt(model.maxStories.value)}`);
  if (model.baseHeightMin) c.push(`base height min ${fmtFt(model.baseHeightMin.value)}`);
  if (model.baseHeightMax) c.push(`base height max ${fmtFt(model.baseHeightMax.value)}`);
  if (model.lotCoverageMax) c.push(`lot coverage max ${fmtPct(model.lotCoverageMax.value)}`);
  if (model.yards.front) c.push(`front yard ${fmtFt(model.yards.front.value)}`);
  if (model.yards.rear) c.push(`rear yard ${fmtFt(model.yards.rear.value)}`);
  if (model.yards.side) c.push(`side yard ${fmtFt(model.yards.side.value)}`);
  for (const s of model.setbacks) c.push(`setback ${s.id}: ${fmtFt(s.depth.value)} above ${fmtFt(s.startHeight.value)} (edges ${s.edgeIndices.join(",") || "by rule"})`);
  for (const s of model.skyExposure)
    c.push(`sky exposure ${s.id}: slope ${s.slope.value} above ${fmtFt(s.startHeight.value)}${s.initialSetback ? `, initial setback ${fmtFt(s.initialSetback.value)}` : ""}`);
  L.push(`Controls: ${c.join("; ") || "none usable"}.`);
  if (model.unchecked.length) L.push(`Not checked: ${model.unchecked.map((u) => `${u.label} (${u.status})`).join("; ")}.`);
  if (model.simplified) L.push(`Simplified: ${model.simplifications.join("; ")}.`);

  const p: string[] = [];
  for (const u of schedule.uses)
    p.push(
      `${u.use}${u.targetGfa !== null ? ` ${fmtSf(u.targetGfa)}` : ""}${u.targetUnits !== null ? ` ${fmtInt(u.targetUnits)} units` : ""}${u.floors !== null ? ` on ${u.floors} floors` : ""} (${u.placement})`,
    );
  L.push(`Program: ${p.join("; ") || "no targets"}. Ground floor use: ${schedule.groundFloorUse}.`);
  if (schedule.openSpaceTargetPct !== null) L.push(`Open space target: ${fmtPct(schedule.openSpaceTargetPct)}.`);
  if (schedule.publicCourtyard) L.push("The brief asks for a public courtyard.");
  for (const m of schedule.moves) L.push(`Move from brief: ${m.text} [${m.kind}${m.direction ? `, ${m.direction}${["north", "south", "east", "west"].includes(m.direction) ? ` = ${compassToSide(model, m.direction as Compass)} side` : ""}` : ""}]`);
  L.push(
    `Assumptions: floor-to-floor residential ${fmtFt(assumptions.floorToFloor.residential.value)}, commercial ${fmtFt(assumptions.floorToFloor.commercial.value)}, community facility ${fmtFt(assumptions.floorToFloor.community_facility.value)}; ground floor ${fmtFt(assumptions.groundFloorHeight.value)}; average unit ${fmtInt(assumptions.avgUnitNetSf.value)} sf net; efficiency ${fmtInt(assumptions.efficiency.value * 100)}%.`,
  );
  return L.join("\n");
}
