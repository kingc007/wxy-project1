// Program stacking (spec §3). Floor 0 takes the ground-floor use; each non-residential use (ground use first, then
// schedule order) then takes floors until its target GFA (or explicit floor count) is reached; the rest is residential.
// Program for floor k depends only on plates of floors < k, so heights and areas are computed in one pass.
import type { Assumptions, Program, ProgramSchedule, ProgramUse } from "./types";

export const DEFAULT_RATIONALE = "Default design assumption — edit for your project";

const dv = (value: number) => ({ value, source: "default" as const, rationale: DEFAULT_RATIONALE });

/** UI defaults, clearly assumptions (not code values). */
export const DEFAULT_ASSUMPTIONS: Assumptions = {
  floorToFloor: { residential: dv(10), commercial: dv(15), community_facility: dv(13) },
  groundFloorHeight: dv(15),
  avgUnitNetSf: dv(750),
  efficiency: dv(0.8),
};

export const EMPTY_SCHEDULE: ProgramSchedule = {
  uses: [],
  groundFloorUse: "residential",
  openSpaceTargetPct: null,
  publicCourtyard: false,
  moves: [],
  confirmed: true,
};

/** Non-residential uses in stacking order: ground-floor use first, then schedule order. */
export function stackingOrder(schedule: ProgramSchedule): ProgramUse[] {
  const uses = schedule.uses.filter((u) => u.accepted && u.use !== "residential");
  const g = schedule.groundFloorUse;
  const first = uses.filter((u) => u.use === g);
  const rest = uses.filter((u) => u.use !== g);
  return [...first, ...rest];
}

/**
 * Program of floor k given the programs and plate areas of floors 0..k-1.
 * SIMPLIFIED: placement 'upper'/'any' is stacked like 'lower'.
 */
export function programForFloor(schedule: ProgramSchedule, k: number, programs: readonly Program[], areas: readonly number[]): Program {
  if (k === 0) return schedule.groundFloorUse;
  for (const u of stackingOrder(schedule)) {
    let count = 0;
    let acc = 0;
    for (let i = 0; i < k; i++) {
      if (programs[i] === u.use) {
        count++;
        acc += areas[i];
      }
    }
    let done: boolean;
    if (u.floors !== null) done = count >= u.floors;
    else if (u.targetGfa !== null) done = acc >= u.targetGfa;
    else done = true;
    if (!done) return u.use;
  }
  return "residential";
}

/** Whole-stack version: programs for floors with the given plate areas (bottom-up). */
export function assignPrograms(schedule: ProgramSchedule, _assumptions: Assumptions, floorAreas: readonly number[]): Program[] {
  const programs: Program[] = [];
  for (let k = 0; k < floorAreas.length; k++) programs.push(programForFloor(schedule, k, programs, floorAreas));
  return programs;
}

export function floorHeight(assumptions: Assumptions, program: Program, k: number): number {
  return k === 0 ? assumptions.groundFloorHeight.value : assumptions.floorToFloor[program].value;
}
