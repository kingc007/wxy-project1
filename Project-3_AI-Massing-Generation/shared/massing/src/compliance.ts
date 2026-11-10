// Compliance checker (spec §6). Independent of the clipper: it re-measures the final plates against each control
// using restricted strips, so a clipping bug shows up as a Fail. Tolerances: 1 sf per floor, 0.05 ft for lengths.
import { edgeStrip, skyExposureInsetAt } from "./envelope";
import { fmtCf, fmtFar, fmtFt, fmtInt, fmtPct, fmtSf } from "./format";
import { area, intersect } from "./geom2d";
import type {
  Citation,
  ComplianceRow,
  Control,
  EnvelopeModel,
  FloorPlate,
  Metrics,
  Polygon,
  Program,
  ProgramFitRow,
  ProgramSchedule,
  RuleStatus,
} from "./types";
import { PROGRAMS } from "./types";

export const AREA_TOL_SF = 1;
export const LENGTH_TOL_FT = 0.05;
const FAR_TOL = 1e-6;
const PCT_TOL = 1e-4;

const cites = (...cs: (Control | null | undefined)[]): Citation[] => cs.flatMap((c) => (c ? c.citations : []));

function row(p: Partial<ComplianceRow> & Pick<ComplianceRow, "id" | "rule" | "status">): ComplianceRow {
  return {
    shortRule: p.rule,
    allowed: "—",
    allowedValue: null,
    proposed: "—",
    proposedValue: null,
    detail: null,
    citations: [],
    simplified: false,
    ...p,
  };
}

const programName = (u: string) => u.replace(/_/g, " ");

/** Designer scope of a rule from the edges it applies to: long label suffix and short label suffix. */
function scopeOf(model: EnvelopeModel, edgeIndices: readonly number[]): { long: string; short: string } {
  const es = edgeIndices.map((i) => model.edges[i]).filter(Boolean);
  if (es.length && es.every((e) => e.kind === "rear")) return { long: "rear (upper rear yard)", short: "rear" };
  if (es.length && es.every((e) => e.kind === "side")) return { long: "side", short: "side" };
  if (es.length && es.every((e) => e.kind === "front")) {
    if (es.every((e) => e.streetWidth === "wide")) return { long: "wide street", short: "wide st." };
    if (es.every((e) => e.streetWidth === "narrow")) return { long: "narrow street", short: "narrow st." };
  }
  return { long: "street frontages", short: "street" };
}

const st = (ok: boolean): RuleStatus => (ok ? "pass" : "fail");
const floorNo = (k: number) => k + 1;

/** Worst encroachment of the plates into the strips (area sf) and the floor index where it occurs. */
function worstEncroachment(
  floors: readonly FloorPlate[],
  applies: (f: FloorPlate) => boolean,
  strips: (f: FloorPlate) => Polygon[],
): { area: number; floor: number } {
  let worst = { area: 0, floor: -1 };
  for (const f of floors) {
    if (!applies(f)) continue;
    const s = strips(f);
    if (!s.length) continue;
    const a = area(intersect(f.polygons, s));
    if (a > worst.area) worst = { area: a, floor: f.index };
  }
  return worst;
}

