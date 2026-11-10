import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { AssumptionsSchema, ProgramScheduleSchema, TYPOLOGIES, generateOption, presetParams } from "@wxy/massing";
import type { EnvelopeModel, ProgramSchedule } from "@wxy/massing";
import { parseBriefOffline, postCheckParsed } from "../brief";
import { MODELS, setClientForTests } from "../client";
import { costLimitUsd } from "../client";
import { CostMeter, usdFor } from "../cost";
import { describeError } from "../errors";
import { checkBuiltinText, fitPreset, targetGfaOf } from "../fit";
import { writeIntent, UNGROUNDED_WARNING } from "../intent-ai";
import { buildResponse, checkChanges, iterateOffline } from "../iterate";
import { INTENT_SYSTEM_PROMPT, ITERATE_SYSTEM_PROMPT, PARSE_SYSTEM_PROMPT, STRATEGY_SYSTEM_PROMPT } from "../prompts";
import { compassToSide } from "../site";
import { STRATEGY_TOOLS } from "../tools";
import { A, fakeClient, message, modelA, scheduleOf } from "./helpers";

import { classifyTypology } from "@wxy/massing";
const classifyOk = (p: Parameters<typeof classifyTypology>[0], t: string) => classifyTypology(p) === t;
let model: EnvelopeModel;
beforeAll(async () => {
  model = await modelA();
});
afterEach(() => setClientForTests(null));

const briefs: { id: string; text: string }[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "eval/briefs.json"), "utf8")).briefs;
const brief = (id: string) => briefs.find((b) => b.id === id)!.text;

describe("prompts", () => {
  it("strategy prompt is long enough to cache, date-free and byte-stable across imports", async () => {
    expect(STRATEGY_SYSTEM_PROMPT.length).toBeGreaterThan(512 * 4);
    expect(STRATEGY_SYSTEM_PROMPT).not.toMatch(/\b(19|20)\d{2}\b/);
    expect(STRATEGY_SYSTEM_PROMPT).not.toMatch(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/);
    expect(STRATEGY_SYSTEM_PROMPT).not.toMatch(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d/);
    for (const t of TYPOLOGIES) expect(STRATEGY_SYSTEM_PROMPT).toContain(t);
    for (const k of ["baseFloors", "towerCoverage", "stepFrom", "carveSide"]) expect(STRATEGY_SYSTEM_PROMPT).toContain(k);
    const fresh = await import("../prompts");
    expect(fresh.STRATEGY_SYSTEM_PROMPT).toBe(STRATEGY_SYSTEM_PROMPT);
    expect(JSON.stringify(STRATEGY_TOOLS)).toBe(JSON.stringify(STRATEGY_TOOLS));
  });
  it("other prompts carry no dates either", () => {
    for (const p of [PARSE_SYSTEM_PROMPT, ITERATE_SYSTEM_PROMPT, INTENT_SYSTEM_PROMPT]) expect(p).not.toMatch(/\b(19|20)\d{2}\b/);
  });
  it("tools are strict with additionalProperties:false at every object level", () => {
    const walk = (n: unknown) => {
      if (Array.isArray(n)) return n.forEach(walk);
      if (n && typeof n === "object") {
        const o = n as Record<string, unknown>;
        if (o.type === "object") {
          expect(o.additionalProperties).toBe(false);
          expect(Array.isArray(o.required)).toBe(true);
        }
        Object.values(o).forEach(walk);
      }
    };
    for (const t of STRATEGY_TOOLS) {
      expect(t.strict).toBe(true);
      walk(t.input_schema);
    }
  });
});

