// Pure camera maths. World frame used by the three scene: Y up, north = -Z, east = +X.
// The engine frame (x east, y north, z up) maps to it by the model group's transform:
//   three = (x - cx, z, -(y - cy))    where (cx, cy) is the scene centre in engine feet.
import type { CameraPreset } from "./types";

export interface SceneFrame {
  /** Scene centre in engine x/y (feet). */
  cx: number;
  cy: number;
  /** Half the largest extent of the model in plan (feet), at least a floor so empty scenes still frame. */
  radius: number;
  /** Max z of the content (feet). */
  height: number;
  /** Radius of the sphere bounding the whole box (plan extent plus height), used by "object" fitting. */
  objectRadius: number;
}

/** `margin` (ft) grows the plan bounds on every side. */
export function sceneFrame(
  bounds: { min: [number, number, number]; max: [number, number, number] } | null,
  margin = 0,
): SceneFrame {
  if (!bounds) return { cx: 0, cy: 0, radius: 100, height: 60, objectRadius: 120 };
  const [x0, y0, z0] = bounds.min;
  const [x1, y1, z1] = bounds.max;
  const dx = x1 - x0 + 2 * margin;
  const dy = y1 - y0 + 2 * margin;
  const dz = Math.max(0, z1) - Math.min(0, z0);
  const radius = Math.max(60, Math.hypot(dx, dy) / 2, dz / 2);
  return {
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
    radius,
    height: Math.max(0, z1),
    objectRadius: Math.max(40, Math.hypot(dx / 2, dy / 2, dz / 2)),
  };
}

/** Engine point -> three world point, given the scene frame. */
export function engineToWorld(p: [number, number, number], f: Pick<SceneFrame, "cx" | "cy">): [number, number, number] {
  return [p[0] - f.cx, p[2], -(p[1] - f.cy)];
}

/** Engine direction -> three world direction (no translation). */
export function engineDirToWorld(d: [number, number, number]): [number, number, number] {
  return [d[0], d[2], -d[1]];
}

export interface Pose {
  position: [number, number, number];
  target: [number, number, number];
}

const DEG = Math.PI / 180;

export const DEFAULT_FOV = 28;
/** "context": frame the model plus context out to ~1.5x its plan diagonal (radius is half the diagonal).
 *  "object": frame just the bounding sphere of lot + margin + full height (grid tiles). */
export type FitMode = "context" | "object";
export const CONTEXT_FRAMING = 2.6;

export interface PoseOptions {
  fovDeg?: number;
  fit?: FitMode;
  /** Viewport width / height. Narrow viewports are limited by horizontal fov, so distance grows. */
  aspect?: number;
}

export function fitDistance(radius: number, fovDeg = DEFAULT_FOV, aspect = 1): number {
  const halfV = (fovDeg * DEG) / 2;
  const halfFit = Math.atan(Math.tan(halfV) * Math.min(1, Math.max(0.2, aspect)));
  return radius / Math.sin(halfFit);
}

export function presetPose(preset: CameraPreset, f: SceneFrame, o: PoseOptions = {}): Pose {
  const fov = o.fovDeg ?? DEFAULT_FOV;
  const object = o.fit === "object";
  const d = object
    ? fitDistance(f.objectRadius, fov, o.aspect) * 1.08
    : fitDistance(f.radius * CONTEXT_FRAMING, fov, o.aspect) * 0.85;
  const tY = object ? f.height * 0.5 : Math.min(f.height * 0.4, f.radius * 0.5);
  if (preset === "plan") {
    // Slight z offset keeps the up-vector well defined; north stays up on screen.
    return { position: [0, d * 1.05, d * 0.002], target: [0, 0, 0] };
  }
  if (preset === "street") {
    // Eye level 5.5 ft, looking north from the south side (frontage orientation is not known to the viewer).
    return { position: [0, 5.5, f.radius * 2.4], target: [0, 5.6, 0] };
  }
  const el = 32 * DEG;
  const h = d * Math.cos(el);
  const s = Math.SQRT1_2;
  const y = tY + d * Math.sin(el);
  if (preset === "axon-sw") return { position: [-h * s, y, h * s], target: [0, tY, 0] };
  // axon-ne: camera on the north-east side looking south-west
  return { position: [h * s, y, -h * s], target: [0, tY, 0] };
}

export const KEY_ORBIT_STEP = 15 * DEG;
