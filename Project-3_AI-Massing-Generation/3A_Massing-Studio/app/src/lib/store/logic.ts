// Pure studio state transitions (no React, no zustand, no Date): unit-tested in __tests__/logic.test.ts.
// The engine is the only source of numbers; every transition re-runs generateOption from parameters.
import {
  DEFAULT_PARAMS,
  generateOption,
  validateParams,
  type Assumptions,
  type EnvelopeModel,
  type MassingOption,
  type MassingParams,
  type Program,
  type ProgramSchedule,
  type ProgramUse,
} from "@wxy/massing";

export const OPTION_COUNT = 6;

export type SlotSource = "ai" | "builtin";

export interface GenCtx {
  model: EnvelopeModel;
  schedule: ProgramSchedule;
  assumptions: Assumptions;
}

export interface HistoryEntry {
  id: string;
  kind: "manual" | "diff";
  /** Consecutive manual edits of the same parameter share a key and collapse into one entry. */
  groupKey: string | null;
  instruction: string;
  /** Display time, e.g. "14:32" (supplied by the caller; this module never reads the clock). */
  at: string;
  /** Parameters (and intent) as they were BEFORE this entry's change. Undo restores them. */
  prevParams: MassingParams;
  prevIntent: string;
}

export interface OptionSlot {
  index: number;
  option: MassingOption;
  /** Typology the slot started as; keeps the parameter panel's lead group stable while the designer edits. */
  leadTypology: MassingOption["typology"];
  name: string;
  intent: string;
  /** True once the designer has typed their own intent text. */
  intentEdited: boolean;
  source: SlotSource;
  notes: string[];
  history: HistoryEntry[];
}

export interface SlotProposal {
  name: string;
  intent: string;
  params: Partial<MassingParams>;
  notes?: string[];
}

