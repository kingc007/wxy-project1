// Strategy schemas (spec §9) — everything the LLM may output, as zod 4 schemas, plus diversity maths.
// The LLM returns PARAMETERS only (no coordinates, no metrics); out-of-range values are errors, never clamped.
import { z } from "zod";
import type { Assumptions, MassingParams, ProgramSchedule, Typology, TypologyLabel } from "./types";

// ---------- parameter ranges ----------
// DEDUPE with grammar.PARAM_SPECS (spec §2 table; kept local so this module is independent of grammar.ts).
type NumKey = Exclude<keyof MassingParams, "upperMode" | "stepFrom" | "carveSide" | "clipToEnvelope">;
export const PARAM_RANGES: Record<NumKey, { min: number; max: number; int?: boolean }> = {
  baseFloors: { min: 1, max: 15, int: true },
  baseDepth: { min: 20, max: 400 },
  parts: { min: 1, max: 3, int: true },
  gapWidth: { min: 0, max: 80 },
  ringDepth: { min: 0, max: 70 }, // plus rule: 0 or >= 25 (see ringDepthOk)
  upperFloors: { min: 0, max: 80, int: true },
  towerCoverage: { min: 8, max: 45 },
  towerAspect: { min: 1, max: 5 },
  towerU: { min: 0, max: 1 },
  towerV: { min: 0, max: 1 },
  towerRotation: { min: 0, max: 90 },
  stepEvery: { min: 0, max: 8, int: true },
  stepDepth: { min: 0, max: 40 },
  carveWidth: { min: 0, max: 120 },
  carveDepth: { min: 0, max: 120 },
  carveU: { min: 0, max: 1 },
  carveFromFloor: { min: 0, max: 20, int: true },
  heightBias: { min: -1, max: 1 },
};
export const NUMERIC_PARAM_KEYS = Object.keys(PARAM_RANGES) as NumKey[];
export const RING_DEPTH_MIN_NONZERO = 25;
const ringDepthOk = (v: number) => v === 0 || v >= RING_DEPTH_MIN_NONZERO;

function numField(key: NumKey) {
  const r = PARAM_RANGES[key];
  const base = r.int ? z.number().int() : z.number();
  const bounded = base.min(r.min).max(r.max);
  return key === "ringDepth"
    ? bounded.refine(ringDepthOk, { message: `ringDepth must be 0 (no courtyard) or ${RING_DEPTH_MIN_NONZERO}–${r.max}` })
    : bounded;
}

const paramShape = {
  baseFloors: numField("baseFloors"),
  baseDepth: numField("baseDepth"),
  parts: numField("parts"),
  gapWidth: numField("gapWidth"),
  ringDepth: numField("ringDepth"),
  upperMode: z.enum(["none", "extrude", "tower"]),
  upperFloors: numField("upperFloors"),
  towerCoverage: numField("towerCoverage"),
  towerAspect: numField("towerAspect"),
  towerU: numField("towerU"),
  towerV: numField("towerV"),
  towerRotation: numField("towerRotation"),
  stepEvery: numField("stepEvery"),
  stepDepth: numField("stepDepth"),
  stepFrom: z.enum(["front", "rear", "left", "right"]),
  carveWidth: numField("carveWidth"),
  carveDepth: numField("carveDepth"),
  carveU: numField("carveU"),
  carveFromFloor: numField("carveFromFloor"),
  carveSide: z.enum(["front", "rear"]),
  heightBias: numField("heightBias"),
  clipToEnvelope: z.boolean(),
} satisfies Record<keyof MassingParams, z.ZodType>;

export const PARAM_KEYS = Object.keys(paramShape) as (keyof MassingParams)[];

/** Partial params, every present key range-checked; unknown keys rejected. */
export const PartialParamsSchema = z.object(paramShape).partial().strict();

export const TYPOLOGIES = [
  "podium_tower",
  "perimeter_courtyard",
  "stepped_terraces",
  "slab_bar",
  "split_massing",
  "carved_volume",
] as const satisfies readonly Typology[];
export const TypologySchema = z.enum(TYPOLOGIES);

export const StrategyProposalSchema = z
  .object({
    typology: TypologySchema,
    name: z.string().min(1).max(40),
    intent: z.string().min(1).max(160),
    params: PartialParamsSchema,
    notes: z.string().max(300).optional(),
  })
  .strict();
export type StrategyProposal = z.infer<typeof StrategyProposalSchema>;

