import { describe, expect, it } from "vitest";
import { evaluateProgramFit, overallStatus } from "../compliance";
import { initGeometry } from "../geom2d";
import { generateOption } from "../generate";
import type { ProgramSchedule } from "../types";
import { lShapedLot, squareLot, squareLotWithSep } from "./fixtures/envelopes";
import { A, P, S, gen, model, row } from "./fixtures/helpers";

await initGeometry();

describe("compliance: clipped to envelope", () => {
  const o = gen(squareLot(), { baseFloors: 9, clipToEnvelope: true });
  it("passes height, setback, yards, coverage; reviews the trim", () => {
    expect(row(o, "height").status).toBe("pass");
    expect(row(o, "height").proposed).toBe("95.0 ft");
    expect(row(o, "setback-sb-front").status).toBe("pass");
    expect(row(o, "yard-rear").status).toBe("pass");
    expect(row(o, "yard-front").status).toBe("pass");
    expect(row(o, "yard-side").status).toBe("pass");
    expect(row(o, "coverage").status).toBe("pass");
    const t = row(o, "trimmed");
    expect(t.status).toBe("review");
    expect(t.rule).toBe("Trimmed to envelope");
    expect(t.detail).toBe("Trimmed 60,000 cf to fit");
  });
  it("FAR over the max fails with the right numbers", () => {
    const far = row(o, "far-residential");
    expect(far.status).toBe("fail");
    expect(far.allowed).toBe("4.00");
    expect(far.proposed).toBe("5.70");
    expect(far.allowedValue).toBe(4);
    expect(far.proposedValue).toBeCloseTo(5.7, 12);
    // The allowed area is a zoning limit: shown exactly, not rounded to 10 sf like proposed areas.
    expect(far.detail).toMatch(/ against 40,000 sf allowed$/);
    expect(row(o, "far-total").status).toBe("fail");
    expect(row(o, "far-residential").citations[0].source).toBe("TEST FIXTURE");
  });
  it("overall counts fails, then review", () => {
    expect(o.overall).toEqual({ status: "fail", failCount: 2, reviewCount: o.compliance.filter((r) => r.status === "review").length, label: "Fails 2 rule(s)" });
  });
  it("unchecked controls become Review rows", () => {
    const u = o.compliance.filter((r) => r.id.startsWith("unchecked-"));
    expect(u.map((r) => r.rule).sort()).toEqual(["Base height (street wall), max", "Base height (street wall), min", "Max stories"]);
    expect(u[0].allowed).toMatch(/^Not checked — /);
    expect(u.every((r) => r.status === "review")).toBe(true);
  });
  it("not_applicable controls give an 'na' row that is excluded from the counts and the overall status", () => {
    const na = o.compliance.filter((r) => r.status === "na");
    expect(na).toHaveLength(1);
    expect(na[0]).toMatchObject({ rule: "Sky exposure plane", allowed: "Not applicable", proposed: "—", detail: "TEST FIXTURE: no sky exposure plane on this lot" });
    const rows = [...o.compliance.filter((r) => r.status !== "na")];
    expect(o.overall.failCount).toBe(rows.filter((r) => r.status === "fail").length);
    expect(o.overall.reviewCount).toBe(rows.filter((r) => r.status === "review").length);
    expect(overallStatus([na[0]])).toEqual({ status: "pass", failCount: 0, reviewCount: 0, label: "Passes all rules" });
    // a stories control that is not_applicable must not make the option "Needs review"
    const j = squareLot() as unknown as { controls: { maxStories: unknown } };
    j.controls.maxStories = { value: null, unit: "stories", status: "not_applicable", confidence: "inferred", note: "no stories limit" };
    const c = gen(j, { baseFloors: 4 });
    expect(row(c, "na-0").detail).toBe("no stories limit");
    expect(c.compliance.some((r) => r.rule === "Max stories" && r.status === "review")).toBe(false);
  });
});

