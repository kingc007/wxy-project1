import { describe, expect, it } from "vitest";
import { chooseScaleBar, fitAffine, readableAngle } from "./plan";

describe("plan helpers", () => {
  it("fitAffine recovers an affine map from matching rings", () => {
    const src: [number, number][] = [[-73.98, 40.72], [-73.979, 40.72], [-73.979, 40.721], [-73.98, 40.721]];
    const f = (p: [number, number]): [number, number] => [1e6 + 270000 * (p[0] + 73.98) + 5 * (p[1] - 40.72), 2e5 + 364000 * (p[1] - 40.72)];
    const m = fitAffine(src, src.map(f))!;
    const q = m([-73.9795, 40.7205]);
    const e = f([-73.9795, 40.7205]);
    expect(Math.abs(q[0] - e[0])).toBeLessThan(1e-3);
    expect(Math.abs(q[1] - e[1])).toBeLessThan(1e-3);
  });
  it("fitAffine rejects mismatched rings", () => {
    expect(fitAffine([[0, 0], [1, 0], [1, 1]], [[0, 0], [1, 0]])).toBeNull();
  });
  it("chooseScaleBar picks the largest round length that fits", () => {
    expect(chooseScaleBar(4, 180)).toEqual({ ft: 25, px: 100 });
    expect(chooseScaleBar(1, 180)).toEqual({ ft: 100, px: 100 });
    expect(chooseScaleBar(0.001, 180)).toBeNull();
  });
  it("readableAngle keeps text upright", () => {
    expect(readableAngle(180)).toBeCloseTo(0);
    expect(readableAngle(100)).toBeCloseTo(-80);
    expect(readableAngle(-100)).toBeCloseTo(80);
  });
});