export function evaluateCompliance(model: EnvelopeModel, floors: readonly FloorPlate[], metrics: Metrics): ComplianceRow[] {
  const rows: ComplianceRow[] = [];
  const top = (f: FloorPlate) => f.z + f.height;

  // FAR per use
  const missingFar: Program[] = [];
  for (const use of PROGRAMS) {
    const c = model.maxFar[use];
    if (!c) {
      if (metrics.gfaByProgram[use] > 0) {
        missingFar.push(use);
        rows.push(
          row({
            id: `far-${use}`,
            rule: `Floor area ratio (FAR) — ${programName(use)}`,
            shortRule: `FAR · ${programName(use)}`,
            allowed: `No ${programName(use)} FAR in this envelope`,
            proposed: fmtFar(metrics.farByProgram[use]),
            proposedValue: metrics.farByProgram[use],
            status: "review",
            simplified: true,
            detail: `This envelope gives no floor area for ${programName(use)} use; it may not be permitted here. Check use regulations (not modelled).`,
          }),
        );
      }
      continue;
    }
    const v = metrics.farByProgram[use];
    rows.push(
      row({
        id: `far-${use}`,
        rule: `Floor area ratio (FAR) — ${programName(use)}`,
        shortRule: `FAR · ${programName(use)}`,
        allowed: fmtFar(c.value),
        allowedValue: c.value,
        proposed: fmtFar(v),
        proposedValue: v,
        status: st(v <= c.value + FAR_TOL),
        citations: c.citations,
        simplified: true,
        detail: v > c.value + FAR_TOL ? `${fmtSf(metrics.gfaByProgram[use])} proposed against ${fmtInt(c.value * metrics.lotArea)} sf allowed` : null,
      }),
    );
  }
  // FAR total
  const farControls = PROGRAMS.flatMap((u) => (model.maxFar[u] ? [{ use: u, c: model.maxFar[u] as Control }] : []));
  if (farControls.length) {
    const present = farControls.filter((x) => metrics.gfaByProgram[x.use] > 0);
    const pool = present.length ? present : farControls;
    const best = pool.reduce((a, b) => (b.c.value > a.c.value ? b : a));
    const skipped = missingFar.length ? ` Not counted: ${missingFar.map(programName).join(", ")} (no FAR in this envelope), so the total is checked against the highest FAR of the other uses.` : "";
    rows.push(
      row({
        id: "far-total",
        rule: "Floor area ratio (FAR) — total",
        shortRule: "FAR · total",
        allowed: fmtFar(best.c.value),
        allowedValue: best.c.value,
        proposed: fmtFar(metrics.far),
        proposedValue: metrics.far,
        status: st(metrics.far <= best.c.value + FAR_TOL),
        citations: best.c.citations,
        simplified: true,
        detail: `Mixed-use total checked against the highest FAR of the uses present (simplified).${skipped}`,
      }),
    );
  }

  // Height
  if (model.maxBuildingHeight) {
    const c = model.maxBuildingHeight;
    const ok = metrics.height <= c.value + LENGTH_TOL_FT;
    const over = floors.find((f) => top(f) > c.value + LENGTH_TOL_FT);
    rows.push(
      row({
        id: "height",
        rule: "Max building height",
        shortRule: "Height",
        allowed: fmtFt(c.value),
        allowedValue: c.value,
        proposed: fmtFt(metrics.height),
        proposedValue: metrics.height,
        status: st(ok),
        citations: c.citations,
        simplified: true,
        detail: over ? `Floor ${floorNo(over.index)} reaches ${fmtFt(top(over))}` : null,
      }),
    );
  }
  if (model.maxStories) {
    const c = model.maxStories;
    rows.push(
      row({
        id: "stories",
        rule: "Max stories",
        shortRule: "Stories",
        allowed: `${fmtInt(c.value)} stories`,
        allowedValue: c.value,
        proposed: `${fmtInt(metrics.floors)} stories`,
        proposedValue: metrics.floors,
        status: st(metrics.floors <= c.value),
        citations: c.citations,
      }),
    );
  }
  if (model.baseHeightMin) {
    const c = model.baseHeightMin;
    rows.push(
      row({
        id: "base-min",
        rule: "Base height (street wall), min",
        shortRule: "Street wall · min",
        allowed: fmtFt(c.value),
        allowedValue: c.value,
        proposed: fmtFt(metrics.streetWallHeight),
        proposedValue: metrics.streetWallHeight,
        status: st(metrics.streetWallHeight >= c.value - LENGTH_TOL_FT),
        citations: c.citations,
        simplified: true,
      }),
    );
  }
  if (model.baseHeightMax) {
    const c = model.baseHeightMax;
    rows.push(
      row({
        id: "base-max",
        rule: "Base height (street wall), max",
        shortRule: "Street wall · max",
        allowed: fmtFt(c.value),
        allowedValue: c.value,
        proposed: fmtFt(metrics.streetWallHeight),
        proposedValue: metrics.streetWallHeight,
        status: st(metrics.streetWallHeight <= c.value + LENGTH_TOL_FT),
        citations: c.citations,
        simplified: true,
      }),
    );
  }

  // Setbacks
  for (const r of model.setbacks) {
    const d = r.depth.value;
    const sc = scopeOf(model, r.edgeIndices);
    const w = worstEncroachment(
      floors,
      (f) => top(f) > r.startHeight.value,
      () => r.edgeIndices.map((i) => edgeStrip(model, i, d)),
    );
    const ok = w.area <= AREA_TOL_SF;
    rows.push(
      row({
        id: `setback-${r.id}`,
        rule: `Setback above base height — ${sc.long}`,
        shortRule: `Setback · ${sc.short}`,
        allowed: `${fmtFt(d)} above ${fmtFt(r.startHeight.value)}`,
        allowedValue: d,
        proposed: ok ? "Clear" : `${fmtSf(w.area)} inside`,
        proposedValue: w.area,
        status: st(ok),
        citations: cites(r.depth, r.startHeight),
        simplified: true,
        detail: ok ? null : `Floor ${floorNo(w.floor)} crosses the setback by ${fmtSf(w.area)}`,
      }),
    );
  }

  // Yards
  const yardRows: [keyof EnvelopeModel["yards"], string, string][] = [
    ["front", "front", "Front yard"],
    ["rear", "rear", "Rear yard"],
    ["side", "side", "Side yards"],
  ];
  for (const [key, kind, label] of yardRows) {
    const c = model.yards[key];
    if (!c) continue;
    const edges = model.edges.filter((e) => e.kind === kind);
    const w = worstEncroachment(
      floors,
      () => true,
      () => (c.value > 0 ? edges.map((e) => edgeStrip(model, e.index, c.value)) : []),
    );
    const ok = w.area <= AREA_TOL_SF;
    rows.push(
      row({
        id: `yard-${key}`,
        rule: label,
        allowed: fmtFt(c.value),
        allowedValue: c.value,
        proposed: ok ? "Clear" : `${fmtSf(w.area)} inside`,
        proposedValue: w.area,
        status: st(ok),
        citations: c.citations,
        simplified: true,
        detail: ok ? null : `Floor ${floorNo(w.floor)} encroaches on the ${kind} yard by ${fmtSf(w.area)}`,
      }),
    );
  }

  // Lot coverage
  if (model.lotCoverageMax) {
    const c = model.lotCoverageMax;
    rows.push(
      row({
        id: "coverage",
        rule: "Lot coverage",
        shortRule: "Coverage",
        allowed: fmtPct(c.value),
        allowedValue: c.value,
        proposed: fmtPct(metrics.lotCoveragePct),
        proposedValue: metrics.lotCoveragePct,
        status: st(metrics.lotCoveragePct <= c.value + PCT_TOL),
        citations: c.citations,
        simplified: true,
      }),
    );
  }

  // Sky exposure planes
  for (const r of model.skyExposure) {
    const sc = scopeOf(model, r.edgeIndices);
    const w = worstEncroachment(
      floors,
      (f) => top(f) > r.startHeight.value,
      (f) => {
        const d = skyExposureInsetAt(r, top(f));
        return d > 0 ? r.edgeIndices.map((i) => edgeStrip(model, i, d)) : [];
      },
    );
    const ok = w.area <= AREA_TOL_SF;
    rows.push(
      row({
        id: `sep-${r.id}`,
        rule: `Sky exposure plane — ${sc.long}`,
        shortRule: `Sky plane · ${sc.short}`,
        allowed: `${fmtFt(r.startHeight.value)} start, slope ${r.slope.value}:1`,
        allowedValue: r.slope.value,
        proposed: ok ? "Clear" : `${fmtSf(w.area)} inside`,
        proposedValue: w.area,
        status: st(ok),
        citations: cites(r.startHeight, r.slope, r.initialSetback),
        simplified: true,
        detail: ok ? null : `Floor ${floorNo(w.floor)} pierces the plane by ${fmtSf(w.area)}`,
      }),
    );
  }

  // Trimmed
  rows.push(
    row({
      id: "trimmed",
      rule: "Trimmed to envelope",
      shortRule: "Trimmed",
      allowed: "Inside envelope",
      proposed: metrics.trimmedVolume > 0 ? fmtCf(metrics.trimmedVolume) : "None",
      proposedValue: metrics.trimmedVolume,
      status: metrics.trimmedVolume > 0 ? "review" : "pass",
      detail: metrics.trimmedVolume > 0 ? `Trimmed ${fmtCf(metrics.trimmedVolume)} to fit` : null,
    }),
  );

  // Unchecked
  model.unchecked.forEach((u, i) =>
    rows.push(
      u.kind === "not_applicable"
        ? row({ id: `na-${i}`, rule: u.label, allowed: "Not applicable", proposed: "—", status: "na", detail: u.reason === "Not applicable" ? null : u.reason })
        : row({ id: `unchecked-${i}`, rule: u.label, allowed: u.reason, status: "review", detail: u.reason }),
    ),
  );
  return rows;
}

