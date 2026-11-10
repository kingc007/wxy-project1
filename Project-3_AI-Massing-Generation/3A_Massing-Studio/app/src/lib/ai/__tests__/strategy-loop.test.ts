import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, TYPOLOGIES, generateOption, presetParams } from "@wxy/massing";
import type { EnvelopeModel, MassingParams, Typology } from "@wxy/massing";
import { setClientForTests } from "../client";
import type { GenerateEvent, OptionPayload } from "../contracts";
import { LOOP_LIMIT_MESSAGE, runGenerate } from "../generate";
import { A, fakeClient, lastToolResults, message, modelA, scheduleOf, text, toolUse } from "./helpers";

let model: EnvelopeModel;
beforeAll(async () => {
  model = await modelA();
});
afterEach(() => setClientForTests(null));

const assignedOf = (req: { messages: { content: unknown }[] }): Typology => {
  const first = req.messages[0].content as string;
  return /Assigned typology: (\w+)/.exec(first)![1] as Typology;
};

async function run(script: Parameters<typeof fakeClient>[0], opts: { costLimitUsd?: number; schedule?: ReturnType<typeof scheduleOf>; count?: number } = {}) {
  const f = fakeClient(script);
  setClientForTests(f.client);
  const events: GenerateEvent[] = [];
  const totals = await runGenerate({ model, schedule: opts.schedule ?? scheduleOf(), assumptions: A, mode: "ai", count: opts.count, costLimitUsd: opts.costLimitUsd }, (e) => events.push(e));
  const slots = events.filter((e): e is Extract<GenerateEvent, { type: "slot"; option: OptionPayload }> => e.type === "slot" && e.status !== "running");
  slots.sort((a, b) => a.slot - b.slot);
  return { ...f, events, totals, slots };
}

/** Parameter spreads that clear the engine's near-duplicate test (the bare presets do not, see report). */
const SPREAD: Record<Typology, Partial<MassingParams>> = {
  podium_tower: { baseDepth: 60, towerU: 0.1, towerV: 0.9 },
  perimeter_courtyard: { ringDepth: 45, baseDepth: 200, baseFloors: 6 },
  stepped_terraces: { stepDepth: 30, stepFrom: "rear", upperFloors: 3, stepEvery: 1 },
  slab_bar: { towerU: 0.9, towerV: 0.1 },
  split_massing: { gapWidth: 60, parts: 3 },
  carved_volume: { baseDepth: 120, carveWidth: 90, carveDepth: 70, carveU: 0.2 },
};

/** Script: turn 0 generateMassing(preset), turn 1 submitOption(grounded text). The draft id is read from the tool result. */
function happy(tweak?: (t: Typology) => Partial<MassingParams>): Parameters<typeof fakeClient>[0] {
  return (req, i) => {
    const t = assignedOf(req);
    const turn = req.messages.filter((m) => m.role === "assistant").length;
    void i;
    if (turn === 0) return message([toolUse("generateMassing", { typology: t, params: tweak?.(t) ?? {} })]);
    const res = JSON.parse(lastToolResults(req)[0].content);
    return message([toolUse("submitOption", { optionDraftId: res.optionDraftId, name: `Scheme ${t}`.slice(0, 40), intent: "Holds the street wall and opens light to the rear.", notes: "" })]);
  };
}

