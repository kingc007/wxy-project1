import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { POST as generatePost } from "@/app/api/generate/route";
import { POST as iteratePost } from "@/app/api/iterate/route";
import { POST as intentPost } from "@/app/api/intent/route";
import { POST as parsePost } from "@/app/api/parse-brief/route";
import { initGeometry, presetParams } from "@wxy/massing";
import { setClientForTests } from "../client";
import { A, sampleA, scheduleOf } from "./helpers";

beforeAll(async () => {
  await initGeometry();
  delete process.env.ANTHROPIC_API_KEY;
});
afterEach(() => setClientForTests(null));

const post = (fn: (r: Request) => Promise<Response>, body: unknown) => fn(new Request("http://x/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));

describe("routes (offline, no key)", () => {
  it("parse-brief returns a builtin schedule with confirmed=false", async () => {
    const r = await post(parsePost, { brief: "About 120 units, ground-floor retail, a public courtyard." });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.source).toBe("builtin");
    expect(j.schedule.confirmed).toBe(false);
    expect(j.schedule.uses[0].targetUnits).toBe(120);
  });
  it("generate rejects an unconfirmed schedule with 400", async () => {
    const r = await post(generatePost, { envelope: sampleA(), schedule: scheduleOf({ confirmed: false }), assumptions: A });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/Confirm the program schedule/);
  });
  it("generate rejects an invalid envelope with the copy-deck sentence", async () => {
    const r = await post(generatePost, { envelope: { nope: 1 }, schedule: scheduleOf(), assumptions: A });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/^This file isn't a valid zoning envelope/);
  });
  it("generate streams NDJSON: start, 6 builtin slots, done", async () => {
    const r = await post(generatePost, { envelope: sampleA(), schedule: scheduleOf(), assumptions: A, mode: "builtin" });
    expect(r.headers.get("content-type")).toContain("ndjson");
    const lines = (await r.text()).trim().split("\n").map((l) => JSON.parse(l));
    expect(lines[0].type).toBe("start");
    const done = lines.filter((l) => l.type === "slot" && l.status !== "running");
    expect(done).toHaveLength(6);
    expect(done.every((l) => l.option.source === "builtin")).toBe(true);
    expect(lines.at(-1).type).toBe("done");
    expect(lines.at(-1).totals.usd).toBe(0);
  });
  it("generate with mode ai but no key falls back to builtin with the no-key notice", async () => {
    const r = await post(generatePost, { envelope: sampleA(), schedule: scheduleOf(), assumptions: A, mode: "ai", count: 1 });
    const lines = (await r.text()).trim().split("\n").map((l) => JSON.parse(l));
    expect(lines[0].notice).toMatch(/^AI features are off: no Anthropic API key on the server/);
  });
  it("iterate (builtin) returns a diff with from filled and engine previews; nothing else", async () => {
    const r = await post(iteratePost, { envelope: sampleA(), schedule: scheduleOf(), assumptions: A, option: { params: presetParams("podium_tower") }, instruction: "make it shorter" });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.source).toBe("builtin");
    expect(j.diff.changes[0]).toMatchObject({ key: "upperFloors", from: 8, to: 6 });
    expect(j.preview.metricsAfter.gfa).toBeLessThanOrEqual(j.preview.metricsBefore.gfa);
  });
  it("iterate with an unknown instruction -> 422 with the built-in hint", async () => {
    const r = await post(iteratePost, { envelope: sampleA(), schedule: scheduleOf(), assumptions: A, option: { params: presetParams("podium_tower") }, instruction: "make it purple" });
    expect(r.status).toBe(422);
  });
  it("intent (builtin) returns a template line", async () => {
    const r = await post(intentPost, { envelope: sampleA(), schedule: scheduleOf(), assumptions: A, option: { params: presetParams("slab_bar") } });
    const j = await r.json();
    expect(j.source).toBe("builtin");
    expect(j.intent.length).toBeGreaterThan(10);
  });
});