describe("offline brief parser on eval/briefs.json", () => {
  it("brief 1: 120 units, ground-floor retail, public courtyard, step toward the park to the north", () => {
    const { schedule } = parseBriefOffline(brief("courtyard-park"));
    expect(ProgramScheduleSchema.safeParse(schedule).success).toBe(true);
    expect(schedule.confirmed).toBe(false);
    expect(schedule.uses.find((u) => u.use === "residential")?.targetUnits).toBe(120);
    expect(schedule.groundFloorUse).toBe("commercial");
    expect(schedule.uses.some((u) => u.use === "commercial")).toBe(true);
    expect(schedule.publicCourtyard).toBe(true);
    expect(schedule.moves.some((m) => m.kind === "courtyard")).toBe(true);
    const step = schedule.moves.find((m) => m.kind === "step_toward");
    expect(step?.direction).toBe("north");
  });
  it("brief 2: 60,000 sf housing, 8,000 sf community facility on the lower two floors, street wall", () => {
    const { schedule } = parseBriefOffline(brief("civic-streetwall"));
    expect(schedule.uses.find((u) => u.use === "residential")?.targetGfa).toBe(60000);
    const c = schedule.uses.find((u) => u.use === "community_facility");
    expect(c?.targetGfa).toBe(8000);
    expect(c?.floors).toBe(2);
    expect(c?.placement).toBe("lower");
    expect(schedule.groundFloorUse).toBe("community_facility");
    expect(schedule.moves.some((m) => m.kind === "street_wall")).toBe(true);
  });
  it("floor-count phrasings: number words, digits, first N floors, ground and second floor", () => {
    const cases: [string, number][] = [
      ["8,000 sf of community facility on the lower two floors", 2],
      ["8,000 sf of community facility on the lower three floors", 3],
      ["8,000 sf of community facility on the lower 4 floors", 4],
      ["8,000 sf of community facility in the first two floors", 2],
      ["8,000 sf of community facility on the ground and second floor", 2],
      ["8,000 sf of community facility on the lower ten floors", 10],
      ["60,000 sf of housing. 8,000 sf of community facility (a library branch) on the lower two floors.", 2],
    ];
    for (const [text, n] of cases) {
      const c = parseBriefOffline(text).schedule.uses.find((u) => u.use === "community_facility");
      expect(c?.floors, text).toBe(n);
      expect(c?.placement, text).toBe("lower");
      expect(c?.targetGfa, text).toBe(8000);
    }
  });
  it("brief 3: 200 units, two-story commercial base, open space 30%", () => {
    const { schedule } = parseBriefOffline(brief("slender-terraces"));
    expect(schedule.uses.find((u) => u.use === "residential")?.targetUnits).toBe(200);
    const c = schedule.uses.find((u) => u.use === "commercial");
    expect(c?.floors).toBe(2);
    expect(schedule.openSpaceTargetPct).toBe(30);
    expect(schedule.groundFloorUse).toBe("commercial");
  });
  it("empty brief falls back to a default residential row; stated assumptions are tagged brief", () => {
    const r = parseBriefOffline("Something nice, 12 ft floor-to-floor, 85% efficiency.");
    expect(r.schedule.uses).toHaveLength(1);
    expect(r.schedule.uses[0].source).toBe("default");
    expect(r.assumptions.efficiency?.value).toBeCloseTo(0.85);
    expect(r.assumptions.floorToFloor?.residential.value).toBe(12);
    expect(r.assumptions.efficiency?.source).toBe("brief");
  });
});

describe("AI brief post-check", () => {
  it("downgrades brief numbers not in the text, forces confirmed/accepted false, drops defaults", () => {
    const schedule: ProgramSchedule = {
      uses: [
        { use: "residential", targetGfa: null, targetUnits: 120, floors: null, placement: "any", source: "brief", accepted: true },
        { use: "commercial", targetGfa: 5000, targetUnits: null, floors: null, placement: "ground", source: "brief", accepted: true },
      ],
      groundFloorUse: "commercial",
      openSpaceTargetPct: null,
      publicCourtyard: false,
      moves: [],
      confirmed: true,
    };
    const assumptions = {
      ...A,
      avgUnitNetSf: { value: 900, source: "brief" as const, rationale: "x" },
      efficiency: { value: 0.8, source: "default" as const, rationale: "x" },
    };
    expect(AssumptionsSchema.safeParse(assumptions).success).toBe(true);
    const r = postCheckParsed({ schedule, assumptions }, "About 120 units with retail below.");
    expect(r.schedule.confirmed).toBe(false);
    expect(r.schedule.uses.every((u) => !u.accepted)).toBe(true);
    expect(r.schedule.uses[0].source).toBe("brief");
    expect(r.schedule.uses[1].source).toBe("inferred"); // 5000 is not in the brief
    expect(r.assumptions.avgUnitNetSf?.source).toBe("inferred"); // 900 is not in the brief
    expect(r.assumptions.efficiency).toBeUndefined(); // default dropped
  });
  it("accepts number words, thousands separators and 'k' as literal", () => {
    const s = scheduleOf({ uses: [{ use: "commercial", targetGfa: 60000, targetUnits: null, floors: 2, placement: "lower", source: "brief", accepted: true }] });
    expect(postCheckParsed({ schedule: s, assumptions: A }, "60k sf of retail on two floors").schedule.uses[0].source).toBe("brief");
    expect(postCheckParsed({ schedule: s, assumptions: A }, "60,000 sf of retail on two floors").schedule.uses[0].source).toBe("brief");
  });
});

