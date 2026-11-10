// Offline strategy: fitPreset. Deterministic scan of floor counts around a typology preset to bring total GFA closest
// to the program target without creating new Fail rows. Engine calls are ~1 ms, so the scan is exhaustive within bounds.
import { fmtFt, PARAM_SPEC_BY_KEY, TYPOLOGY_PRESETS, classifyTypology, generateOption, presetParams, checkGrounding, allowedNumbersFromOption } from "@wxy/massing";
import type { Assumptions, EnvelopeModel, MassingOption, MassingParams, ProgramSchedule, Typology } from "@wxy/massing";
import { targetAllowed, templateIntent, templateNotes } from "./intent";
import { contextAllowed, lotWidth, optionCounts } from "./site";

export interface FitResult {
  typology: Typology;
  name: string;
  intent: string;
  notes: string[];
  params: MassingParams;
  option: MassingOption;
  targetGfa: number | null;
  /** Number of engine runs the scan used (for tests / dev drawer). */
  evaluated: number;
  /** "typology-not-realisable": no admissible candidate exists on this lot; the best non-empty option of the same slot is shown. */
  fit: "ok" | "typology-not-realisable";
}


/** Σ targetGfa, or units × avg unit ÷ efficiency for a residential use with units only. null when the schedule has no target. */
export function targetGfaOf(schedule: ProgramSchedule, assumptions: Assumptions): number | null {
  let total = 0;
  let any = false;
  for (const u of schedule.uses) {
    if (!u.accepted) continue;
    if (u.targetGfa !== null && u.targetGfa > 0) {
      total += u.targetGfa;
      any = true;
    } else if (u.use === "residential" && u.targetUnits !== null && u.targetUnits > 0) {
      total += (u.targetUnits * assumptions.avgUnitNetSf.value) / assumptions.efficiency.value;
      any = true;
    }
  }
  return any ? total : null;
}


/** Hard cap on engine runs per slot (spec: <= 400). */
export const MAX_FIT_EVALUATIONS = 400;
const STAGE1_BUDGET = 150;
/** Stage 2 refines this many distinct stage-1 candidates (by baseFloors), plus the best street-wall-compliant ones. */
const REFINE_TOP_K = 4;
const REFINE_STREET_WALL = 3;

type Key = number[];
const lexLess = (a: Key, b: Key) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
};

/**
 * Per-use fit: the largest |delta %| over the option's program rows. Rows of a use with an explicit `floors` count are
 * excluded (the floors fix that use's size; its real delta is still reported in programFit and the notes).
 * With no usable rows, falls back to the relative total-GFA miss.
 */
function worstDelta(o: MassingOption, schedule: ProgramSchedule, targetGfa: number | null): number {
  const fixed = new Set(schedule.uses.filter((u) => u.accepted && u.floors !== null).map((u) => u.use));
  const rows = o.programFit.filter((r) => r.use === "units" || !fixed.has(r.use));
  if (rows.length) return Math.round(Math.max(...rows.map((r) => Math.abs(r.deltaPct))) * 1e6) / 1e6;
  return targetGfa ? Math.round((Math.abs(o.metrics.gfa - targetGfa) / targetGfa) * 1e8) / 1e6 : 0;
}

/**
 * Admissible = the option still IS its slot's typology and its defining move is really present in the geometry.
 * The fitter may shrink the move (tower coverage, base depth, base floors) but never delete it.
 */
export function isAdmissible(typology: Typology, o: MassingOption, rerun: (p: MassingParams) => MassingOption): boolean {
  const p = o.params;
  if (classifyTypology(p) !== typology) return false;
  const upperRealised = o.floors.length - p.baseFloors;
  const floor0 = o.floors[0];
  switch (typology) {
    case "podium_tower":
    case "slab_bar":
      return p.upperMode === "tower" && p.upperFloors >= 2 && upperRealised >= 2;
    case "perimeter_courtyard":
      return p.ringDepth > 0 && (p.upperMode === "none" || p.upperFloors >= 2) && !!floor0 && floor0.polygons.some((poly) => poly.holes.length > 0);
    case "stepped_terraces":
      return p.upperMode === "extrude" && p.stepEvery > 0 && p.stepDepth > 0 && p.upperFloors >= Math.max(2, p.stepEvery) && upperRealised >= 1;
    case "split_massing":
      return p.parts >= 2 && p.gapWidth > 0 && !!floor0 && floor0.polygons.length >= 2 && (p.upperMode === "none" || p.upperFloors >= 2);
    case "carved_volume": {
      if (!(p.carveWidth > 0 && p.carveDepth > 0)) return false;
      const without = rerun({ ...p, carveWidth: 0, carveDepth: 0 });
      const k = Math.min(p.carveFromFloor, o.floors.length - 1);
      return k >= 0 && !!without.floors[k] && o.floors[k].area < without.floors[k].area - 1;
    }
  }
}