describe("strategy loop (scripted tool_use turns, no key)", () => {
  it("(a) happy path: 6 options, engine metrics, one cached system block, no sampling params", async () => {
    const r = await run(happy((t) => SPREAD[t]));
    expect(r.slots).toHaveLength(6);
    expect(r.slots.map((s) => s.option.assignedTypology)).toEqual([...TYPOLOGIES]);
    for (const s of r.slots) {
      expect([s.option.assignedTypology, s.status, s.reason, s.option.notes]).toEqual([s.option.assignedTypology, "done", undefined, []]);
      expect(s.option.source).toBe("ai");
      const fresh = generateOption(model, scheduleOf(), A, s.option.params);
      expect(s.option.metrics).toEqual(fresh.metrics);
      expect(s.option.overall).toEqual(fresh.overall);
    }
    const first = r.calls[0] as unknown as Record<string, unknown>;
    expect(first.model).toBe("claude-sonnet-5-5");
    expect(first.output_config).toEqual({ effort: "low" });
    for (const banned of ["temperature", "top_p", "top_k", "tool_choice", "thinking"]) expect(first).not.toHaveProperty(banned);
    const sys = first.system as { type: string; text: string; cache_control: { type: string } }[];
    expect(sys).toHaveLength(1);
    expect(sys[0].cache_control).toEqual({ type: "ephemeral" });
    const tools = first.tools as { name: string; strict: boolean; input_schema: { additionalProperties: boolean } }[];
    expect(tools.map((x) => x.name)).toEqual(["listTypologies", "generateMassing", "checkCompliance", "submitOption"]);
    expect(tools.every((x) => x.strict && x.input_schema.additionalProperties === false)).toBe(true);
    expect(r.totals.input).toBe(12 * 1000);
    expect(r.totals.usd).toBeGreaterThan(0);
    expect(r.events.at(-1)?.type).toBe("done");
  });

  it("(b) invented number in the intent -> is_error, corrected submit accepted", async () => {
    let sawError = false;
    const r = await run((req) => {
      const t = assignedOf(req);
      const turn = req.messages.filter((m) => m.role === "assistant").length;
      if (turn === 0) return message([toolUse("generateMassing", { typology: t, params: {} })]);
      const res = lastToolResults(req);
      if (turn === 1) {
        const id = JSON.parse(res[0].content).optionDraftId;
        return message([toolUse("submitOption", { optionDraftId: id, name: "Test", intent: "Delivers 98765 sf of terraces.", notes: "" })]);
      }
      sawError ||= res[0].is_error && res[0].content.includes("98765");
      const id = req.messages.map((m) => JSON.stringify(m.content)).join("").match(/opt-[0-9a-f]{8}/)![0];
      return message([toolUse("submitOption", { optionDraftId: id, name: "Test", intent: "Holds the street wall.", notes: "" })]);
    }, { count: 1 });
    expect(sawError).toBe(true);
    expect(r.slots[0].option.intent).toBe("Holds the street wall.");
    expect(r.slots[0].status).toBe("done");
  });

  it("(b2) two ungrounded submits -> built-in text replaces the AI text", async () => {
    const r = await run((req) => {
      const t = assignedOf(req);
      const turn = req.messages.filter((m) => m.role === "assistant").length;
      if (turn === 0) return message([toolUse("generateMassing", { typology: t, params: {} })]);
      const id = req.messages.map((m) => JSON.stringify(m.content)).join("").match(/opt-[0-9a-f]{8}/)![0];
      return message([toolUse("submitOption", { optionDraftId: id, name: "Test", intent: "Delivers 98765 sf.", notes: "" })]);
    }, { count: 1 });
    expect(r.slots[0].option.intent).not.toMatch(/98765/);
    expect(r.slots[0].option.notes.join(" ")).toMatch(/built-in note/);
  });

  it("(c) out-of-range params -> is_error with the zod message", async () => {
    let msgSeen = "";
    const r = await run((req) => {
      const t = assignedOf(req);
      const turn = req.messages.filter((m) => m.role === "assistant").length;
      if (turn === 0) return message([toolUse("generateMassing", { typology: t, params: { baseFloors: 99, ringDepth: 10 } })]);
      const res = lastToolResults(req)[0];
      if (turn === 1) {
        expect(res.is_error).toBe(true);
        msgSeen = res.content;
        return message([toolUse("generateMassing", { typology: t, params: {} })]);
      }
      const id = JSON.parse(res.content).optionDraftId;
      return message([toolUse("submitOption", { optionDraftId: id, name: "Ok", intent: "Holds the street wall.", notes: "" })]);
    }, { count: 1 });
    expect(msgSeen).toMatch(/params\.baseFloors/);
    expect(msgSeen).toMatch(/ringDepth/);
    expect(r.slots[0].status).toBe("done");
  });

  it("(c2) 4th valid generateMassing returns the loop-limit error; invalid step is an error, not clamped", async () => {
    const seen: string[] = [];
    await run((req) => {
      const t = assignedOf(req);
      const turn = req.messages.filter((m) => m.role === "assistant").length;
      if (turn > 0) {
        const res = lastToolResults(req);
        res.forEach((x) => seen.push(x.content));
      }
      if (turn === 0) return message([toolUse("generateMassing", { typology: t, params: { upperFloors: 1 } }), toolUse("generateMassing", { typology: t, params: { upperFloors: 2 } }), toolUse("generateMassing", { typology: t, params: { upperFloors: 3 } }), toolUse("generateMassing", { typology: t, params: { upperFloors: 4 } }), toolUse("generateMassing", { typology: t, params: { baseDepth: 33 } })]);
      return message([text("done")], "end_turn");
    }, { count: 1 });
    expect(seen.some((s) => s === LOOP_LIMIT_MESSAGE)).toBe(true);
    expect(seen.some((s) => /baseDepth: 33 is not a multiple of 5/.test(s))).toBe(true);
  });

  it("(d) near-identical options -> the later slot is replaced by its built-in preset with a note", async () => {
    // every slot submits the same podium-tower parameters
    const r = await run((req) => {
      const turn = req.messages.filter((m) => m.role === "assistant").length;
      if (turn === 0) return message([toolUse("generateMassing", { typology: "podium_tower", params: {} })]);
      const res = JSON.parse(lastToolResults(req)[0].content);
      return message([toolUse("submitOption", { optionDraftId: res.optionDraftId, name: "Tower", intent: "Holds the street wall.", notes: "" })]);
    }, { count: 2 });
    const sources = r.slots.map((s) => s.option.source).sort();
    expect(sources).toEqual(["ai", "builtin"]);
    const replaced = r.slots.find((s) => s.option.source === "builtin")!;
    expect(replaced.status).toBe("fallback");
    expect(replaced.option.notes.join(" ")).toContain("AI option was a near-duplicate; replaced with the built-in preset");
  });

  it("(e) model never submits -> best draft with the didn't-finish intent", async () => {
    const r = await run((req) => {
      const t = assignedOf(req);
      const turn = req.messages.filter((m) => m.role === "assistant").length;
      if (turn === 0) return message([toolUse("generateMassing", { typology: t, params: {} })]);
      return message([text("I think this is fine.")], "end_turn");
    }, { count: 1 });
    const s = r.slots[0];
    expect(s.status).toBe("incomplete");
    expect(s.option.intent).toBe("No note — the AI didn't finish");
    expect(s.option.source).toBe("ai");
    expect(s.option.metrics.gfa).toBeGreaterThan(0);
  });

  it("(f) cost guard trips -> slot falls back to the preset with the over-budget message", async () => {
    const r = await run(happy(), { costLimitUsd: 0.000001, count: 2 });
    for (const s of r.slots) {
      expect(s.status).toBe("fallback");
      expect(s.option.source).toBe("builtin");
      expect(s.reason).toMatch(/^Stopped at the cost limit \(\$0\.00\)/);
    }
    expect(r.calls).toHaveLength(0);
  });

  it("(f2) cost guard trips mid-slot after real usage", async () => {
    const r = await run(
      (req) => {
        const t = assignedOf(req);
        return message([toolUse("generateMassing", { typology: t, params: {} })], "tool_use", { input_tokens: 400_000, output_tokens: 40_000 });
      },
      { costLimitUsd: 0.6, count: 1 },
    );
    expect(r.calls).toHaveLength(1);
    expect(r.slots[0].status).toBe("fallback");
    expect(r.totals.usd).toBeGreaterThan(0.6);
  });

  it("(g) never forwards model metrics: fake metrics in text and tool input do not reach the response", async () => {
    const r = await run((req) => {
      const t = assignedOf(req);
      const turn = req.messages.filter((m) => m.role === "assistant").length;
      if (turn === 0) return message([text("Metrics: gfa 999999 sf, far 77777"), toolUse("generateMassing", { typology: t, params: {} })]);
      const res = lastToolResults(req);
      if (turn === 1) {
        const id = JSON.parse(res[0].content).optionDraftId;
        return message([toolUse("submitOption", { optionDraftId: id, name: "X", intent: "Holds the street wall.", notes: "", metrics: { gfa: 999999 } })]);
      }
      expect(res[0].is_error).toBe(true); // strict schema: extra key rejected
      const id = req.messages.map((m) => JSON.stringify(m.content)).join("").match(/opt-[0-9a-f]{8}/)![0];
      return message([toolUse("submitOption", { optionDraftId: id, name: "X", intent: "Holds the street wall.", notes: "far 77777" })]);
    }, { count: 1 });
    const o = r.slots[0].option;
    expect(JSON.stringify(o)).not.toContain("999999");
    expect(o.metrics).toEqual(generateOption(model, scheduleOf(), A, o.params).metrics);
    // "99.9" in notes is ungrounded -> first accept is rejected; second text also ungrounded would be replaced
    expect(o.notes.join(" ")).not.toContain("77777");
  });

  it("refusal -> built-in strategy with the refusal message", async () => {
    const r = await run(() => message([text("no")], "refusal"), { count: 1 });
    expect(r.slots[0].status).toBe("fallback");
    expect(r.slots[0].reason).toBe("The AI declined this request; used the built-in strategy.");
    expect(r.slots[0].option.source).toBe("builtin");
  });

  it("typed SDK error -> designer-readable fallback, other slots continue", async () => {
    const r = await run(() => new Anthropic.RateLimitError(429, { type: "error", error: { type: "rate_limit_error", message: "x" } }, "rate", new Headers()), { count: 1 });
    expect(r.slots[0].reason).toBe("The AI couldn't return a valid strategy (rate limit reached; wait a moment). Try again, or edit parameters by hand.");
  });

  it("final params come from the model's draft, merged over the preset (not defaults)", async () => {
    const r = await run(happy(() => ({ upperFloors: 3 })), { count: 1 });
    const expected: MassingParams = { ...presetParams("podium_tower"), upperFloors: 3 };
    expect(r.slots[0].option.params).toEqual(expected);
    expect(r.slots[0].option.params).not.toEqual(DEFAULT_PARAMS);
  });
});
