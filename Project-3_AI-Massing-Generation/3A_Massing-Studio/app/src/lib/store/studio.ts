"use client";
// Studio state (zustand). Heavy lifting lives in ./logic (pure, tested); actions here only wire state to it.
import { create } from "zustand";
import {
  DEFAULT_ASSUMPTIONS,
  EMPTY_SCHEDULE,
  type Assumptions,
  type EnvelopeModel,
  type MassingParams,
  type ProgramSchedule,
} from "@wxy/massing";
import type { ContextBuilding, ViewerStyle } from "@/components/viewer/types";
import type { AiStatus, Usage } from "@/lib/studio/api";
import { freshAnnouncement, selectionAnnouncement } from "@/lib/studio/format";
import type { SiteSidecar } from "@/lib/studio/samples";
import {
  OPTION_COUNT,
  acceptAllUses,
  acceptUse,
  applyDiff,
  confirmSchedule,
  editOpenSpaceTarget,
  editUse,
  regenerateSlots,
  setAssumption,
  setIntent,
  setParam,
  undoSlot,
  type AssumptionKey,
  type GenCtx,
  type OptionSlot,
  type ParamChange,
  type ParamValue,
} from "./logic";
import type { Program, ProgramUse } from "@wxy/massing";

export type StepId = "site" | "brief" | "schedule" | "assumptions" | "none";
export type ViewMode = "compare" | "focus";
export type SunPresetId = "mar21" | "jun21" | "dec21";

export interface Proposal {
  index: number;
  instruction: string;
  changes: ParamChange[];
  source: "ai" | "builtin" | null;
}

export interface UsageRun {
  label: string;
  usage: Usage;
  /** false for per-option rows already included in a run total. */
  counted: boolean;
}

export interface StudioState {
  // site
  siteId: string | null;
  siteIsSample: boolean;
  envelopeRaw: unknown | null;
  model: EnvelopeModel | null;
  site: SiteSidecar | null;
  context: ContextBuilding[];
  reviewFlags: string[];
  envelopeError: string | null;
  // brief / schedule / assumptions
  brief: string;
  briefStatus: "idle" | "loading" | "error";
  briefError: string | null;
  briefWarning: string | null;
  schedule: ProgramSchedule | null;
  assumptions: Assumptions;
  // options
  slots: (OptionSlot | null)[];
  gen: { phase: "idle" | "running" | "done" | "error"; done: number; message: string | null };
  selectedIndex: number | null;
  viewMode: ViewMode;
  // viewer
  style: ViewerStyle;
  sun: { enabled: boolean; preset: SunPresetId; minutes: number };
  sectionCutZ: number | null;
  // ui
  mode: "ai" | "builtin";
  thinkingSlot: number | null;
  activeStep: StepId;
  aiStatus: AiStatus | null;
  proposal: Proposal | null;
  proposalStatus: "idle" | "loading" | "error";
  proposalError: string | null;
  usageRuns: UsageRun[];
  devOpen: boolean;
  exportOpen: boolean;
  /** Text for the polite live region (progress, metric changes). */
  announcement: string;
  /** Bumped when the "set down" animation should play (all six landed). */
  settleNonce: number;
  /** Set by actions when they want a transient notice (toast-like, shown near the footer). */
  notice: string | null;
  /** Site Brief handoff: "waiting" while the lot is being received, "failed" after timeout or a bad envelope. */
  handoff: "idle" | "waiting" | "failed";
}

const initial: StudioState = {
  siteId: null,
  siteIsSample: false,
  envelopeRaw: null,
  model: null,
  site: null,
  context: [],
  reviewFlags: [],
  envelopeError: null,
  brief: "",
  briefStatus: "idle",
  briefError: null,
  briefWarning: null,
  schedule: null,
  assumptions: DEFAULT_ASSUMPTIONS,
  slots: Array(OPTION_COUNT).fill(null),
  gen: { phase: "idle", done: 0, message: null },
  selectedIndex: null,
  viewMode: "compare",
  style: "model",
  sun: { enabled: false, preset: "jun21", minutes: 720 },
  sectionCutZ: null,
  mode: "ai",
  thinkingSlot: null,
  activeStep: "site",
  aiStatus: null,
  proposal: null,
  proposalStatus: "idle",
  proposalError: null,
  usageRuns: [],
  devOpen: false,
  exportOpen: false,
  announcement: "",
  settleNonce: 0,
  notice: null,
  handoff: "idle",
};

export interface StudioActions {
  set: (p: Partial<StudioState>) => void;
  announce: (text: string) => void;
  reset: () => void;
  ctx: () => GenCtx | null;
  setBrief: (t: string) => void;
  setScheduleRaw: (s: ProgramSchedule | null) => void;
  acceptUse: (u: Program) => void;
  acceptAll: () => void;
  editUse: (u: Program, patch: Partial<Pick<ProgramUse, "targetGfa" | "targetUnits">>) => void;
  editOpenSpace: (pct: number | null) => void;
  confirm: () => void;
  editAssumption: (k: AssumptionKey, v: number) => void;
  mergeAssumptions: (a: Partial<Assumptions>) => void;
  select: (i: number | null) => void;
  setParam: (index: number, key: keyof MassingParams, value: ParamValue, label: string, at: string) => string | null;
  applyProposal: (at: string) => string | null;
  undo: (index?: number) => string | null;
  setIntent: (index: number, text: string) => void;
  addUsage: (label: string, usage: Usage, counted?: boolean) => void;
}