describe("fitPreset (offline strategy)", () => {
  it("is deterministic, grounded, and hits a reachable target within 5%", () => {
    const schedule = scheduleOf({ uses: [{ use: "residential", targetGfa: 30000, targetUnits: null, floors: null, placement: "any", source: "brief", accepted: true }] });
    for (const t of TYPOLOGIES) {
      const a = fitPreset(t, model, schedule, A);
      const b = fitPreset(t, model, schedule, A);
      expect(a.params).toEqual(b.params);
      expect(a.intent).toBe(b.intent);
      expect(a.intent.length).toBeLessThanOrEqual(160);
      const base = generateOption(model, schedule, A, presetParams(t));
      const baseFails = new Set(base.compliance.filter((c) => c.status === "fail").map((c) => c.id));
      for (const c of a.option.compliance) if (c.status === "fail") expect(baseFails.has(c.id)).toBe(true); // no new Fails
      expect(Math.abs(a.option.metrics.gfa - 30000)).toBeLessThanOrEqual(Math.abs(base.metrics.gfa - 30000) + 1e-6);
      for (const text of [a.intent, ...a.notes]) {
        const g = checkBuiltinText(text, a.option, model, schedule, A, a.targetGfa);
        expect(g.unmatched, `${t}: ${text}`).toEqual([]);
      }
    }
  });
  it("target from units = units x avg unit / efficiency", () => {
    expect(targetGfaOf(scheduleOf(), A)).toBeCloseTo((120 * 750) / 0.8);
  });
  it("is zero-fail where possible: prefers fewer Fails over a closer GFA", () => {
    const schedule = scheduleOf({ uses: [{ use: "residential", targetGfa: 400000, targetUnits: null, floors: null, placement: "any", source: "brief", accepted: true }] });
    const r = fitPreset("podium_tower", model, schedule, A);
    const base = generateOption(model, schedule, A, presetParams("podium_tower"));
    expect(r.option.overall.failCount).toBeLessThanOrEqual(base.overall.failCount);
    expect(r.notes.join(" ")).toMatch(/^Can't reach 400,000 sf \(residential\) inside this envelope — closest is [\d,]+ sf\./);
  });
  it("per-use fit on sample C: units target reached within 5% and the search stays within 400 runs", async () => {
    const { loadSample } = await import("./helpers");
    const { buildEnvelopeModel } = await import("@wxy/massing");
    const mc = buildEnvelopeModel(loadSample("sample-c-r10-through-sep.json"));
    const sch = scheduleOf({ uses: [{ use: "residential", targetGfa: null, targetUnits: 200, floors: null, placement: "any", source: "brief", accepted: true }] });
    for (const t of TYPOLOGIES) {
      const r = fitPreset(t, mc, sch, A);
      expect(r.evaluated).toBeLessThanOrEqual(400);
      const base = generateOption(mc, sch, A, presetParams(t));
      const worst = (o: typeof base) => Math.max(...o.programFit.map((x) => Math.abs(x.deltaPct)));
      expect(worst(r.option)).toBeLessThanOrEqual(worst(base) + 1e-9);
    }
    expect(Math.abs(fitPreset("podium_tower", mc, sch, A).option.programFit[0].deltaPct)).toBeLessThanOrEqual(5);
  });
  it("explicit floors fix a use: its row is excluded from the objective but reported honestly", () => {
    const sch = scheduleOf({
      uses: [
        { use: "residential", targetGfa: null, targetUnits: 120, floors: null, placement: "any", source: "brief", accepted: true },
        { use: "community_facility", targetGfa: 8000, targetUnits: null, floors: 2, placement: "lower", source: "brief", accepted: true },
      ],
      groundFloorUse: "community_facility",
    });
    const r = fitPreset("podium_tower", model, sch, A);
    expect(r.notes.some((n) => /community facility/.test(n))).toBe(true);
    expect(r.option.programFit.some((x) => x.use === "community_facility")).toBe(true);
  });
  it("every slot keeps its typology and its move on 3 samples x 3 briefs", async () => {
    const { loadSample } = await import("./helpers");
    const { classifyTypology } = await import("@wxy/massing");
    const briefTexts = briefs.map((b) => b.text);
    for (const file of ["sample-a-r7a-interior.json", "sample-b-r8a-corner.json", "sample-c-r10-through-sep.json"]) {
      const m = (await import("@wxy/massing")).buildEnvelopeModel(loadSample(file));
      for (const text of briefTexts) {
        const parsed = parseBriefOffline(text);
        const sch = { ...parsed.schedule, confirmed: true, uses: parsed.schedule.uses.map((u) => ({ ...u, accepted: true })) };
        for (const t of TYPOLOGIES) {
          const r = fitPreset(t, m, sch, A);
          expect(r.evaluated, `${file} ${t}`).toBeLessThanOrEqual(400);
          expect(classifyTypology(r.option.params), `${file} ${t}`).toBe(t);
          expect(r.option.overall.failCount, `${file} ${t} fails`).toBe(0);
          if (t === "podium_tower" || t === "slab_bar") expect(r.params.upperFloors).toBeGreaterThanOrEqual(2);
          if (t === "perimeter_courtyard") expect(r.params.ringDepth).toBeGreaterThan(0);
          if (t === "split_massing") expect(r.params.parts).toBeGreaterThanOrEqual(2);
          if (t === "stepped_terraces") expect(r.params.stepEvery).toBeGreaterThan(0);
        }
      }
    }
  }, 60_000);
  it("B x slender-terraces: stepped_terraces reaches 0 Fails (street-wall minimum met)", async () => {
    const { loadSample } = await import("./helpers");
    const { buildEnvelopeModel } = await import("@wxy/massing");
    const mb = buildEnvelopeModel(loadSample("sample-b-r8a-corner.json"));
    const parsed = parseBriefOffline(brief("slender-terraces"));
    const sch = { ...parsed.schedule, confirmed: true, uses: parsed.schedule.uses.map((u) => ({ ...u, accepted: true })) };
    const r = fitPreset("stepped_terraces", mb, sch, A);
    expect(r.option.overall.failCount).toBe(0);
    expect(r.params.stepEvery).toBeGreaterThan(0);
    expect(r.evaluated).toBeLessThanOrEqual(400);
  });
  it("B x courtyard-park: stepped_terraces reaches 0 Fails by shrinking depth, keeping its steps", async () => {
    const { loadSample } = await import("./helpers");
    const { buildEnvelopeModel } = await import("@wxy/massing");
    const mb = buildEnvelopeModel(loadSample("sample-b-r8a-corner.json"));
    const parsed = parseBriefOffline(brief("courtyard-park"));
    const sch = { ...parsed.schedule, confirmed: true, uses: parsed.schedule.uses.map((u) => ({ ...u, accepted: true })) };
    const r = fitPreset("stepped_terraces", mb, sch, A);
    expect(r.option.overall.failCount).toBe(0);
    expect(r.params.stepEvery).toBeGreaterThan(0);
    expect(r.evaluated).toBeLessThanOrEqual(400);
  });
  it("6 envelopes x 6 typologies: never an empty option; not-realisable cases carry a grounded note and flag", async () => {
    const { loadSample } = await import("./helpers");
    const { buildEnvelopeModel } = await import("@wxy/massing");
    const realDir = path.resolve(process.cwd(), "../../../_Shared/schemas/examples");
    const files: [string, unknown][] = [
      ...["sample-a-r7a-interior.json", "sample-b-r8a-corner.json", "sample-c-r10-through-sep.json"].map((f) => [f, loadSample(f)] as [string, unknown]),
      ...(fs.existsSync(realDir) ? fs.readdirSync(realDir).filter((f) => f.endsWith(".json")).map((f) => [f, JSON.parse(fs.readFileSync(path.join(realDir, f), "utf8"))] as [string, unknown]) : []),
    ];
    if (fs.existsSync(realDir)) expect(files.length).toBe(6);
    const parsed = parseBriefOffline(briefs[0].text);
    const sch = { ...parsed.schedule, confirmed: true, uses: parsed.schedule.uses.map((u) => ({ ...u, accepted: true })) };
    for (const [name, json] of files) {
      const m = buildEnvelopeModel(json);
      for (const t of TYPOLOGIES) {
        const r = fitPreset(t, m, sch, A);
        expect(r.evaluated, `${name} ${t}`).toBeLessThanOrEqual(400);
        if (r.option.metrics.gfa <= 0) {
          // every candidate was empty: the preset is returned with the note
          expect(r.fit, `${name} ${t}`).toBe("typology-not-realisable");
        } else expect(r.option.metrics.gfa, `${name} ${t}`).toBeGreaterThan(0);
        if (r.fit === "typology-not-realisable") {
          expect(r.notes[0], `${name} ${t}`).toMatch(/ doesn't fit this lot| don't fit this lot/);
          const g = checkBuiltinText(r.notes[0], r.option, m, sch, A, r.targetGfa);
          expect(g.unmatched, `${name} ${t}: ${r.notes[0]}`).toEqual([]);
        } else {
          expect(r.option.metrics.gfa).toBeGreaterThan(0);
          expect(classifyOk(r.option.params, t)).toBe(true);
        }
      }
    }
  }, 120_000);
  it("note wording: no duplicated unit word", () => {
    const sch = scheduleOf({ uses: [{ use: "residential", targetGfa: null, targetUnits: 120, floors: null, placement: "any", source: "brief", accepted: true }] });
    const r = fitPreset("podium_tower", model, sch, A);
    expect(r.notes.join(" ")).toMatch(/Can't reach 120 units inside this envelope — closest is \d+ units\./);
    expect(r.notes.join(" ")).not.toMatch(/\(units\)/);
  });
  it("no target: floors fitted to the allowed floor area, FAR passes", () => {
    for (const t of TYPOLOGIES) {
      const r = fitPreset(t, model, scheduleOf({ uses: [] }), A);
      expect(r.targetGfa).toBeNull();
      const farRows = r.option.compliance.filter((row) => row.id.startsWith("far-"));
      expect(farRows.every((row) => row.status !== "fail"), `${t} FAR`).toBe(true);
      if (r.fit === "ok") expect(r.notes[0]).toMatch(/fitted to the allowed floor area/);
    }
  });
});

describe("iterate", () => {
  const params = presetParams("podium_tower");
  it("offline keyword rules: taller, compass tower move, more light", () => {
    const tall = iterateOffline("make it taller", model, params);
    expect(tall).toEqual([expect.objectContaining({ key: "upperFloors", to: params.upperFloors + 2 })]);
    const east = iterateOffline("pull the tower east", model, params) as { key: string; to: number }[];
    expect(["towerU", "towerV"]).toContain(east[0].key);
    const light = iterateOffline("more light", model, presetParams("perimeter_courtyard")) as { key: string; to: number }[];
    expect(light[0]).toMatchObject({ key: "ringDepth", to: 25 });
    expect("error" in (iterateOffline("make it purple", model, params) as object)).toBe(true);
  });
  it("compass maps to a side consistently", () => {
    const sides = (["north", "south", "east", "west"] as const).map((d) => compassToSide(model, d));
    expect(new Set(sides).size).toBe(4);
  });
  it("code validates range and step and drops no-ops", () => {
    expect(checkChanges([{ key: "towerU", to: 1.5, reason: "x" }], params).errors[0]).toMatch(/towerU/);
    expect(checkChanges([{ key: "baseDepth", to: 33, reason: "x" }], params).errors[0]).toMatch(/multiple of 5/);
    expect(checkChanges([{ key: "baseFloors", to: params.baseFloors, reason: "x" }], params).errors[0]).toMatch(/no change/);
    expect(checkChanges([{ key: "baseFloors", to: 6, reason: "x" }], params).errors).toEqual([]);
  });
  it("preview: from filled by code, before/after metrics from the engine, ungrounded reason replaced", () => {
    const res = buildResponse("ai", null, [{ key: "upperFloors", to: 1, reason: "Cuts it to 31337 sf." }], model, scheduleOf(), A, params);
    if ("error" in res) throw new Error(res.error);
    expect(res.diff.changes[0]).toMatchObject({ key: "upperFloors", from: params.upperFloors, to: 1 });
    expect(res.diff.changes[0].reason).toBe("Set Floors above the base to 1.");
    expect(res.preview.metricsBefore).toEqual(generateOption(model, scheduleOf(), A, params).metrics);
    expect(res.preview.metricsAfter).toEqual(generateOption(model, scheduleOf(), A, { ...params, upperFloors: 1 }).metrics);
    expect(res.preview.metricsAfter.gfa).toBeLessThan(res.preview.metricsBefore.gfa);
  });
});

describe("intent (AI text is grounded or rejected)", () => {
  it("rejects an invented number twice -> built-in template + warning", async () => {
    const o = generateOption(model, scheduleOf(), A, presetParams("podium_tower"));
    const f = fakeClient(() => Object.assign(message([], "end_turn"), { parsed_output: { intent: "Delivers 31337 sf of street wall." } }));
    const r = await writeIntent(f.client, model, scheduleOf(), A, o);
    expect(f.calls).toHaveLength(2);
    expect(r.source).toBe("builtin");
    expect(r.warning).toBe(UNGROUNDED_WARNING);
    expect(r.intent).not.toMatch(/31337/);
  });
  it("accepts a grounded line from the model", async () => {
    const o = generateOption(model, scheduleOf(), A, presetParams("podium_tower"));
    const f = fakeClient(() => Object.assign(message([], "end_turn"), { parsed_output: { intent: `A podium holds the street wall; ${o.metrics.floors} floors.` } }));
    const r = await writeIntent(f.client, model, scheduleOf(), A, o);
    expect(r.source).toBe("ai");
    expect(f.calls[0]).not.toHaveProperty("temperature");
    expect((f.calls[0] as unknown as { model: string }).model).toBe(MODELS.intent);
  });
});

describe("errors, cost", () => {
  const h = new Headers();
  const body = { type: "error", error: { type: "x", message: "m" } };
  it("most specific typed error first", () => {
    expect(describeError(new Anthropic.APIConnectionTimeoutError()).kind).toBe("timeout");
    expect(describeError(new Anthropic.APIConnectionError({})).kind).toBe("connection");
    expect(describeError(new Anthropic.AuthenticationError(401, body, "k", h)).kind).toBe("auth");
    expect(describeError(new Anthropic.RateLimitError(429, body, "r", h)).status).toBe(429);
    expect(describeError(new Anthropic.BadRequestError(400, body, "b", h)).kind).toBe("bad_request");
    expect(describeError(new Anthropic.APIError(418, body, "t", h)).kind).toBe("api");
    expect(describeError(new Error("boom")).message).toContain("Try again, or edit parameters by hand.");
  });
  it("price table", () => {
    expect(usdFor("claude-sonnet-5-5", { input: 1_000_000, output: 1_000_000, cacheRead: 1_000_000, cacheWrite: 1_000_000 })).toBeCloseTo(2 + 10 + 0.2 + 2.5);
    const m = new CostMeter(0.5);
    m.add("claude-haiku-5-5", { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 });
    expect(m.usd).toBeCloseTo(0.1);
    expect(m.wouldExceed(0.5)).toBe(true);
  });
  it("cost limit env", () => {
    const prev = process.env.MASSING_COST_LIMIT_USD;
    process.env.MASSING_COST_LIMIT_USD = "1.25";
    expect(costLimitUsd()).toBe(1.25);
    process.env.MASSING_COST_LIMIT_USD = "junk";
    expect(costLimitUsd()).toBe(0.5);
    if (prev === undefined) delete process.env.MASSING_COST_LIMIT_USD;
    else process.env.MASSING_COST_LIMIT_USD = prev;
  });
});