describe("compliance: uses without a FAR, labels", () => {
  const sched: ProgramSchedule = {
    ...S,
    groundFloorUse: "commercial",
    uses: [{ use: "commercial", targetGfa: 7000, targetUnits: null, floors: null, placement: "ground", source: "brief", accepted: true }],
  };
  const o = generateOption(model(squareLot()), sched, A, P({ baseFloors: 4 }));
  it("commercial GFA with no commercial FAR in the envelope is a Review row, not a silent pass", () => {
    const r = row(o, "far-commercial");
    expect(r.status).toBe("review");
    expect(r.allowed).toBe("No commercial FAR in this envelope");
    expect(r.allowedValue).toBeNull();
    expect(r.proposed).toBe("0.70");
    expect(r.proposedValue).toBeCloseTo(0.7, 12);
    expect(r.detail).toBe("This envelope gives no floor area for commercial use; it may not be permitted here. Check use regulations (not modelled).");
    expect(r.shortRule).toBe("FAR · commercial");
    expect(o.overall.status).toBe("review");
    expect(row(o, "far-residential").status).toBe("pass");
  });
  it("the FAR total says which use it did not count", () => {
    expect(row(o, "far-total").detail).toContain("Not counted: commercial (no FAR in this envelope)");
  });
  it("no row for a use with no GFA, and none when the FAR exists", () => {
    const res = gen(squareLot(), { baseFloors: 4 });
    expect(res.compliance.some((r) => r.id === "far-commercial")).toBe(false);
    expect(row(res, "far-total").detail).not.toContain("Not counted");
  });
  it("setback and sky-plane rows use designer labels, never ids", () => {
    const sb = row(gen(squareLot(), { baseFloors: 4 }), "setback-sb-front");
    expect(sb.rule).toBe("Setback above base height — wide street");
    expect(sb.shortRule).toBe("Setback · wide st.");
    const narrow = squareLot() as unknown as { lot: { edges: { street?: unknown }[] } };
    narrow.lot.edges[0].street = { name: null, width: "narrow" };
    expect(row(gen(narrow, { baseFloors: 4 }), "setback-sb-front").rule).toBe("Setback above base height — narrow street");
    const unk = squareLot() as unknown as { lot: { edges: { street?: unknown }[] } };
    unk.lot.edges[0].street = { name: null, width: "unknown" };
    expect(row(gen(unk, { baseFloors: 4 }), "setback-sb-front").rule).toBe("Setback above base height — street frontages");
    const rear = squareLot() as unknown as { controls: { setbacks: { appliesTo: string }[] } };
    rear.controls.setbacks[0].appliesTo = "rear";
    expect(row(gen(rear, { baseFloors: 4 }), "setback-sb-front").rule).toBe("Setback above base height — rear (upper rear yard)");
    const sep = row(gen(squareLotWithSep(), { baseFloors: 4 }), "sep-sep-front");
    expect(sep.rule).toBe("Sky exposure plane — wide street");
    expect(sep.shortRule).toBe("Sky plane · wide st.");
  });
  it("short labels for the other rows", () => {
    const c = gen(squareLot(), { baseFloors: 9 });
    const short = Object.fromEntries(c.compliance.map((r) => [r.id, r.shortRule]));
    expect(short["far-residential"]).toBe("FAR · residential");
    expect(short["far-total"]).toBe("FAR · total");
    expect(short.height).toBe("Height");
    expect(short["yard-rear"]).toBe("Rear yard");
    expect(short.coverage).toBe("Coverage");
    expect(short.trimmed).toBe("Trimmed");
    expect(c.compliance.every((r) => r.shortRule.length > 0 && !/setback-|sep-/.test(r.shortRule))).toBe(true);
    const j = squareLot() as unknown as { controls: { baseHeight: { min: unknown; max: unknown } } };
    const cc = (v: number) => ({ value: v, unit: "ft", status: "cited", confidence: "cited", citations: [{ source: "T", section: "1", quote: "q" }] });
    j.controls.baseHeight = { min: cc(10), max: cc(90) };
    const b = gen(j, { baseFloors: 4 });
    expect(row(b, "base-min").shortRule).toBe("Street wall · min");
    expect(row(b, "base-max").shortRule).toBe("Street wall · max");
  });
});

describe("compliance: not clipped", () => {
  const o = gen(squareLot(), { baseFloors: 10, clipToEnvelope: false });
  it("fails height, setback, rear yard and names the worst floor", () => {
    expect(row(o, "height").status).toBe("fail");
    expect(row(o, "height").detail).toBe("Floor 10 reaches 105.0 ft");
    expect(row(o, "setback-sb-front").status).toBe("fail");
    expect(row(o, "setback-sb-front").detail).toBe("Floor 6 crosses the setback by 1,500 sf");
    expect(row(o, "yard-rear").status).toBe("fail");
    expect(row(o, "yard-rear").detail).toMatch(/^Floor 1 encroaches on the rear yard by 3,000 sf/);
    expect(row(o, "coverage").status).toBe("fail"); // 100 % > 80 %
    expect(row(o, "trimmed").status).toBe("pass");
    expect(o.overall.label).toMatch(/^Fails \d+ rule\(s\)$/);
  });
});