let entrySeq = 0;
const nextEntryId = () => `h${++entrySeq}`;

export const useStudio = create<StudioState & StudioActions>()((set, get) => {
  const ctx = (): GenCtx | null => {
    const s = get();
    if (!s.model || !s.schedule) return null;
    return { model: s.model, schedule: s.schedule, assumptions: s.assumptions };
  };
  /** After schedule/assumption edits: regenerate every filled slot from its parameters. */
  const regen = (over: Partial<Pick<StudioState, "schedule" | "assumptions">>) => {
    const s = get();
    const model = s.model;
    const schedule = over.schedule ?? s.schedule;
    const assumptions = over.assumptions ?? s.assumptions;
    if (!model || !schedule || !s.slots.some(Boolean)) {
      set(over);
      return;
    }
    const r = regenerateSlots(s.slots, { model, schedule, assumptions });
    set({ ...over, slots: r.slots, announcement: r.errors.length ? r.errors[0] : "Metrics updated for all options." });
  };

  return {
    ...initial,
    set: (p) => set(p),
    announce: (text) => set((s) => ({ announcement: freshAnnouncement(s.announcement, text) })),
    reset: () => set({ ...initial, aiStatus: get().aiStatus, usageRuns: get().usageRuns, style: get().style }),
    ctx,
    setBrief: (brief) => set({ brief }),
    setScheduleRaw: (schedule) => regen({ schedule }),
    acceptUse: (u) => {
      const s = get().schedule;
      if (s) regen({ schedule: acceptUse(s, u) });
    },
    acceptAll: () => {
      const s = get().schedule;
      if (s) regen({ schedule: acceptAllUses(s) });
    },
    editUse: (u, patch) => {
      const s = get().schedule;
      if (s) regen({ schedule: editUse(s, u, patch) });
    },
    editOpenSpace: (pct) => {
      const s = get().schedule;
      if (s) set({ schedule: editOpenSpaceTarget(s, pct) });
    },
    confirm: () => {
      const s = get().schedule;
      if (s) set({ schedule: confirmSchedule(s), activeStep: "assumptions" });
    },
    editAssumption: (k, v) => regen({ assumptions: setAssumption(get().assumptions, k, v) }),
    mergeAssumptions: (a) => {
      const cur = get().assumptions;
      set({
        assumptions: {
          floorToFloor: { ...cur.floorToFloor, ...(a.floorToFloor ?? {}) },
          groundFloorHeight: a.groundFloorHeight ?? cur.groundFloorHeight,
          avgUnitNetSf: a.avgUnitNetSf ?? cur.avgUnitNetSf,
          efficiency: a.efficiency ?? cur.efficiency,
        },
      });
    },
    select: (i) => {
      const slot = i === null ? null : get().slots[i];
      set({ selectedIndex: i, proposal: null, proposalStatus: "idle", proposalError: null });
      if (slot && i !== null) get().announce(selectionAnnouncement(i, slot.name, slot.option));
    },
    setParam: (index, key, value, label, at) => {
      const c = ctx();
      const slot = get().slots[index];
      if (!c || !slot) return null;
      const r = setParam(slot, c, key, value, { entryId: nextEntryId(), at, label });
      if (!r.ok) return r.error;
      const slots = get().slots.slice();
      slots[index] = r.value;
      set({ slots });
      return null;
    },
    applyProposal: (at) => {
      const { proposal, slots } = get();
      const c = ctx();
      if (!proposal || !c) return null;
      const slot = slots[proposal.index];
      if (!slot) return null;
      const r = applyDiff(slot, c, proposal.changes, { entryId: nextEntryId(), at, instruction: proposal.instruction });
      if (!r.ok) return r.error;
      const next = slots.slice();
      next[proposal.index] = r.value;
      set({ slots: next, proposal: null, proposalStatus: "idle", notice: "Changes applied. ⌘Z to undo." });
      return null;
    },
    undo: (index) => {
      const s = get();
      const i = index ?? s.selectedIndex;
      const c = ctx();
      if (i === null || !c) return null;
      const slot = s.slots[i];
      if (!slot || slot.history.length === 0) return null;
      const r = undoSlot(slot, c);
      if (!r.ok) return r.error;
      const next = s.slots.slice();
      next[i] = r.value;
      set({ slots: next, notice: "Undone." });
      return null;
    },
    setIntent: (index, text) => {
      const slot = get().slots[index];
      if (!slot) return;
      const next = get().slots.slice();
      next[index] = setIntent(slot, text);
      set({ slots: next });
    },
    addUsage: (label, usage, counted = true) => set((s) => ({ usageRuns: [...s.usageRuns.slice(-29), { label, usage, counted }] })),
  };
});

export { EMPTY_SCHEDULE };