export type ParamValue = number | string | boolean;
export interface ParamChange {
  key: keyof MassingParams;
  to: ParamValue;
  from?: ParamValue;
  reason?: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function runGenerate(ctx: GenCtx, params: MassingParams): Result<MassingOption> {
  try {
    return { ok: true, value: generateOption(ctx.model, ctx.schedule, ctx.assumptions, params) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't generate this option." };
  }
}

export function makeSlot(index: number, ctx: GenCtx, p: SlotProposal, source: SlotSource): Result<OptionSlot> {
  const params: MassingParams = { ...DEFAULT_PARAMS, ...p.params };
  const v = validateParams(params);
  if (!v.ok) return { ok: false, error: v.errors.join("; ") };
  const r = runGenerate(ctx, params);
  if (!r.ok) return r;
  return {
    ok: true,
    value: { index, option: r.value, leadTypology: r.value.typology, name: p.name, intent: p.intent, intentEdited: false, source, notes: p.notes ?? [], history: [] },
  };
}

/** Parameters after applying changes; errors (range/step/enum) are returned, never clamped. */
export function paramsWithChanges(params: MassingParams, changes: readonly ParamChange[]): Result<MassingParams> {
  const patch: Record<string, ParamValue> = {};
  for (const c of changes) patch[c.key] = c.to;
  const v = validateParams(patch as Partial<MassingParams>);
  if (!v.ok) return { ok: false, error: v.errors.join("; ") };
  return { ok: true, value: { ...params, ...patch } as MassingParams };
}

function pushHistory(history: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const top = history[history.length - 1];
  if (entry.kind === "manual" && entry.groupKey && top && top.kind === "manual" && top.groupKey === entry.groupKey) {
    return history; // same slider still being dragged: keep the original "before"
  }
  return [...history, entry];
}

/** Live parameter edit. Returns the slot unchanged plus an error if the value is invalid. */
export function setParam(
  slot: OptionSlot,
  ctx: GenCtx,
  key: keyof MassingParams,
  value: ParamValue,
  meta: { entryId: string; at: string; label: string },
): Result<OptionSlot> {
  if (slot.option.params[key] === value) return { ok: true, value: slot };
  const next = paramsWithChanges(slot.option.params, [{ key, to: value }]);
  if (!next.ok) return next;
  const r = runGenerate(ctx, next.value);
  if (!r.ok) return r;
  const entry: HistoryEntry = {
    id: meta.entryId,
    kind: "manual",
    groupKey: key,
    instruction: `Set ${meta.label}`,
    at: meta.at,
    prevParams: slot.option.params,
    prevIntent: slot.intent,
  };
  return { ok: true, value: { ...slot, option: r.value, history: pushHistory(slot.history, entry) } };
}

/** Apply a reviewed diff (from /api/iterate) as one history entry. */
export function applyDiff(
  slot: OptionSlot,
  ctx: GenCtx,
  changes: readonly ParamChange[],
  meta: { entryId: string; at: string; instruction: string },
): Result<OptionSlot> {
  const next = paramsWithChanges(slot.option.params, changes);
  if (!next.ok) return next;
  const r = runGenerate(ctx, next.value);
  if (!r.ok) return r;
  const entry: HistoryEntry = {
    id: meta.entryId,
    kind: "diff",
    groupKey: null,
    instruction: meta.instruction,
    at: meta.at,
    prevParams: slot.option.params,
    prevIntent: slot.intent,
  };
  return { ok: true, value: { ...slot, option: r.value, history: pushHistory(slot.history, entry) } };
}

/** Undo = pop the newest history entry and restore its parameters. */
export function undoSlot(slot: OptionSlot, ctx: GenCtx): Result<OptionSlot> {
  const top = slot.history[slot.history.length - 1];
  if (!top) return { ok: false, error: "Nothing to undo." };
  const r = runGenerate(ctx, top.prevParams);
  if (!r.ok) return r;
  return { ok: true, value: { ...slot, option: r.value, history: slot.history.slice(0, -1) } };
}

export function setIntent(slot: OptionSlot, intent: string): OptionSlot {
  return { ...slot, intent, intentEdited: true };
}

/** Re-run every slot after assumptions or schedule change. Params are kept; slots that fail are kept as-is with an error. */
export function regenerateSlots(
  slots: readonly (OptionSlot | null)[],
  ctx: GenCtx,
): { slots: (OptionSlot | null)[]; errors: string[] } {
  const errors: string[] = [];
  const out = slots.map((s) => {
    if (!s) return s;
    const r = runGenerate(ctx, s.option.params);
    if (!r.ok) {
      errors.push(`Option ${s.index + 1}: ${r.error}`);
      return s;
    }
    return { ...s, option: r.value };
  });
  return { slots: out, errors };
}

// ---------- schedule ----------
export function canConfirmSchedule(schedule: ProgramSchedule | null): boolean {
  return !!schedule && schedule.uses.every((u) => u.accepted);
}

export function acceptUse(schedule: ProgramSchedule, use: Program): ProgramSchedule {
  return { ...schedule, confirmed: false, uses: schedule.uses.map((u) => (u.use === use ? { ...u, accepted: true } : u)) };
}

export function acceptAllUses(schedule: ProgramSchedule): ProgramSchedule {
  return { ...schedule, confirmed: false, uses: schedule.uses.map((u) => ({ ...u, accepted: true })) };
}

/** Editing a row accepts it and tags it as the designer's own value. */
export function editUse(schedule: ProgramSchedule, use: Program, patch: Partial<Pick<ProgramUse, "targetGfa" | "targetUnits">>): ProgramSchedule {
  return {
    ...schedule,
    confirmed: false,
    uses: schedule.uses.map((u) => (u.use === use ? { ...u, ...patch, source: "user" as const, accepted: true } : u)),
  };
}

export function editOpenSpaceTarget(schedule: ProgramSchedule, pct: number | null): ProgramSchedule {
  return { ...schedule, confirmed: false, openSpaceTargetPct: pct };
}

export function confirmSchedule(schedule: ProgramSchedule): ProgramSchedule {
  return canConfirmSchedule(schedule) ? { ...schedule, confirmed: true } : schedule;
}

// ---------- assumptions ----------
export type AssumptionKey = "floorToFloor.residential" | "floorToFloor.commercial" | "floorToFloor.community_facility" | "groundFloorHeight" | "avgUnitNetSf" | "efficiency";

export function setAssumption(a: Assumptions, key: AssumptionKey, value: number): Assumptions {
  const edit = (v: Assumptions["groundFloorHeight"]) => ({ ...v, value, source: "user" as const, rationale: "Edited by you" });
  if (key.startsWith("floorToFloor.")) {
    const p = key.split(".")[1] as Program;
    return { ...a, floorToFloor: { ...a.floorToFloor, [p]: edit(a.floorToFloor[p]) } };
  }
  return { ...a, [key]: edit(a[key as "groundFloorHeight" | "avgUnitNetSf" | "efficiency"]) };
}