/**
 * Allowed floor area when the schedule sets no target: residential FAR × lot area (an empty schedule stacks as
 * residential), else the highest FAR in the envelope. null when the envelope has no FAR control.
 */
export function zoningCapacityGfa(model: EnvelopeModel): number | null {
  const res = model.maxFar.residential?.value;
  const far = res ?? Math.max(...Object.values(model.maxFar).map((c) => c?.value ?? 0), 0);
  return far > 0 ? far * model.lotArea : null;
}

export function fitPreset(typology: Typology, model: EnvelopeModel, schedule: ProgramSchedule, assumptions: Assumptions): FitResult {
  const preset = presetParams(typology);
  const scheduleTarget = targetGfaOf(schedule, assumptions);
  // No program target: fit floors to the allowed floor area, so options don't exceed FAR by default.
  const target = scheduleTarget ?? zoningCapacityGfa(model);
  let evaluated = 0;
  let notRealisable = false;
  const run = (p: MassingParams) => {
    evaluated++;
    return generateOption(model, schedule, assumptions, p);
  };
  const base = run(preset);
  let best: { option: MassingOption; params: MassingParams } = { option: base, params: preset };

  {
    // Key: zero-Fail first; fewer Fails; not heavily trimmed (trim > 5 % of built volume — manager decision 2026-10-26: small
    // trims are normal under sky exposure planes); worst per-use delta in 5-point buckets; untrimmed; exact delta; fewer
    // Reviews; fewer floors.
    const key = (o: MassingOption): Key => {
      const f = o.overall.failCount;
      return [f === 0 ? 0 : 1, f, o.metrics.trimmedVolume > 0.05 * Math.max(o.metrics.volume, 1) ? 1 : 0, Math.round(worstDelta(o, schedule, target) / 5), o.metrics.trimmedVolume > 0.5 ? 1 : 0, worstDelta(o, schedule, target), o.overall.reviewCount, o.metrics.floors];
    };
    let bestKey: Key | null = null;
    let fallback: { option: MassingOption; params: MassingParams; key: Key } | null = null; // best non-empty, admissible or not
    let lastKey: Key | null = null;
    const cands: { params: MassingParams; option: MassingOption; key: Key }[] = [];
    best = { option: base, params: preset }; // fallback if nothing is admissible: the preset, never another typology
    const tryParams = (p: MassingParams, known?: MassingOption): MassingOption | null => {
      if (!known && evaluated >= MAX_FIT_EVALUATIONS) return null;
      const o = known ?? run(p);
      lastKey = null;
      if (o.metrics.gfa > 0) {
        const fk = key(o);
        if (!fallback || lexLess(fk, fallback.key)) fallback = { option: o, params: p, key: fk };
      }
      if (isAdmissible(typology, o, run)) {
        const k = key(o);
        lastKey = k;
        cands.push({ params: p, option: o, key: k });
        if (!bestKey || lexLess(k, bestKey)) {
          best = { option: o, params: p };
          bestKey = k;
        }
      }
      return o;
    };
    tryParams(preset, base);
    const spec = (k: keyof MassingParams) => PARAM_SPEC_BY_KEY[k] as { min: number; max: number; step: number };
    if (target !== null) {
    // every typology scans the full baseFloors range, nearest to the preset first so the run budget favours small changes
    const bases = range(spec("baseFloors").min, spec("baseFloors").max, 1).sort((x, y) => Math.abs(x - preset.baseFloors) - Math.abs(y - preset.baseFloors) || x - y);
    const minUpper = preset.upperMode === "none" ? preset.upperFloors : typology === "stepped_terraces" ? Math.max(2, preset.stepEvery) : 2;
    const uppers = preset.upperMode === "none" ? [preset.upperFloors] : range(minUpper, spec("upperFloors").max, 1);

    // stage 1a: coarse sweep (every 2nd upper count) so every baseFloors value is visited before any fine sweep.
    // More floors cannot help once the stack stops growing or is far past the target.
    const sweep = (b: number, list: number[], budget: number) => {
      let prev = -1;
      for (const u of list) {
        if (evaluated >= budget) return;
        const o = tryParams({ ...preset, baseFloors: b, upperFloors: u });
        if (!o) return;
        if (list.length > 1 && ((o.metrics.gfa <= prev + 1e-6 && u > list[0]) || o.metrics.gfa >= target * 1.6)) return;
        prev = o.metrics.gfa;
      }
    };
    const coarse = uppers.filter((_, i) => i % 2 === 0);
    for (const b of bases) sweep(b, coarse, STAGE1_BUDGET);
    // stage 1b: fine sweep of every upper count at the best base so far
    sweep(best.params.baseFloors, uppers, STAGE1_BUDGET + 80);

    // stage 2: shrink/enlarge the move itself instead of deleting it. Refines the top-K distinct stage-1 candidates and the
    // best candidates that meet the street-wall minimum (when usable), coarse scan then fine scan around the coarse best.
    const refine: (keyof MassingParams)[] = ["baseDepth"];
    if (preset.upperMode === "tower") refine.push("towerCoverage");
    if (typology === "perimeter_courtyard") refine.push("ringDepth");
    if (typology === "split_massing") refine.push("gapWidth");
    if (typology === "stepped_terraces") refine.push("stepDepth");
    const byKey = [...cands].sort((x, y) => (lexLess(x.key, y.key) ? -1 : lexLess(y.key, x.key) ? 1 : 0));
    const chosen: MassingParams[] = [];
    const usedBases = new Set<number>();
    for (const c of byKey) {
      if (chosen.length >= REFINE_TOP_K) break;
      if (usedBases.has(c.params.baseFloors)) continue;
      usedBases.add(c.params.baseFloors);
      chosen.push(c.params);
    }
    const minWall = model.baseHeightMin?.value;
    if (minWall !== undefined) {
      let n = 0;
      for (const c of byKey) {
        if (n >= REFINE_STREET_WALL) break;
        if (c.option.metrics.streetWallHeight < minWall - 0.05 || usedBases.has(c.params.baseFloors)) continue;
        usedBases.add(c.params.baseFloors);
        chosen.push(c.params);
        n++;
      }
    }
    let capped = false;
    const scan = (center: MassingParams, k: keyof MassingParams): MassingParams => {
      const sp = spec(k);
      const lo = k === "ringDepth" ? 25 : k === "gapWidth" || k === "stepDepth" ? sp.step : sp.min;
      const coarseStep = sp.step * Math.max(1, Math.round((sp.max - lo) / sp.step / 12));
      const same = (a: MassingParams) => JSON.stringify(a) === JSON.stringify(center);
      let bestHere = { p: center, key: (cands.find((c) => same(c.params))?.key ?? null) as Key | null };
      const probe = (v: number) => {
        const p = { ...center, [k]: Number(v.toFixed(6)) } as MassingParams;
        if (v === center[k] as number) return true;
        const o = tryParams(p);
        if (!o) {
          capped = true;
          return false;
        }
        const kk = lastKey as Key | null;
        if (kk && (!bestHere.key || lexLess(kk, bestHere.key))) bestHere = { p, key: kk };
        return true;
      };
      for (let v = lo; v <= sp.max + 1e-9; v += coarseStep) if (!probe(v)) return bestHere.p;
      const mid = bestHere.p[k] as number;
      for (let v = Math.max(lo, mid - coarseStep + sp.step); v < Math.min(sp.max, mid + coarseStep) + 1e-9; v += sp.step) if (v !== mid && !probe(v)) return bestHere.p;
      return bestHere.p;
    };
    for (const start of chosen) {
      let cur = start;
      for (const k of refine) {
        if (capped) break;
        cur = scan(cur, k);
      }
      if (capped) break;
    }
    // stage 3: re-settle the floor count next to the refined plate size
    const c = best.params;
    for (const d of [-2, -1, 1, 2]) {
      if (preset.upperMode !== "none") {
        const u = c.upperFloors + d;
        if (u >= minUpper && u <= spec("upperFloors").max) tryParams({ ...c, upperFloors: u });
      }
      const b = c.baseFloors + d;
      if (b >= spec("baseFloors").min && b <= spec("baseFloors").max) tryParams({ ...c, baseFloors: b });
    }
    }

    // relaxed phase: no admissible candidate yet -> smallest gap / ring / carve / step that still realises the move, plus floor sweeps
    if (!bestKey) {
      const overlays: Partial<MassingParams>[] =
        typology === "split_massing"
          ? [MIN_MOVE.gapWidth, 10, 15, 20].map((g) => ({ parts: 2, gapWidth: g }))
          : typology === "perimeter_courtyard"
            ? [{ ringDepth: MIN_MOVE.ringDepth }]
            : typology === "carved_volume"
              ? [{ carveWidth: MIN_MOVE.carveWidth, carveDepth: MIN_MOVE.carveDepth }, { carveWidth: 20, carveDepth: 10 }, { carveWidth: 10, carveDepth: 20 }]
              : typology === "stepped_terraces"
                ? [{ stepDepth: 5 }, { stepDepth: 5, stepEvery: 1 }]
                : [{ towerCoverage: 8 }, { towerCoverage: 15 }];
      const minU = preset.upperMode === "none" ? preset.upperFloors : typology === "stepped_terraces" ? 2 : 2;
      const ups = preset.upperMode === "none" ? [preset.upperFloors] : range(minU, 40, 2);
      const baseList = range(1, 15, 1).sort((x, y) => Math.abs(x - preset.baseFloors) - Math.abs(y - preset.baseFloors) || x - y);
      for (const ov of overlays) {
        for (const b of baseList) {
          let prevG = -1;
          for (const u of ups) {
            if (evaluated >= MAX_FIT_EVALUATIONS) break;
            const o = tryParams({ ...preset, ...ov, baseFloors: b, upperFloors: u });
            if (!o) break;
            if (ups.length > 1 && o.metrics.gfa <= prevG + 1e-6 && u > ups[0]) break;
            prevG = o.metrics.gfa;
          }
          if (bestKey && b >= preset.baseFloors + 2) break;
        }
        if (bestKey) break;
      }
    }
    if (!bestKey) {
      notRealisable = true;
      // never return an empty option: best non-empty candidate, else the preset
      const fb = fallback as { option: MassingOption; params: MassingParams } | null;
      best = fb ? { option: fb.option, params: fb.params } : { option: base, params: preset };
    }
  }

  const option = best.option;
  const intent = templateIntent(typology, option);
  const notes =
    option.programFit.length > 0
      ? templateNotes(option)
      : target !== null
        ? ["No program target in the schedule; floors were fitted to the allowed floor area."]
        : ["No program target in the schedule; the typology preset is shown unchanged."];
  if (notRealisable) notes.unshift(notRealisableNote(typology, model));
  return { typology, name: TYPOLOGY_PRESETS[typology].name, intent, notes, params: best.params, option, targetGfa: scheduleTarget, evaluated, fit: notRealisable ? "typology-not-realisable" : "ok" };
}

