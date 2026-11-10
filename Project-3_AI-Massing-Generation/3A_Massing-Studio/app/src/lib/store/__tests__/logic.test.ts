import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS, EMPTY_SCHEDULE, buildEnvelopeModel, initGeometry, presetParams, type EnvelopeModel, type ProgramSchedule } from "@wxy/massing";
import { SAMPLE_SITES } from "@/lib/studio/samples";
import { builtinProposals } from "@/lib/studio/builtin";
import {
  acceptUse,
  applyDiff,
  canConfirmSchedule,
  confirmSchedule,
  editUse,
  makeSlot,
  regenerateSlots,
  setAssumption,
  setParam,
  undoSlot,
  type GenCtx,
  type OptionSlot,
} from "../logic";

let model: EnvelopeModel;
let ctx: GenCtx;
const meta = (n: number) => ({ entryId: `h${n}`, at: "10:00", label: "Podium height (floors)" });

function slot(): OptionSlot {
  const p = builtinProposals()[0];
  const r = makeSlot(0, ctx, p, "builtin");
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

beforeAll(async () => {
  await initGeometry();
  model = buildEnvelopeModel(SAMPLE_SITES[0].envelope);
  ctx = { model, schedule: { ...EMPTY_SCHEDULE, confirmed: true }, assumptions: DEFAULT_ASSUMPTIONS };
});

describe("slot params", () => {
  it("setParam regenerates from the engine and records history", () => {
    const s = slot();
    const r = setParam(s, ctx, "upperFloors", s.option.params.upperFloors + 2, meta(1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.option.metrics.floors).toBeGreaterThan(s.option.metrics.floors - 1);
    expect(r.value.option.params.upperFloors).toBe(s.option.params.upperFloors + 2);
    expect(r.value.history).toHaveLength(1);
  });

  it("rejects out-of-range values without changing the slot", () => {
    const s = slot();
    const r = setParam(s, ctx, "baseFloors", 99, meta(1));
    expect(r.ok).toBe(false);
  });

  it("coalesces consecutive edits of one slider into one undo step", () => {
    let s = slot();
    const start = s.option.params.upperFloors;
    for (let i = 1; i <= 3; i++) {
      const r = setParam(s, ctx, "upperFloors", start + i, meta(i));
      if (!r.ok) throw new Error(r.error);
      s = r.value;
    }
    expect(s.history).toHaveLength(1);
    const u = undoSlot(s, ctx);
    expect(u.ok && u.value.option.params.upperFloors).toBe(start);
  });

  it("undo pops the newest entry and restores parameters and metrics", () => {
    const s0 = slot();
    const a = setParam(s0, ctx, "baseFloors", 6, meta(1));
    if (!a.ok) throw new Error(a.error);
    const b = setParam(a.value, ctx, "upperFloors", 3, meta(2));
    if (!b.ok) throw new Error(b.error);
    expect(b.value.history).toHaveLength(2);
    const u = undoSlot(b.value, ctx);
    if (!u.ok) throw new Error(u.error);
    expect(u.value.history).toHaveLength(1);
    expect(u.value.option.params).toEqual(a.value.option.params);
    expect(u.value.option.metrics.gfa).toBe(a.value.option.metrics.gfa);
    expect(undoSlot(s0, ctx).ok).toBe(false);
  });
});

describe("applyDiff", () => {
  it("applies a change list as one history entry and is undoable", () => {
    const s = slot();
    const changes = [
      { key: "baseFloors" as const, to: 6 },
      { key: "upperFloors" as const, to: 5 },
    ];
    const r = applyDiff(s, ctx, changes, { entryId: "d1", at: "10:05", instruction: "taller podium" });
    if (!r.ok) throw new Error(r.error);
    expect(r.value.option.params.baseFloors).toBe(6);
    expect(r.value.option.params.upperFloors).toBe(5);
    expect(r.value.history).toHaveLength(1);
    expect(r.value.history[0].instruction).toBe("taller podium");
    const u = undoSlot(r.value, ctx);
    expect(u.ok && u.value.option.params).toEqual(s.option.params);
  });

  it("rejects an invalid diff atomically", () => {
    const s = slot();
    const r = applyDiff(s, ctx, [{ key: "baseFloors", to: 6 }, { key: "ringDepth", to: 10 }], { entryId: "d2", at: "10:06", instruction: "x" });
    expect(r.ok).toBe(false);
  });
});

describe("assumptions and schedule regenerate all slots", () => {
  it("raising residential floor-to-floor changes height", () => {
    const slots = builtinProposals().map((p, i) => {
      const r = makeSlot(i, ctx, p, "builtin");
      if (!r.ok) throw new Error(r.error);
      return r.value;
    });
    const a2 = setAssumption(DEFAULT_ASSUMPTIONS, "floorToFloor.residential", 12);
    expect(a2.floorToFloor.residential.source).toBe("user");
    const { slots: next, errors } = regenerateSlots(slots, { ...ctx, assumptions: a2 });
    expect(errors).toEqual([]);
    const taller = next.filter((s, i) => s && s.option.metrics.height > slots[i].option.metrics.height);
    expect(taller.length).toBeGreaterThan(0);
    next.forEach((s, i) => expect(s?.option.params).toEqual(slots[i].option.params));
  });

  it("efficiency edit changes the unit estimate", () => {
    const s = slot();
    const a2 = setAssumption(DEFAULT_ASSUMPTIONS, "efficiency", 0.7);
    const { slots } = regenerateSlots([s], { ...ctx, assumptions: a2 });
    expect(slots[0]!.option.metrics.unitsEst).toBeLessThan(s.option.metrics.unitsEst);
  });
});

describe("schedule confirmation", () => {
  const sched: ProgramSchedule = {
    ...EMPTY_SCHEDULE,
    confirmed: false,
    uses: [
      { use: "residential", targetGfa: null, targetUnits: 120, floors: null, placement: "any", source: "brief", accepted: false },
      { use: "commercial", targetGfa: 5000, targetUnits: null, floors: null, placement: "ground", source: "inferred", accepted: false },
    ],
  };
  it("needs every row accepted or edited", () => {
    expect(canConfirmSchedule(sched)).toBe(false);
    expect(confirmSchedule(sched).confirmed).toBe(false);
    const a = acceptUse(sched, "residential");
    expect(canConfirmSchedule(a)).toBe(false);
    const e = editUse(a, "commercial", { targetGfa: 6000 });
    expect(e.uses[1]).toMatchObject({ targetGfa: 6000, source: "user", accepted: true });
    expect(canConfirmSchedule(e)).toBe(true);
    expect(confirmSchedule(e).confirmed).toBe(true);
  });
  it("editing after confirmation un-confirms", () => {
    const done = confirmSchedule(editUse(acceptUse(sched, "residential"), "commercial", { targetGfa: 6000 }));
    expect(editUse(done, "commercial", { targetGfa: 7000 }).confirmed).toBe(false);
  });
  it("an empty schedule can be confirmed", () => {
    expect(canConfirmSchedule({ ...EMPTY_SCHEDULE, confirmed: false })).toBe(true);
  });
});

describe("presets stay valid on all samples", () => {
  it("six built-in options generate on every sample", () => {
    for (const s of SAMPLE_SITES) {
      const m = buildEnvelopeModel(s.envelope);
      builtinProposals().forEach((p, i) => {
        const r = makeSlot(i, { ...ctx, model: m }, p, "builtin");
        expect(r.ok).toBe(true);
      });
    }
    expect(presetParams("podium_tower").parts).toBe(1);
  });
});
