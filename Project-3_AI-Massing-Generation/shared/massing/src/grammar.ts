// Parametric grammar: parameter specs, defaults, typology presets, validation, snapping, classification (spec §2).
// Preset values are designer-sensible starting moves, NOT zoning facts.
import type { MassingParams, ParamSpec, Typology, TypologyLabel } from "./types";

const spec = (s: ParamSpec): ParamSpec => s;

export const PARAM_SPECS: ParamSpec[] = [
  spec({ key: "baseFloors", label: "Podium height (floors)", unit: "floors", kind: "int", min: 1, max: 15, step: 1, typological: true, help: "Floors in the street wall / podium." }),
  spec({ key: "baseDepth", label: "Base depth from street", unit: "ft", kind: "number", min: 20, max: 400, step: 5, typological: false, help: "How far the base reaches into the lot; clamped to the lot depth." }),
  spec({ key: "parts", label: "Number of volumes", unit: "count", kind: "int", min: 1, max: 3, step: 1, typological: true, help: "Split the base into separate volumes along the street." }),
  spec({ key: "gapWidth", label: "Split gap (ft)", unit: "ft", kind: "number", min: 0, max: 80, step: 5, typological: false, help: "Clear width between volumes." }),
  spec({ key: "ringDepth", label: "Courtyard ring depth (0 = no courtyard)", unit: "ft", kind: "number", min: 0, max: 70, step: 5, typological: true, help: "Depth of the building ring around a courtyard; 0 or 25 to 70 ft." }),
  spec({ key: "upperMode", label: "Above the base", unit: "", kind: "enum", options: ["none", "extrude", "tower"], typological: true, help: "Nothing, extrude the base upward, or a separate tower." }),
  spec({ key: "upperFloors", label: "Floors above the base", unit: "floors", kind: "int", min: 0, max: 80, step: 1, typological: false, help: "Number of floors above the podium." }),
  spec({ key: "towerCoverage", label: "Tower footprint (% of lot)", unit: "% of lot", kind: "number", min: 8, max: 45, step: 1, typological: false, help: "Tower plate area as a share of lot area." }),
  spec({ key: "towerAspect", label: "Tower proportion (long:short)", unit: "ratio", kind: "number", min: 1, max: 5, step: 0.25, typological: true, help: "2.5 or more reads as a slab bar." }),
  spec({ key: "towerU", label: "Tower position along street", unit: "0-1", kind: "number", min: 0, max: 1, step: 0.05, typological: false, help: "0 = left end of the buildable area, 1 = right end." }),
  spec({ key: "towerV", label: "Tower position into the block", unit: "0-1", kind: "number", min: 0, max: 1, step: 0.05, typological: false, help: "0 = street side, 1 = rear." }),
  spec({ key: "towerRotation", label: "Tower orientation (°)", unit: "deg", kind: "number", min: 0, max: 90, step: 15, typological: false, help: "Rotation against the street." }),
  spec({ key: "stepEvery", label: "Terrace step (floors per step)", unit: "floors", kind: "int", min: 0, max: 8, step: 1, typological: true, help: "Step back every N floors above the base; 0 = no steps." }),
  spec({ key: "stepDepth", label: "Terrace depth (ft)", unit: "ft", kind: "number", min: 0, max: 40, step: 5, typological: false, help: "Depth removed at each step." }),
  spec({ key: "stepFrom", label: "Step down toward", unit: "", kind: "enum", options: ["front", "rear", "left", "right"], typological: false, help: "Side that steps down. Left and right are seen from the street." }),
  spec({ key: "carveWidth", label: "Carve width (ft)", unit: "ft", kind: "number", min: 0, max: 120, step: 5, typological: true, help: "Width of the notch cut from the volume." }),
  spec({ key: "carveDepth", label: "Carve depth (ft)", unit: "ft", kind: "number", min: 0, max: 120, step: 5, typological: true, help: "Depth of the notch cut from the volume." }),
  spec({ key: "carveU", label: "Carve position along street", unit: "0-1", kind: "number", min: 0, max: 1, step: 0.05, typological: false, help: "Centre of the carve along the street." }),
  spec({ key: "carveFromFloor", label: "Carve starts at floor", unit: "floor", kind: "int", min: 0, max: 20, step: 1, typological: false, help: "0 = ground floor." }),
  spec({ key: "carveSide", label: "Carve from", unit: "", kind: "enum", options: ["front", "rear"], typological: false, help: "Cut from the street side or the rear." }),
  spec({ key: "heightBias", label: "Height shift between volumes", unit: "-1 to 1", kind: "number", min: -1, max: 1, step: 0.1, typological: false, help: "Positive = right volume taller." }),
  spec({ key: "clipToEnvelope", label: "Trim to zoning envelope", unit: "", kind: "bool", typological: false, help: "Trim floors that stick out of the envelope; off shows what would be violated." }),
];

export const PARAM_SPEC_BY_KEY: Record<keyof MassingParams, ParamSpec> = Object.fromEntries(PARAM_SPECS.map((s) => [s.key, s])) as Record<
  keyof MassingParams,
  ParamSpec
>;

export const RING_DEPTH_MIN_NONZERO = 25;