/** Smallest move that still realises each typology (what the relaxed phase tries). */
export const MIN_MOVE = { ringDepth: 25, gapWidth: 5, carveWidth: 10, carveDepth: 10 } as const;

/** Designer-readable reason; numbers come only from the lot geometry and the smallest move that was tried. */
export function notRealisableNote(typology: Typology, model: EnvelopeModel): string {
  const width = fmtFt(lotWidth(model));
  switch (typology) {
    case "perimeter_courtyard":
      return `Perimeter courtyard doesn't fit this lot: a ${MIN_MOVE.ringDepth}-ft ring leaves no courtyard on a ${width}-wide lot.`;
    case "split_massing":
      return `Split massing doesn't fit this lot: a ${MIN_MOVE.gapWidth}-ft gap leaves no separate volumes on a ${width}-wide lot.`;
    case "carved_volume":
      return `Carved volume doesn't fit this lot: a ${MIN_MOVE.carveWidth} by ${MIN_MOVE.carveDepth} ft carve removes no floor area on a ${width}-wide lot.`;
    case "stepped_terraces":
      return `Stepped terraces don't fit this lot: no step survives the envelope on a ${width}-wide lot.`;
    default:
      return `${TYPOLOGY_PRESETS[typology].name} doesn't fit this lot: no tower of at least two floors fits inside the envelope on a ${width}-wide lot.`;
  }
}

/** Grounding check used by tests and the routes for any built-in text. */
export function checkBuiltinText(text: string, option: MassingOption, model: EnvelopeModel, schedule: ProgramSchedule, assumptions: Assumptions, target: number | null) {
  return checkGrounding(text, [...allowedNumbersFromOption(option, [...contextAllowed(model, schedule, assumptions), ...optionCounts(option), ...targetAllowed(target)])]);
}

function range(a: number, b: number, step: number): number[] {
  const r: number[] = [];
  for (let i = a; i <= b; i += step) r.push(i);
  return r;
}
