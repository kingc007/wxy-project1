import { describe, expect, it } from "vitest";
import { exportGltf, buildGltfScene, toGltfAxes } from "../exportGltf";
import { buildFixture } from "./fixtures";

// GLTFExporter uses FileReader to build the .glb; Node has Blob but no FileReader. Minimal test-only polyfill.
class NodeFileReader {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(b: Blob) {
    void b.arrayBuffer().then((r) => {
      this.result = r;
      this.onloadend?.();
    });
  }
  readAsDataURL(b: Blob) {
    void b.arrayBuffer().then((r) => {
      this.result = `data:${b.type};base64,${Buffer.from(r).toString("base64")}`;
      this.onloadend?.();
    });
  }
}
(globalThis as unknown as { FileReader?: unknown }).FileReader ??= NodeFileReader;

describe("exportGltf", async () => {
  const fx = await buildFixture(2);

  it("axis mapping: up -> +Y, north -> -Z, east -> +X", () => {
    expect(toGltfAxes(0, 0, 1)).toEqual([0, 1, -0]);
    expect(toGltfAxes(0, 1, 0)).toEqual([0, 0, -1]);
    expect(toGltfAxes(1, 0, 0)).toEqual([1, 0, -0]);
  });

  it("scene: one group per option, one named mesh per prism, userData set, y-extent = building height", () => {
    const scene = buildGltfScene(fx.options);
    expect(scene.children).toHaveLength(2);
    const g = scene.children[0];
    expect(g.children).toHaveLength(fx.options[0].option.prisms.length);
    expect(g.children[0].name).toMatch(/^Option 1 · Fixture 1 · floors \d+–\d+$/);
    expect(g.userData.metrics.gfa_sf).toBe(fx.options[0].option.metrics.gfa);
    let maxY = -Infinity;
    for (const m of g.children as import("three").Mesh[]) {
      m.geometry.computeBoundingBox();
      maxY = Math.max(maxY, m.geometry.boundingBox!.max.y);
    }
    expect(maxY).toBeCloseTo(fx.options[0].option.metrics.height, 6);
  });

  it("writes a binary glb whose JSON chunk carries extras", async () => {
    const glb = await exportGltf(fx.options, { envelopeId: "test-fixture-square", sample: true });
    const dv = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
    expect(dv.getUint32(0, true)).toBe(0x46546c67); // "glTF"
    expect(dv.getUint32(4, true)).toBe(2);
    expect(dv.getUint32(8, true)).toBe(glb.byteLength);
    const jsonLen = dv.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(glb.slice(20, 20 + jsonLen)));
    const opt1 = json.nodes.find((n: { name?: string }) => n.name === "Option 1 · Fixture 1");
    expect(opt1.extras.metrics.gfa_sf).toBe(fx.options[0].option.metrics.gfa);
    expect(opt1.extras.params.baseFloors).toBe(4);
    expect(json.meshes.length).toBeGreaterThan(0);
  });
});