describe("compliance: clean pass and misc rules", () => {
  it("a small block passes every geometric rule; unchecked rows leave 'Needs review'", () => {
    const o = gen(squareLot(), { baseFloors: 4 });
    expect(o.compliance.filter((r) => r.status === "fail")).toEqual([]);
    expect(row(o, "trimmed").status).toBe("pass");
    expect(o.overall.label).toBe("Needs review");
  });
  it("max stories rule when the control is usable", () => {
    const j = squareLot() as unknown as { controls: { maxStories: unknown } };
    j.controls.maxStories = { value: 3, unit: "stories", status: "cited", confidence: "cited", citations: [{ source: "T", section: "1", quote: "q" }] };
    const o = gen(j, { baseFloors: 4 });
    expect(row(o, "stories").status).toBe("fail");
    expect(row(o, "stories").proposed).toBe("4 stories");
  });
  it("base height min/max use the street wall height", () => {
    const j = squareLot() as unknown as { controls: { baseHeight: { min: unknown; max: unknown } } };
    const c = (v: number) => ({ value: v, unit: "ft", status: "cited", confidence: "cited", citations: [{ source: "T", section: "1", quote: "q" }] });
    j.controls.baseHeight = { min: c(50), max: c(40) };
    const o = gen(j, { baseFloors: 4 }); // street wall 45
    expect(row(o, "base-min").status).toBe("fail");
    expect(row(o, "base-max").status).toBe("fail");
    expect(row(o, "base-min").proposed).toBe("45.0 ft");
  });
  it("sky exposure plane: pierced when unclipped, clear when clipped", () => {
    const off = gen(squareLotWithSep(), { baseFloors: 8, clipToEnvelope: false });
    expect(row(off, "sep-sep-front").status).toBe("fail");
    const on = gen(squareLotWithSep(), { baseFloors: 8, clipToEnvelope: true });
    expect(row(on, "sep-sep-front").status).toBe("pass");
    expect(row(on, "trimmed").status).toBe("review");
  });
  it("L-shaped lot: unclipped plates break the rear yard", () => {
    const o = generateOption(model(lShapedLot()), S, A, P({ baseFloors: 2, clipToEnvelope: false }));
    expect(row(o, "yard-rear").status).toBe("fail");
    const c = generateOption(model(lShapedLot()), S, A, P({ baseFloors: 2 }));
    expect(row(c, "yard-rear").status).toBe("pass");
  });
  it("overallStatus labels", () => {
    expect(overallStatus([]).label).toBe("Passes all rules");
  });
});

describe("program fit", () => {
  it("within +/-5 % is met", () => {
    const sched: ProgramSchedule = {
      ...S,
      groundFloorUse: "commercial",
      uses: [
        { use: "residential", targetGfa: 21000, targetUnits: 22, floors: null, placement: "any", source: "brief", accepted: true },
        { use: "commercial", targetGfa: 7000, targetUnits: null, floors: null, placement: "ground", source: "brief", accepted: true },
        { use: "community_facility", targetGfa: 1000, targetUnits: null, floors: null, placement: "ground", source: "brief", accepted: false },
      ],
    };
    const o = generateOption(model(squareLot()), sched, A, P({ baseFloors: 4 }));
    const fit = o.programFit;
    expect(fit.map((f) => f.use)).toEqual(["residential", "commercial", "units"]);
    expect(fit[0]).toMatchObject({ target: 21000, proposed: 21000, deltaPct: 0, met: true });
    expect(fit[1]).toMatchObject({ target: 7000, proposed: 7000, met: true });
    expect(fit[2]).toMatchObject({ target: 22, proposed: 22, met: true });
    const off = generateOption(model(squareLot()), { ...sched, uses: [{ ...sched.uses[1], targetGfa: 5000 }] }, A, P({ baseFloors: 4 }));
    expect(off.programFit[0]).toMatchObject({ use: "commercial", deltaPct: 40, met: false });
    expect(evaluateProgramFit(S, o.metrics)).toEqual([]);
  });
});