export const DEFAULT_PARAMS: MassingParams = {
  baseFloors: 4,
  baseDepth: 400,
  parts: 1,
  gapWidth: 0,
  ringDepth: 0,
  upperMode: "none",
  upperFloors: 4,
  towerCoverage: 25,
  towerAspect: 1,
  towerU: 0.5,
  towerV: 0.5,
  towerRotation: 0,
  stepEvery: 0,
  stepDepth: 10,
  stepFrom: "front",
  carveWidth: 0,
  carveDepth: 0,
  carveU: 0.5,
  carveFromFloor: 0,
  carveSide: "front",
  heightBias: 0,
  clipToEnvelope: true,
};

export const TYPOLOGY_PRESETS: Record<Typology, { name: string; intent: string; params: Partial<MassingParams> }> = {
  podium_tower: {
    name: "Podium + tower",
    intent: "A street-wall podium with a slim tower set back from the street.",
    params: { baseFloors: 5, upperMode: "tower", upperFloors: 8, towerCoverage: 22, towerAspect: 1.5 },
  },
  perimeter_courtyard: {
    name: "Perimeter courtyard",
    intent: "A ring of building around a protected courtyard.",
    params: { baseFloors: 4, ringDepth: 30, upperMode: "extrude", upperFloors: 4 },
  },
  stepped_terraces: {
    name: "Stepped terraces",
    intent: "Floors step back as they rise, giving terraces toward the street.",
    params: { baseFloors: 3, upperMode: "extrude", upperFloors: 6, stepEvery: 2, stepDepth: 15 },
  },
  slab_bar: {
    name: "Slab bar",
    intent: "A long bar turned across the lot on a low base.",
    params: { baseFloors: 3, upperMode: "tower", upperFloors: 8, towerCoverage: 25, towerAspect: 3.5, towerRotation: 90 },
  },
  split_massing: {
    name: "Split massing",
    intent: "Two volumes with a gap between them, one taller than the other.",
    params: { baseFloors: 3, parts: 2, gapWidth: 30, heightBias: 0.6, upperMode: "extrude", upperFloors: 6 },
  },
  carved_volume: {
    name: "Carved volume",
    intent: "A solid block with a notch carved out of it.",
    params: { baseFloors: 6, carveWidth: 40, carveDepth: 30, carveFromFloor: 0 },
  },
};

// ---------- validation / snapping ----------
function onGrid(v: number, min: number, step: number): boolean {
  const k = (v - min) / step;
  return Math.abs(k - Math.round(k)) < 1e-6;
}

/** Range / step / enum checks. Never clamps. Unknown keys are errors; absent keys are not checked. */
export function validateParams(p: Partial<MassingParams>): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const rec = p as Record<string, unknown>;
  for (const key of Object.keys(rec)) {
    const s = (PARAM_SPEC_BY_KEY as Record<string, ParamSpec | undefined>)[key];
    if (!s) {
      errors.push(`${key}: unknown parameter`);
      continue;
    }
    const v = rec[key];
    if (s.kind === "bool") {
      if (typeof v !== "boolean") errors.push(`${key}: must be true or false`);
    } else if (s.kind === "enum") {
      if (typeof v !== "string" || !s.options?.includes(v)) errors.push(`${key}: must be one of ${s.options?.join(", ")}`);
    } else {
      if (typeof v !== "number" || !isFinite(v)) {
        errors.push(`${key}: must be a number`);
        continue;
      }
      if (v < (s.min as number) || v > (s.max as number)) errors.push(`${key}: ${v} is outside ${s.min} to ${s.max}`);
      else if (!onGrid(v, s.min as number, s.step as number)) errors.push(`${key}: ${v} is not a multiple of ${s.step}`);
      else if (key === "ringDepth" && v !== 0 && v < RING_DEPTH_MIN_NONZERO) errors.push(`ringDepth: must be 0 or ${RING_DEPTH_MIN_NONZERO} to 70`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Snap a numeric value to the parameter's step and clamp into range (explicit UI helper; validateParams never clamps). */
export function snapParam(key: keyof MassingParams, value: number): number {
  const s = PARAM_SPEC_BY_KEY[key];
  if (!s || (s.kind !== "int" && s.kind !== "number")) throw new Error(`snapParam: ${String(key)} is not numeric`);
  const min = s.min as number;
  const max = s.max as number;
  const step = s.step as number;
  let v = min + Math.round((Math.min(max, Math.max(min, value)) - min) / step) * step;
  v = Math.min(max, Math.max(min, v));
  if (key === "ringDepth" && v > 0 && v < RING_DEPTH_MIN_NONZERO) v = value < RING_DEPTH_MIN_NONZERO / 2 ? 0 : RING_DEPTH_MIN_NONZERO;
  return Number(v.toFixed(6));
}

/** Spec §2 priority: tower&aspect>=2.5 slab; tower; ring; parts>=2; steps; carve; else block. */
export function classifyTypology(p: MassingParams): TypologyLabel {
  if (p.upperMode === "tower" && p.towerAspect >= 2.5) return "slab_bar";
  if (p.upperMode === "tower") return "podium_tower";
  if (p.ringDepth > 0) return "perimeter_courtyard";
  if (p.parts >= 2) return "split_massing";
  if (p.stepEvery > 0) return "stepped_terraces";
  if (p.carveWidth > 0 && p.carveDepth > 0) return "carved_volume";
  return "block";
}

export function presetParams(t: Typology): MassingParams {
  return { ...DEFAULT_PARAMS, ...TYPOLOGY_PRESETS[t].params };
}
