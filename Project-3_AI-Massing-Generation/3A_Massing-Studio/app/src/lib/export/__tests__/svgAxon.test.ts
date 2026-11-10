import { describe, expect, it } from "vitest";
import { axonSvg } from "../svgAxon";
import type { Prism } from "@wxy/massing";
import { buildFixture } from "./fixtures";
import { assertWellFormedXml } from "./xml";

const box = (id: string, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number): Prism => ({
  id,
  polygon: { outer: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], holes: [] },
  z0,
  z1,
  program: "residential",
  floors: [0],
});

describe("axonSvg", async () => {
  const fx = await buildFixture(1);
  const prisms = fx.options[0].option.prisms;
  const base = { size: [800, 500] as [number, number], style: "model" as const, theme: "light" as const };

  it("is well-formed XML and deterministic", () => {
    const a = axonSvg(prisms, { ...base, lot: fx.envelope.lot, context: fx.context });
    const b = axonSvg(prisms, { ...base, lot: fx.envelope.lot, context: fx.context });
    expect(a).toBe(b);
    assertWellFormedXml(a);
    expect(a.startsWith("<svg ")).toBe(true);
    expect(a).toContain("#22252A");
  });

  it("single box from the SW: 1 top + 2 visible walls = 3 face paths (+1 lot outline)", () => {
    const svg = axonSvg([box("b", 0, 0, 100, 50, 0, 40)], { ...base, lot: { outer: [[0, 0], [100, 0], [100, 50], [0, 50]], holes: [] } });
    const faces = (svg.match(/<path /g) ?? []).length;
    expect(faces).toBe(4);
    expect(svg).toContain("stroke-dasharray");
  });

  it("path count is bounded by 1 top + walls per prism", () => {
    const svg = axonSvg(prisms, base);
    let bound = 0;
    for (const p of prisms) bound += 1 + p.polygon.outer.length + p.polygon.holes.reduce((n, h) => n + h.length, 0);
    expect((svg.match(/<path /g) ?? []).length).toBeLessThanOrEqual(bound);
    expect((svg.match(/<path /g) ?? []).length).toBeGreaterThanOrEqual(prisms.length * 2);
  });

  it("painter order: far box is drawn before the near box", () => {
    const far = box("far", 0, 100, 20, 120, 0, 10); // north-east side, far from the SW camera
    const near = box("near", 0, 0, 20, 20, 0, 10);
    const svg = axonSvg([near, far], base);
    expect(svg.indexOf("<path")).toBeGreaterThan(-1);
    const paths = svg.match(/<path [^>]*>/g)!;
    // far top (index 0 after sort) must precede the near box paths: compare y of first move command
    const firstY = (p: string) => Number(/M[\d.-]+ ([\d.-]+)/.exec(p)![1]);
    expect(firstY(paths[0])).toBeLessThan(firstY(paths[paths.length - 1]));
  });

  it("diagram style adds hatch patterns and program labels; dark theme changes colours", () => {
    const mixed: Prism[] = [box("a", 0, 0, 50, 50, 0, 20), { ...box("b", 60, 0, 110, 50, 0, 20), program: "commercial" }, { ...box("c", 0, 60, 50, 110, 0, 20), program: "community_facility" }];
    const svg = axonSvg(mixed, { ...base, style: "diagram", idPrefix: "t1" });
    assertWellFormedXml(svg);
    for (const t of [">RES<", ">COM<", ">CF<", "t1-hatch45", "t1-hatch135"]) expect(svg).toContain(t);
    const dark = axonSvg(mixed, { ...base, style: "diagram", theme: "dark" });
    expect(dark).toContain("#16181B");
    expect(dark).not.toBe(svg);
  });
});
