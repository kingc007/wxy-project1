// Request/response contracts shared by the routes and the UI (types + zod only; safe to import in the browser).
import { z } from "zod";
import { AssumptionsSchema, PartialParamsSchema, ProgramScheduleSchema } from "@wxy/massing";
import type { Metrics, MassingParams, ProgramFitRow, Typology, TypologyLabel } from "@wxy/massing";
import type { TokenUsage, Totals } from "./cost";

export type Source = "ai" | "builtin";
export type SlotUsage = TokenUsage & { usd: number };

export const ModeSchema = z.enum(["ai", "builtin"]);
const EnvelopeSummary = z.union([z.string().max(4000), z.record(z.string(), z.unknown())]).optional();

export const ParseBriefRequest = z.object({ brief: z.string().min(1).max(8000), envelopeSummary: EnvelopeSummary, mode: ModeSchema.optional() });
export const GenerateRequest = z.object({
  envelope: z.unknown(),
  schedule: ProgramScheduleSchema,
  assumptions: AssumptionsSchema,
  count: z.number().int().min(1).max(6).default(6),
  mode: ModeSchema.optional(),
  /** "Think harder": run this slot (0-based) on claude-opus-5-5, effort medium. */
  thinkHarderSlot: z.number().int().min(0).max(5).optional(),
});
const OptionRef = z.object({ params: PartialParamsSchema, typology: z.string().optional() });
export const IterateRequest = z.object({
  envelope: z.unknown(),
  schedule: ProgramScheduleSchema,
  assumptions: AssumptionsSchema,
  option: OptionRef,
  instruction: z.string().min(1).max(500),
  history: z.array(z.object({ instruction: z.string().max(500) })).max(20).optional(),
  mode: ModeSchema.optional(),
});
export const IntentRequest = z.object({
  envelope: z.unknown(),
  schedule: ProgramScheduleSchema,
  assumptions: AssumptionsSchema,
  option: OptionRef,
  mode: ModeSchema.optional(),
});

export interface FailingRule {
  rule: string;
  allowed: string;
  proposed: string;
}

/** One finished option. Metrics, overall status, program fit and failing rules ALWAYS come from generateOption. */
export interface OptionPayload {
  /** Engine label of the final params (classifyTypology), may be "block". */
  typology: TypologyLabel;
  /** The typology this slot was assigned. */
  assignedTypology: Typology;
  name: string;
  intent: string;
  params: MassingParams;
  notes: string[];
  agentLog: string[];
  /** "builtin" is shown as "Built-in (no AI)". */
  source: Source;
  metrics: Metrics;
  overall: { status: "pass" | "fail" | "review"; failCount: number; reviewCount: number; label: string };
  programFit: ProgramFitRow[];
  failingRules: FailingRule[];
  /** Built-in slots only: "typology-not-realisable" when the lot cannot realise this typology (see notes). */
  fit?: "ok" | "typology-not-realisable";
}

export type GenerateEvent =
  | { type: "start"; mode: Source; slots: { slot: number; typology: Typology }[]; notice?: string }
  | { type: "slot"; slot: number; status: "running" }
  | {
      type: "slot";
      slot: number;
      status: "done" | "fallback" | "incomplete";
      option: OptionPayload;
      usage: SlotUsage;
      /** Why a slot fell back or is incomplete (designer-readable). */
      reason?: string;
    }
  | { type: "done"; totals: Totals }
  | { type: "error"; message: string };

export interface ChangePreview {
  key: keyof MassingParams;
  from: number | string | boolean;
  to: number | string | boolean;
  reason: string;
}
export interface IterateResponse {
  source: Source;
  diff: { changes: ChangePreview[] };
  preview: {
    metricsBefore: Metrics;
    metricsAfter: Metrics;
    overallBefore: OptionPayload["overall"];
    overallAfter: OptionPayload["overall"];
  };
  usage: SlotUsage | null;
}
