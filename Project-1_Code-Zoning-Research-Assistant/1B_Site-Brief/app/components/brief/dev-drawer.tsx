"use client";

import { useState } from "react";
import { Wrench } from "lucide-react";
import { COPY, STEP_IDS, STEP_LABELS } from "@/lib/brief-client/events";
import type { BriefState } from "@/lib/brief-client/use-brief";
import type { NarrativeState } from "@/lib/brief-client/use-narrative";

export function DevDrawer({ state, narrative }: { state: BriefState; narrative?: NarrativeState }) {
  const [open, setOpen] = useState(false);
  const { done, meta } = state;
  const usage = narrative?.usage ?? [];
  const totalCost = usage.reduce((a, u) => a + (u.cost || 0), 0);
  return (
    <div className="fixed bottom-3 left-3 z-40 print:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="dev-drawer"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 items-center gap-1.5 rounded-md border border-rule-strong bg-paper px-2.5 transition-transform duration-100 active:scale-[.98] motion-reduce:active:scale-100 text-[0.8125rem] text-ink-2 hover:text-ink"
      >
        <Wrench className="size-3.5" aria-hidden="true" />Dev panel
      </button>
      {open && (
        <div id="dev-drawer" role="region" aria-label="Developer panel" className="material mt-1 w-72 p-3 text-[0.8125rem] [--material-alpha:92%]">
          <h2 className="text-[0.8125rem] font-medium text-ink-2 mb-1">Step timings</h2>
          <dl className="tabular grid grid-cols-[1fr_auto] gap-x-3 font-mono">
            {STEP_IDS.map((id) => (
              <div key={id} className="contents">
                <dt className="font-sans text-ink-2">{STEP_LABELS[id]}</dt>
                <dd className="text-right">{done?.stepMs[id] !== undefined ? `${done.stepMs[id]} ms` : "—"}</dd>
              </div>
            ))}
            <dt className="font-sans text-ink-2">Server total</dt><dd className="text-right">{done ? `${done.totalMs} ms` : "—"}</dd>
            <dt className="font-sans text-ink-2">Browser total</dt><dd className="text-right">{state.clientMs !== null ? `${state.clientMs} ms` : "—"}</dd>
          </dl>
          <p className="mt-1 text-ink-3">Rules and Calculate run in one pass, so they share one timing.</p>
          <h2 className="text-[0.8125rem] font-medium text-ink-2 mb-1 mt-3">Cache</h2>
          <dl className="tabular grid grid-cols-[1fr_auto] gap-x-3 font-mono">
            <dt className="font-sans text-ink-2">This request</dt><dd className="text-right">{done ? (done.siteCacheHit ? "site cache hit" : "site cache miss") : "—"}</dd>
            <dt className="font-sans text-ink-2">Hits / misses</dt><dd className="text-right">{meta ? `${meta.siteCache.hits} / ${meta.siteCache.misses}` : "—"}</dd>
            <dt className="font-sans text-ink-2">Entries</dt><dd className="text-right">{meta ? meta.siteCache.size : "—"}</dd>
            <dt className="font-sans text-ink-2">Source mode</dt><dd className="text-right">{meta?.sourceMode ?? "—"}</dd>
          </dl>
          <p className="mt-1 text-ink-3">Per-fetch cache detail is not exposed by the data layer.</p>
          <h2 className="text-[0.8125rem] font-medium text-ink-2 mb-1 mt-3">LLM</h2>
          <dl className="tabular grid grid-cols-[1fr_auto] gap-x-3 font-mono">
            <dt className="font-sans text-ink-2">Estimated cost</dt><dd className="text-right">${(totalCost + (done?.llmCostUsd ?? 0)).toFixed(4)}</dd>
            {usage.map((u, i) => (
              <div key={i} className="contents">
                <dt className="font-sans text-ink-3">{u.kind ?? "call"}, {u.model}</dt>
                <dd className="text-right">{u.input_tokens ?? 0} in / {u.output_tokens ?? 0} out, ${u.cost.toFixed(4)}</dd>
              </div>
            ))}
            <dt className="font-sans text-ink-2">API key set</dt><dd className="text-right">{meta ? (meta.llm ? "yes" : "no") : "—"}</dd>
          </dl>
          {meta && !meta.llm && <p className="mt-1 text-ink-3">{COPY.llmUnavailableDev}</p>}
        </div>
      )}
    </div>
  );
}
