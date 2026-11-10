// Wire contract for POST /api/brief (text/event-stream). Types only plus the step list; safe for client and server.
import type { SiteData } from "@/lib/types";
import type { IntendedUse, ZoningBrief } from "@/lib/zoning/model";

export const STEP_IDS = ["locate", "lot", "districts", "rules", "calculate", "review"] as const;
export type BriefStepId = (typeof STEP_IDS)[number];
export const STEP_LABELS: Record<BriefStepId, string> = {
  locate: "Locate",
  lot: "Lot data",
  districts: "Districts",
  rules: "Rules",
  calculate: "Calculate",
  review: "Review",
};

export interface BriefRequest {
  query: string;
  /** BBL of an earlier result; lets overrides reuse the cached SiteData. */
  bbl?: string;
  intendedUse: IntendedUse;
  programs: string[];
  overrides: Record<string, string | boolean>;
  verifiedBy?: string;
}

export type StepEventState = "running" | "done" | "error" | "attention";
export interface StepEvent {
  id: BriefStepId;
  state: StepEventState;
  elapsedMs: number;
  /** true when the step's data came from the in-memory SiteData cache (no network work ran) */
  cached?: boolean;
}
export interface MetaEvent {
  llm: boolean;
  sourceMode: string;
  siteCache: { hit: boolean; hits: number; misses: number; size: number };
}
export interface DoneEvent {
  totalMs: number;
  stepMs: Partial<Record<BriefStepId, number>>;
  siteCacheHit: boolean;
  llmCostUsd: number;
}
export interface ErrorEvent {
  message: string;
}

export type BriefEvent =
  | { event: "meta"; data: MetaEvent }
  | { event: "step"; data: StepEvent }
  | { event: "site"; data: SiteData }
  | { event: "brief"; data: ZoningBrief }
  | { event: "done"; data: DoneEvent }
  | { event: "error"; data: ErrorEvent };

export const COPY = {
  geocode: (q: string) => `No NYC tax lot found for “${q}”. Check the spelling or enter a 10-digit BBL.`,
  down: (source: string) => `Couldn’t reach ${source}. Try again in a minute.`,
  cached: (source: string, date: string) => `Couldn’t reach ${source}. Showing cached data from ${date}.`,
  llmUnavailable: "Written from the zoning text. No AI narrative in this build.",
  /** Plumbing detail for the dev panel only. */
  llmUnavailableDev:
    "Narrative unavailable: no Anthropic API key is set on the server. All values and calculations still come from cited sources.",
  splitLot:
    "This lot lies in more than one district. Each portion is shown separately; a professional must decide how the controls combine.",
  unsupported: (d: string) => `${d} isn’t in this prototype’s rule set yet. Values are left as Needs input.`,
  empty: "Enter an NYC address or BBL to draft a zoning brief.",
  disclaimer: "Draft research for a licensed professional to review. Not a zoning determination.",
  saved: "Override saved. Memo recalculated.",
} as const;
