import { describe, expect, it } from "vitest";
import { engineDirToWorld, engineToWorld, presetPose, sceneFrame } from "../camera";
import { Spherical, Vector3 } from "three";
import { createSharedCamera, type SyncableControls } from "../shared-camera";

describe("camera", () => {
  const f = sceneFrame({ min: [0, 0, 0], max: [100, 200, 90] });
  it("frames centre and radius", () => {
    expect(f.cx).toBe(50);
    expect(f.cy).toBe(100);
    expect(f.radius).toBeCloseTo(Math.hypot(100, 200) / 2, 6);
    expect(sceneFrame(null).radius).toBeGreaterThan(0);
  });
  it("maps engine frame to y-up, north = -z", () => {
    expect(engineToWorld([50, 100, 0], f)).toEqual([0, 0, -0]);
    expect(engineToWorld([60, 120, 30], f)).toEqual([10, 30, -20]);
    expect(engineDirToWorld([1, 2, 3])).toEqual([1, 3, -2]);
  });
  it("presets", () => {
    const ne = presetPose("axon-ne", f);
    expect(ne.position[0]).toBeGreaterThan(0); // east
    expect(ne.position[2]).toBeLessThan(0); // north
    expect(ne.position[1]).toBeGreaterThan(ne.target[1]);
    const sw = presetPose("axon-sw", f);
    expect(sw.position[0]).toBeLessThan(0);
    expect(sw.position[2]).toBeGreaterThan(0);
    const plan = presetPose("plan", f);
    expect(plan.position[0]).toBe(0);
    expect(plan.position[1]).toBeGreaterThan(plan.position[2] * 100);
    expect(presetPose("street", f).position[1]).toBe(5.5);
  });
});

describe("shared camera", () => {
  it("copies end values from the source to every other member", () => {
    const calls: string[] = [];
    const fake = (id: string, theta = 0): SyncableControls => ({
      getSpherical: (out) => out.set(50, 1.1, theta),
      getTarget: (out) => out.set(1, 2, 3),
      rotateTo: async (a, p) => void calls.push(`${id}:rot:${a}:${p}`),
      dollyTo: async (d) => void calls.push(`${id}:dolly:${d}`),
      moveTo: async (x, y, z) => void calls.push(`${id}:move:${x},${y},${z}`),
    });
    const s = createSharedCamera(() => new Spherical(), () => new Vector3());
    s.register("a", fake("a", 0.5));
    const off = s.register("b", fake("b"));
    s.register("c", fake("c"));
    s.sync("a");
    expect(calls).toEqual([
      "b:rot:0.5:1.1", "b:dolly:50", "b:move:1,2,3",
      "c:rot:0.5:1.1", "c:dolly:50", "c:move:1,2,3",
    ]);
    off();
    calls.length = 0;
    s.sync("a");
    expect(calls.every((c) => c.startsWith("c:"))).toBe(true);
    expect(s.isSyncing()).toBe(false);
  });
});

import { tileScissor, type RectLike } from "../viewport";
const R = (left: number, top: number, w: number, h: number): RectLike => ({
  left, top, width: w, height: h, right: left + w, bottom: top + h,
});

describe("tileScissor", () => {
  it("regression: third column is visible when the canvas is offset 320px and 740px wide", () => {
    const canvas = R(320, 60, 740, 700);
    const tile3 = R(320 + 2 * 247, 60, 246, 350); // viewport left = 814 > canvas width 740
    const s = tileScissor(tile3, canvas);
    expect(s.offscreen).toBe(false);
    expect(s.left).toBe(494);
    expect(s.bottom).toBe(350);
    expect(s.width).toBe(246);
  });
  it("culls tiles truly outside the canvas", () => {
    const canvas = R(320, 60, 740, 700);
    expect(tileScissor(R(1100, 60, 100, 100), canvas).offscreen).toBe(true);
    expect(tileScissor(R(320, 800, 100, 100), canvas).offscreen).toBe(true);
    expect(tileScissor(R(320, -200, 100, 100), canvas).offscreen).toBe(true);
    expect(tileScissor(R(320, 60, 0, 100), canvas).offscreen).toBe(true);
  });
});
