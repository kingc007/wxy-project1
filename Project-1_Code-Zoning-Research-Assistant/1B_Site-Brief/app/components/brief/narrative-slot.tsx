"use client";

import { useEffect, useState } from "react";
import { RefTag } from "@/components/ref-tag";
import { StatusPill } from "@/components/status-pill";
import { COPY } from "@/lib/brief-client/events";
import type { NarrativeState, NarrCitation } from "@/lib/brief-client/use-narrative";
import { useBriefUi } from "./context";

interface SectionInfo { title: string; lastAmended: string | null; url: string | null }

/** Fetches title/last-amended for cited sections from /api/clause (cached per page load). */
function useSectionInfo(ids: string[]): Record<string, SectionInfo> {
  const [info, setInfo] = useState<Record<string, SectionInfo>>({});
  const key = [...new Set(ids)].sort().join(",");
  useEffect(() => {
    let live = true;
    for (const id of key ? key.split(",") : []) {
      fetch(`/api/clause?id=${encodeURIComponent(id)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { section?: { title: string; lastAmended: string | null; url: string } } | null) => {
          if (live && j?.section) setInfo((p) => ({ ...p, [id]: { title: j.section!.title, lastAmended: j.section!.lastAmended, url: j.section!.url } }));
        })
        .catch(() => undefined);
    }
    return () => { live = false; };
  }, [key]);
  return info;
}

function NarrTag({ c, info }: { c: NarrCitation; info?: SectionInfo }) {
  const { openCitation } = useBriefUi();
  return (
    <RefTag
      label={`ZR ${c.sectionId}`}
      title={`${c.sectionId}${info?.title ? ` ${info.title}` : ""}`}
      quote={c.cited_text}
      lastAmended={info?.lastAmended ?? undefined}
      onOpen={() => openCitation({ source: "NYC Zoning Resolution", section: c.sectionId, url: c.url ?? info?.url ?? null, quote: c.cited_text, title: info?.title ?? null, lastAmended: info?.lastAmended ?? null })}
    />
  );
}

/** Cited narrative. `llm` comes from the /api/brief meta event; with no key the copy-deck line is shown. */
export function NarrativeSlot({ llm, narrative }: { llm: boolean | null; narrative?: NarrativeState }) {
  const info = useSectionInfo(narrative?.citations.map((c) => c.sectionId) ?? []);
  if (llm === false) return <p className="text-[0.875rem] text-ink-2">{COPY.llmUnavailable}</p>;
  if (llm === null || !narrative || narrative.status === "idle") return null;
  const { sentences, citations } = narrative;
  return (
    <div data-slot="narrative" aria-label="Narrative summary" role="region">
      {sentences ? (
        <p className="text-base leading-[1.55] text-ink">
          {sentences.map((s) => (
            <span key={s.index} data-label={s.label}>
              {s.text}
              {s.label === "cited" && citations.filter((c) => c.sentenceIndex === s.index).map((c, i) => (
                <span key={i} className="ml-1 mr-1"><NarrTag c={c} info={info[c.sectionId]} /></span>
              ))}
              {(s.label === "unverified" || s.label === "inferred") && (
                <span className="mx-1 inline-block align-baseline"><StatusPill kind={s.label} /></span>
              )}{" "}
            </span>
          ))}
        </p>
      ) : narrative.text ? (
        <p className="text-base leading-[1.55] text-ink-2" aria-busy="true">{narrative.text}</p>
      ) : narrative.status === "streaming" ? (
        <p className="text-[0.875rem] text-ink-2" role="status">Writing the narrative from cited clauses…</p>
      ) : null}
      {narrative.status === "error" && narrative.error && <p className="mt-2 text-[0.8125rem] text-ink-2">Narrative stopped: {narrative.error}</p>}
      {narrative.crosscheck?.error && <p className="mt-2 text-[0.8125rem] text-ink-3">Rule cross-check unavailable: {narrative.crosscheck.error}</p>}
    </div>
  );
}