export const ParamDiffSchema = z
  .object({
    changes: z
      .array(
        z
          .object({
            key: z.enum(PARAM_KEYS as [keyof MassingParams, ...(keyof MassingParams)[]]),
            to: z.union([z.number(), z.string(), z.boolean()]),
            reason: z.string().min(1).max(120),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict()
  .superRefine((val, ctx) => {
    val.changes.forEach((c, i) => {
      const res = paramShape[c.key].safeParse(c.to);
      if (!res.success) {
        ctx.addIssue({
          code: "custom",
          path: ["changes", i, "to"],
          message: `${c.key}: ${res.error.issues[0]?.message ?? "invalid value"}`,
        });
      }
    });
  });
export type ParamDiff = z.infer<typeof ParamDiffSchema>;

// ---------- brief-parser outputs (mirror types.ts) ----------
const ProgramEnum = z.enum(["residential", "commercial", "community_facility"]);
const ValueSourceEnum = z.enum(["brief", "inferred", "default", "user"]);

export const ProgramUseSchema = z
  .object({
    use: ProgramEnum,
    targetGfa: z.number().min(0).nullable(),
    targetUnits: z.number().int().min(0).nullable(),
    floors: z.number().int().min(1).max(100).nullable(),
    placement: z.enum(["ground", "lower", "upper", "any"]),
    source: ValueSourceEnum,
    accepted: z.boolean(),
  })
  .strict();

export const DesignMoveSchema = z
  .object({
    text: z.string().min(1).max(200),
    kind: z.enum(["step_toward", "courtyard", "tower", "street_wall", "passage", "other"]),
    direction: z.enum(["north", "south", "east", "west", "front", "rear", "left", "right"]).nullable(),
  })
  .strict();

export const ProgramScheduleSchema = z
  .object({
    uses: z.array(ProgramUseSchema).max(3),
    groundFloorUse: ProgramEnum,
    openSpaceTargetPct: z.number().min(0).max(100).nullable(),
    publicCourtyard: z.boolean(),
    moves: z.array(DesignMoveSchema).max(10),
    confirmed: z.boolean(),
  })
  .strict();

const AssumedValueSchema = z
  .object({ value: z.number().positive(), source: ValueSourceEnum, rationale: z.string().max(200) })
  .strict();

export const AssumptionsSchema = z
  .object({
    floorToFloor: z
      .object({ residential: AssumedValueSchema, commercial: AssumedValueSchema, community_facility: AssumedValueSchema })
      .strict(),
    groundFloorHeight: AssumedValueSchema,
    avgUnitNetSf: AssumedValueSchema,
    efficiency: AssumedValueSchema.extend({ value: z.number().positive().max(1) }),
  })
  .strict();

// compile-time: schema output must be assignable to the types.ts contract (and params partial to MassingParams)
type Assert<T extends true> = T;
type Extends<A, B> = [A] extends [B] ? true : false;
export type _ChecksOk = [
  Assert<Extends<z.infer<typeof ProgramScheduleSchema>, ProgramSchedule>>,
  Assert<Extends<ProgramSchedule, z.infer<typeof ProgramScheduleSchema>>>,
  Assert<Extends<z.infer<typeof AssumptionsSchema>, Assumptions>>,
  Assert<Extends<Assumptions, z.infer<typeof AssumptionsSchema>>>,
  Assert<Extends<StrategyProposal["params"], Partial<MassingParams>>>,
];

// ---------- JSON Schema for Claude tool input_schema ----------
type Json = Record<string, unknown>;
function strictify(node: unknown): void {
  if (Array.isArray(node)) return node.forEach(strictify);
  if (!node || typeof node !== "object") return;
  const o = node as Json;
  if (o.type === "object" || o.properties) {
    o.additionalProperties = false;
    if (!Array.isArray(o.required)) o.required = [];
  }
  for (const v of Object.values(o)) strictify(v);
}

/**
 * Strict JSON Schema for a tool `input_schema`: draft 2020-12 from z.toJSONSchema (zod 4, "output" mode), `$schema`
 * dropped, and every object level has `additionalProperties:false` and a `required` array.
 */
export function toToolInputSchema(schema: z.ZodType): Json {
  const js = z.toJSONSchema(schema, { io: "output", unrepresentable: "any" }) as Json;
  delete js.$schema;
  strictify(js);
  return js;
}

/** One-line reason for tool_result / UI ("AI couldn't return a valid strategy ({reason})"). */
export function formatZodError(err: z.ZodError, max = 3): string {
  return err.issues
    .slice(0, max)
    .map((i) => `${i.path.join(".") || "value"}: ${i.message}`)
    .join("; ");
}

// ---------- diversity ----------
export interface TypologicalFeatures {
  typology: TypologyLabel;
  upperMode: MassingParams["upperMode"];
  parts: number;
  courtyard: boolean;
  stepped: boolean;
  carved: boolean;
  baseBucket: "low" | "mid" | "high";
  slab: boolean;
}

export function typologicalFeatures(p: MassingParams, typology: TypologyLabel): TypologicalFeatures {
  return {
    typology,
    upperMode: p.upperMode,
    parts: p.parts,
    courtyard: p.ringDepth > 0,
    stepped: p.stepEvery > 0,
    carved: p.carveWidth > 0 && p.carveDepth > 0,
    baseBucket: p.baseFloors <= 3 ? "low" : p.baseFloors <= 7 ? "mid" : "high",
    slab: p.towerAspect >= 2.5,
  };
}

export function featureDiffCount(a: TypologicalFeatures, b: TypologicalFeatures): number {
  let n = 0;
  for (const k of Object.keys(a) as (keyof TypologicalFeatures)[]) if (a[k] !== b[k]) n++;
  return n;
}

/** Mean of |Δ| / range over the numeric parameter keys (0 = identical, 1 = opposite extremes everywhere). */
/**
 * Numeric keys that shape the geometry for these params (manager decision 2026-10-26): a key that neither option uses
 * (e.g. tower keys on two courtyard schemes) must not dilute the distance.
 */
export function activeNumericKeys(p: MassingParams): Set<NumKey> {
  const keys = new Set<NumKey>(["baseFloors", "baseDepth"]);
  if (p.parts > 1) ["parts", "gapWidth", "heightBias"].forEach((k) => keys.add(k as NumKey));
  if (p.ringDepth > 0) keys.add("ringDepth");
  if (p.upperMode !== "none") keys.add("upperFloors");
  if (p.upperMode === "tower")
    ["towerCoverage", "towerAspect", "towerU", "towerV", "towerRotation"].forEach((k) => keys.add(k as NumKey));
  if (p.upperMode === "extrude" && p.stepEvery > 0) ["stepEvery", "stepDepth"].forEach((k) => keys.add(k as NumKey));
  if (p.carveWidth > 0 && p.carveDepth > 0)
    ["carveWidth", "carveDepth", "carveU", "carveFromFloor"].forEach((k) => keys.add(k as NumKey));
  return keys;
}

/**
 * Mean over the union of both options' active numeric keys: range-normalised |Δ| when the key is active in both;
 * 0.5 when it is active in only one (the move exists in one scheme and not the other).
 */
export const ONE_SIDED_KEY_DISTANCE = 0.5;
export function paramDistance(a: MassingParams, b: MassingParams): number {
  const ka = activeNumericKeys(a);
  const kb = activeNumericKeys(b);
  const keys = new Set<NumKey>([...ka, ...kb].filter((k) => NUMERIC_PARAM_KEYS.includes(k)));
  let sum = 0;
  for (const k of keys) {
    if (ka.has(k) !== kb.has(k)) {
      sum += ONE_SIDED_KEY_DISTANCE;
      continue;
    }
    const r = PARAM_RANGES[k];
    sum += Math.abs(a[k] - b[k]) / (r.max - r.min);
  }
  return keys.size ? sum / keys.size : 0;
}

export const MIN_FEATURE_DIFFS = 2;
export const MIN_PARAM_DISTANCE = 0.1; // manager decision 2026-10-26: mean over the union of ACTIVE keys (see activeNumericKeys)

export interface DiversityItem {
  params: MassingParams;
  typology: TypologyLabel;
}

/** Spec §9: distinct only if ≥ 2 typological features differ AND active-key parameter distance ≥ MIN_PARAM_DISTANCE; otherwise near-duplicate. */
export function isNearDuplicate(a: DiversityItem, b: DiversityItem): boolean {
  const feats = featureDiffCount(typologicalFeatures(a.params, a.typology), typologicalFeatures(b.params, b.typology));
  return feats < MIN_FEATURE_DIFFS || paramDistance(a.params, b.params) < MIN_PARAM_DISTANCE;
}

/** Mean pairwise parameter distance (0 for fewer than two options). */
export function diversityScore(options: DiversityItem[]): number {
  if (options.length < 2) return 0;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      sum += paramDistance(options[i].params, options[j].params);
      n++;
    }
  }
  return sum / n;
}
