import { beforeAll, describe, expect, it } from "vitest";
import { export3dm, getRhino } from "../export3dm";
import { buildFixture } from "./fixtures";

type Fx = Awaited<ReturnType<typeof buildFixture>>;
let fx: Fx;
let bytes: Uint8Array;

beforeAll(async () => {
  fx = await buildFixture(2);
  bytes = await export3dm({ ...fx, meta: { envelopeId: "test-fixture-square", sample: true, generatedBy: "vitest" } });
}, 60_000);

const LABEL = { residential: "Residential", commercial: "Commercial", community_facility: "Community facility" } as const;

describe("export3dm round trip (rhino3dm File3dm.fromByteArray)", () => {
  it("writes a non-empty file with the 3DM header", () => {
    expect(bytes.length).toBeGreaterThan(1000);
    expect(new TextDecoder().decode(bytes.slice(0, 9))).toBe("3D Geomet");
  });

  it("units are feet and layer tree is present", async () => {
    const r = await getRhino();
    const doc = r.File3dm.fromByteArray(bytes);
    expect(doc.settings().modelUnitSystem).toBe(r.UnitSystem.Feet);
    const paths: string[] = [];
    for (let i = 0; i < doc.layers().count; i++) paths.push(doc.layers().get(i).fullPath);
    for (const p of [
      "Envelope",
      "Context",
      "Option_01",
      "Option_01::Residential",
      "Option_01::Commercial",
      "Option_01::Community facility",
      "Option_02::Residential",
    ])
      expect(paths).toContain(p);
    expect(paths).not.toContain("Option_03");
  });

  it("object counts per layer", async () => {
    const r = await getRhino();
    const doc = r.File3dm.fromByteArray(bytes);
    const idxToPath = new Map<number, string>();
    for (let i = 0; i < doc.layers().count; i++) idxToPath.set(i, doc.layers().get(i).fullPath);
    const counts = new Map<string, number>();
    for (let i = 0; i < doc.objects().count; i++) {
      const o = doc.objects().get(i);
      const p = idxToPath.get(o.attributes().layerIndex)!;
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    expect(counts.get("Context")).toBe(2);
    const expectedEnvelope = 1 + fx.envelopeSections.reduce((n, s) => n + s.polygons.reduce((m, p) => m + 1 + p.holes.length, 0), 0);
    expect(counts.get("Envelope")).toBe(expectedEnvelope);
    for (const o of fx.options) {
      for (const prog of ["residential", "commercial", "community_facility"] as const) {
        const n = o.option.prisms.filter((p) => p.program === prog).length;
        expect(counts.get(`Option_0${o.index}::${LABEL[prog]}`) ?? 0).toBe(n);
      }
    }
  });

  it("user strings round-trip on option meshes", async () => {
    const r = await getRhino();
    const doc = r.File3dm.fromByteArray(bytes);
    const first = fx.options[0].option.prisms[0];
    const a = first.floors[0] + 1;
    const b = first.floors[first.floors.length - 1] + 1;
    const wanted = `Option 1 · Fixture 1 · floors ${a}–${b}`;
    let at: ReturnType<ReturnType<typeof doc.objects>["get"]>["attributes"] extends () => infer R ? R : never = undefined as never;
    for (let i = 0; i < doc.objects().count; i++) {
      const o = doc.objects().get(i);
      if (o.attributes().name === wanted && o.attributes().getUserString("wxy.intent")) at = o.attributes();
    }
    expect(at).toBeDefined();
    expect(at.getUserString("wxy.option")).toBe("1");
    expect(at.getUserString("wxy.typology")).toBe(fx.options[0].option.typology);
    expect(at.getUserString("wxy.program")).toBe(first.program);
    expect(at.getUserString("wxy.z0_ft")).toBe(String(first.z0));
    expect(at.getUserString("wxy.z1_ft")).toBe(String(first.z1));
    expect(at.getUserString("wxy.metric.gfa_sf")).toBe(String(fx.options[0].option.metrics.gfa));
    expect(at.getUserString("wxy.param.baseFloors")).toBe("4");
    expect(at.getUserString("wxy.intent")).toBe("Intent text 1");
    expect(at.getUserString("wxy.assumption.efficiency")).toContain("|");
    expect(at.getUserString("wxy.citation./controls/maxBuildingHeight")).toContain("100 ft");
    const ruleId = fx.options[0].option.compliance[0].id;
    expect(at.getUserString(`wxy.rule.${ruleId}`)).toMatch(/^(pass|fail|review|na) \| /);
  });

  it("geometry is in feet: option mesh z-min matches the engine", async () => {
    const r = await getRhino();
    const doc = r.File3dm.fromByteArray(bytes);
    let found = false;
    for (let i = 0; i < doc.objects().count; i++) {
      const o = doc.objects().get(i);
      if (o.attributes().name.startsWith("Option 1 ·")) {
        const bb = o.geometry().getBoundingBox(true) as unknown as { min: number[]; max: number[] };
        expect(bb.min[2]).toBeCloseTo(fx.options[0].option.prisms[0].z0, 6);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it("document strings carry metrics and metadata", async () => {
    const r = await getRhino();
    const doc = r.File3dm.fromByteArray(bytes);
    const s = doc.strings();
    const map = new Map<string, string>();
    for (let i = 0; i < s.count; i++) {
      const entry = s.get(i) as unknown;
      const key = Array.isArray(entry) ? entry[0] : Object.keys(entry as object)[0];
      map.set(String(key), String(Array.isArray(entry) ? entry[1] : (s as unknown as { getvalue(k: string): string }).getvalue(String(key)) /* d.ts says (i:number); runtime takes the key */)); // get(i) -> [key, value]
    }
    expect(map.get("wxy.units")).toBe("feet");
    expect(map.get("wxy.envelopeId")).toBe("test-fixture-square");
    expect(map.get("wxy.sample")).toBe("SAMPLE — not a real parcel");
    expect(map.get("wxy.disclaimer")).toContain("verify with a zoning professional");
    expect(map.get("wxy.option_1.metric.gfa_sf")).toBe(String(fx.options[0].option.metrics.gfa));
    expect(map.get("wxy.option_2.metric.far")).toBe(String(fx.options[1].option.metrics.far));
    expect(map.get("wxy.option_1.intent")).toBe("Intent text 1");
    expect([...map.keys()].some((k) => k.startsWith("wxy.option_1.rule."))).toBe(true);
    expect([...map.keys()].some((k) => k.startsWith("wxy.option_1.param."))).toBe(true);
    expect(map.get("wxy.assumption.efficiency")).toBeDefined();
    // Rhino Section\\Entry mirror
    expect(map.get("wxy\\option_1.metric.gfa_sf")).toBe(String(fx.options[0].option.metrics.gfa));
    expect(s.documentUserTextCount()).toBeGreaterThan(50);
  });
});
