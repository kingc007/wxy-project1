"use client";

import { useEffect, useReducer, useRef } from "react";
import { readEventsRaw } from "./sse";
import type { BriefRequest } from "./events";
import type { CrosscheckEvent } from "./crosscheck-apply";

export interface NarrCitation { sentenceIndex: number; sectionId: string; anchor: string; cited_text: string; url: string | null }
export interface NarrSentence {
  index: number; text: string; label: "cited" | "inferred" | "unverified" | "plain"; citations: number; unsupportedNumbers: string[];
}
export interface NarrUsage { kind?: string; model: string; input_tokens?: number; output_tokens?: number; cost: number }
export interface NarrativeState {
  status: "idle" | "streaming" | "done" | "error";
  text: string;
  citations: NarrCitation[];
  sentences: NarrSentence[] | null;
  crosscheck: CrosscheckEvent | null;
  usage: NarrUsage[];
  error: string | null;
}
const blank: NarrativeState = { status: "idle", text: "", citations: [], sentences: null, crosscheck: null, usage: [], error: null };

type A = { type: "reset"; s: NarrativeState } | { type: "ev"; event: string; data: Record<string, unknown> };
function reduce(s: NarrativeState, a: A): NarrativeState {
  if (a.type === "reset") return a.s;
  const d = a.data;
  switch (a.event) {
    case "text": return { ...s, text: s.text + String(d.delta ?? "") };
    case "citation": return { ...s, citations: [...s.citations, d as unknown as NarrCitation] };
    case "sentences": return { ...s, sentences: d.sentences as NarrSentence[] };
    case "crosscheck": return { ...s, crosscheck: d as CrosscheckEvent };
    case "usage": return { ...s, usage: [...s.usage, d as unknown as NarrUsage] };
    case "error": return { ...s, error: String(d.message ?? "Narrative failed"), status: "error" };
    case "done": return s.status === "error" ? s : { ...s, status: "done" };
    default: return s;
  }
}

/** Streams POST /api/narrative once per (enabled, key). Aborts the previous stream when the key changes. */
export function useNarrative(enabled: boolean, request: BriefRequest | null, bbl: string | null, key: string) {
  const [state, dispatch] = useReducer(reduce, blank);
  const reqRef = useRef(request);
  reqRef.current = request; // eslint-disable-line react-hooks/refs
  useEffect(() => {
    const req = reqRef.current;
    if (!enabled || !req || !bbl) return;
    const ac = new AbortController();
    dispatch({ type: "reset", s: { ...blank, status: "streaming" } });
    (async () => {
      try {
        const res = await fetch("/api/narrative", {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: ac.signal,
          body: JSON.stringify({ bbl, intendedUse: req.intendedUse, programs: req.programs, overrides: req.overrides, verifiedBy: req.verifiedBy }),
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        for await (const ev of readEventsRaw(res.body)) dispatch({ type: "ev", event: ev.event, data: ev.data as Record<string, unknown> });
        dispatch({ type: "ev", event: "done", data: {} });
      } catch (e) {
        if (!ac.signal.aborted) dispatch({ type: "ev", event: "error", data: { message: e instanceof Error ? e.message : "Narrative failed" } });
      }
    })();
    return () => ac.abort();
  }, [enabled, bbl, key]);
  return state;
}
