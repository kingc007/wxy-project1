/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { polygonsIntersect, segmentsIntersect, pointInPolygon, type Pt } from "../../scripts/sample-geom";

const APP = process.cwd();
const VAULT = path.resolve(APP, "../../..");
const note = fs.readFileSync(path.join(VAULT, "_Shared/research/nyc-zoning-sample-envelope-values.md"), "utf8");
const schema = JSON.parse(fs.readFileSync(path.join(VAULT, "_Shared/schemas/zoning-envelope.schema.json"), "utf8"));
const ctx = JSON.parse(fs.readFileSync(path.join(APP, "data/context-fort-greene.json"), "utf8"));

const IDS = [
  ["sample-a-r7a-interior", 10000],
  ["sample-b-r8a-corner", 10000],
  ["sample-c-r10-through-sep", 40000],
] as const;
const load = (f: string) => JSON.parse(fs.readFileSync(path.join(APP, "data/samples", f), "utf8"));

function* walkValues(node: any, p = ""): Generator<[string, any]> {
  if (node && typeof node === "object") {
    if (!Array.isArray(node) && "status" in node && "unit" in node && "confidence" in node) yield [p, node];
    for (const [k, v] of Object.entries(node)) yield* walkValues(v, `${p}/${k}`);
  }
}

describe("sample geometry helpers", () => {
  const sq: Pt[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
  it("detects crossing, containment, touching and disjoint", () => {
    expect(segmentsIntersect([0, 0], [1, 1], [0, 1], [1, 0])).toBe(true);
    expect(pointInPolygon([5, 5], sq)).toBe(true);
    expect(polygonsIntersect(sq, [[5, 5], [15, 5], [15, 15], [5, 15]])).toBe(true);
    expect(polygonsIntersect(sq, [[2, 2], [3, 2], [3, 3], [2, 3]])).toBe(true);
    expect(polygonsIntersect(sq, [[-5, -5], [20, -5], [20, 20], [-5, 20]])).toBe(true);
    expect(polygonsIntersect(sq, [[10, 0], [20, 0], [20, 10], [10, 10]])).toBe(true);
    expect(polygonsIntersect(sq, [[11, 0], [20, 0], [20, 10], [11, 10]])).toBe(false);
  });
});

describe.each(IDS)("%s", (id, expectedArea) => {
  const env = load(`${id}.json`);
  const site = load(`${id}.site.json`);

  it("validates against the canonical schema", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const v = ajv.compile(schema);
    expect(v(env), JSON.stringify(v.errors)).toBe(true);
    expect(env.flags).toMatchObject({ draft: true, sample: true, simplified: true });
  });

  it("lot area matches", () => {
    expect(Math.abs(env.lot.area.value - expectedArea)).toBeLessThan(0.5);
  });

  it("cited values have citations whose quotes are verbatim in the zoning note", () => {
    let checked = 0;
    for (const [p, pv] of walkValues(env.controls, "/controls")) {
      if (pv.status === "needs_input" || pv.status === "manual") expect(pv.value, p).toBeNull();
      if (pv.status === "cited" && pv.value !== null) {
        expect(pv.citations?.length, p).toBeGreaterThanOrEqual(1);
      }
      for (const c of pv.citations ?? []) {
        expect(note.includes(c.quote), `${p}: ${c.quote.slice(0, 40)}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(10);
    for (const a of env.assumptions) for (const c of a.citations ?? []) expect(note.includes(c.quote)).toBe(true);
  });

  it("context (minus removed BINs) has > 150 buildings and none intersects the lot", () => {
    const removed = new Set<number>(site.removedContextBins);
    const kept = ctx.buildings.filter((b: any) => !removed.has(b.bin));
    expect(kept.length).toBeGreaterThan(150);
    for (const b of kept) expect(polygonsIntersect(b.polygon.outer, env.lot.polygonLocal), String(b.bin)).toBe(false);
    for (const b of ctx.buildings.filter((b: any) => removed.has(b.bin))) {
      expect(polygonsIntersect(b.polygon.outer, env.lot.polygonLocal)).toBe(true);
    }
  });
});

describe("context dataset", () => {
  it("has header, SAMPLE flag, CCW outers and positive heights", () => {
    expect(ctx.header.sample).toBe(true);
    expect(ctx.header.attribution).toContain("5zhs-2jue");
    expect(ctx.buildings.length).toBeGreaterThan(150);
    for (const b of ctx.buildings) {
      expect(b.height).toBeGreaterThan(0);
      let a = 0;
      const r: Pt[] = b.polygon.outer;
      for (let i = 0; i < r.length; i++) a += r[i][0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * r[i][1];
      expect(a).toBeGreaterThan(0);
    }
  });
});