export function overallStatus(rows: readonly ComplianceRow[]): { status: Exclude<RuleStatus, "na">; failCount: number; reviewCount: number; label: string } {
  const failCount = rows.filter((r) => r.status === "fail").length;
  const reviewCount = rows.filter((r) => r.status === "review").length;
  if (failCount > 0) return { status: "fail", failCount, reviewCount, label: `Fails ${failCount} rule(s)` };
  if (reviewCount > 0) return { status: "review", failCount, reviewCount, label: "Needs review" };
  return { status: "pass", failCount, reviewCount, label: "Passes all rules" };
}

/** Program fit (not zoning): per-use target GFA and unit target vs proposed, within +/-5 % is met. */
export function evaluateProgramFit(schedule: ProgramSchedule, metrics: Metrics): ProgramFitRow[] {
  const out: ProgramFitRow[] = [];
  const mk = (use: ProgramFitRow["use"], target: number, proposed: number) => {
    const deltaPct = target > 0 ? ((proposed - target) / target) * 100 : proposed === 0 ? 0 : 100;
    out.push({ use, target, proposed, deltaPct, met: Math.abs(deltaPct) <= 5 });
  };
  for (const u of schedule.uses) {
    if (u.accepted && u.targetGfa !== null && u.targetGfa > 0) mk(u.use, u.targetGfa, metrics.gfaByProgram[u.use]);
  }
  const units = schedule.uses.filter((u) => u.accepted && u.targetUnits !== null && u.targetUnits > 0);
  if (units.length) mk("units", units.reduce((t, u) => t + (u.targetUnits as number), 0), metrics.unitsEst);
  return out;
}
