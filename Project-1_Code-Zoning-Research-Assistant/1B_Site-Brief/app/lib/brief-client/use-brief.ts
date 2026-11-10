"use client";

import { useCallback, useReducer, useRef } from "react";
import type { Assumption, SiteData } from "@/lib/types";
import type { ZoningBrief } from "@/lib/zoning/model";
import {
  COPY, STEP_IDS, type BriefRequest, type BriefStepId, type DoneEvent, type MetaEvent, type StepEvent,
} from "./events";
import { readEvents } from "./sse";

export type RailState = "pending" | "running" | "done" | "attention";
export interface StepView { state: RailState; elapsedMs?: number; cached?: boolean }

export interface BriefState {
  status: "idle" | "running" | "done" | "error";
  /** true while an override recompute is in flight (the previous memo stays on screen) */
  recomputing: boolean;
  steps: Record<BriefStepId, StepView>;
  site: SiteData | null;
  brief: ZoningBrief | null;
  meta: MetaEvent | null;
  done: DoneEvent | null;
  error: string | null;
  request: BriefRequest | null;
  /** assumption id -> value before any override (for the "Source value" tooltip) */
  originals: Record<string, string | boolean>;
  /** wall-clock ms for the latest request as seen by the browser */
  clientMs: number | null;
  runs: number;
}

const blankSteps = (): Record<BriefStepId, StepView> =>
  Object.fromEntries(STEP_IDS.map((id) => [id, { state: "pending" as RailState }])) as Record<BriefStepId, StepView>;

const initial: BriefState = {
  status: "idle", recomputing: false, steps: blankSteps(), site: null, brief: null, meta: null, done: null,
  error: null, request: null, originals: {}, clientMs: null, runs: 0,
};

type Action =
  | { type: "start"; request: BriefRequest; fresh: boolean }
  | { type: "step"; step: StepEvent }
  | { type: "meta"; meta: MetaEvent }
  | { type: "site"; site: SiteData }
  | { type: "brief"; brief: ZoningBrief }
  | { type: "done"; done: DoneEvent; clientMs: number }
  | { type: "error"; message: string };

function reduce(s: BriefState, a: Action): BriefState {
  switch (a.type) {
    case "start":
      return a.fresh
        ? { ...initial, status: "running", request: a.request, runs: s.runs + 1 }
        : { ...s, status: "running", recomputing: true, steps: blankSteps(), error: null, request: a.request, runs: s.runs + 1 };
    case "step": {
      const st = a.step.state === "error" || a.step.state === "attention" ? "attention" : a.step.state;
      return {
        ...s,
        steps: {
          ...s.steps,
          [a.step.id]: { state: st, elapsedMs: a.step.state === "running" ? undefined : a.step.elapsedMs, cached: a.step.cached },
        },
      };
    }
    case "meta":
      return { ...s, meta: a.meta };
    case "site":
      return { ...s, site: a.site };
    case "brief": {
      const originals = { ...s.originals };
      for (const x of a.brief.assumptions) if (x.state !== "overridden" && !(x.id in originals)) originals[x.id] = x.value;
      return { ...s, brief: a.brief, originals };
    }
    case "done":
      return { ...s, status: "done", recomputing: false, done: a.done, clientMs: a.clientMs };
    case "error":
      return { ...s, status: "error", recomputing: false, error: a.message };
  }
}

export function useBrief() {
  const [state, dispatch] = useReducer(reduce, initial);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (request: BriefRequest, opts: { fresh: boolean }) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    dispatch({ type: "start", request, fresh: opts.fresh });
    const t0 = performance.now();
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      let finished = false;
      for await (const ev of readEvents(res.body)) {
        switch (ev.event) {
          case "meta": dispatch({ type: "meta", meta: ev.data }); break;
          case "step": dispatch({ type: "step", step: ev.data }); break;
          case "site": dispatch({ type: "site", site: ev.data }); break;
          case "brief": dispatch({ type: "brief", brief: ev.data }); break;
          case "done": finished = true; dispatch({ type: "done", done: ev.data, clientMs: Math.round(performance.now() - t0) }); break;
          case "error": finished = true; dispatch({ type: "error", message: ev.data.message }); break;
        }
      }
      if (!finished) dispatch({ type: "error", message: COPY.down("the server") });
    } catch (e) {
      if (ac.signal.aborted) return;
      dispatch({ type: "error", message: COPY.down(e instanceof Error ? e.message : "the server") });
    }
  }, []);

  const start = useCallback((request: BriefRequest) => run(request, { fresh: true }), [run]);
  const recompute = useCallback((request: BriefRequest) => run(request, { fresh: false }), [run]);
  return { state, start, recompute };
}

export type { Assumption };
