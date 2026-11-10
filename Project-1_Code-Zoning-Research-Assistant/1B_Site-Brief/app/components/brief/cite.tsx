"use client";

import { ProvenanceTag } from "@/components/provenance-tag";
import { RefTag } from "@/components/ref-tag";
import type { Citation, DataProvenance } from "@/lib/types";
import { citationLabel, isoDate } from "@/lib/brief-client/format";
import { useBriefUi } from "./context";

/** Citation as a drawing-reference tag. Click opens the Source pane at the cited span. */
export function CiteTag({ citation }: { citation: Citation }) {
  const { openCitation } = useBriefUi();
  return (
    <RefTag
      label={citationLabel(citation)}
      title={`${citation.section}${citation.title ? ` ${citation.title}` : ""}`}
      quote={citation.quote}
      lastAmended={citation.lastAmended ?? undefined}
      onOpen={() => openCitation(citation)}
    />
  );
}

export function CiteList({ citations }: { citations?: Citation[] }) {
  if (!citations?.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {citations.map((c, i) => <CiteTag key={`${c.section}-${c.paragraph ?? ""}-${i}`} citation={c} />)}
    </span>
  );
}

function raw(v: unknown): string {
  if (v === undefined) return "not returned by the source";
  if (v === null) return "null";
  return typeof v === "string" ? v : JSON.stringify(v);
}

export function Prov({ p }: { p: DataProvenance }) {
  return (
    <ProvenanceTag
      dataset={p.dataset}
      version={p.version ?? "(no version published)"}
      fetched={isoDate(p.fetchedAt)}
      field={p.field ?? "n/a"}
      rawValue={raw(p.rawValue)}
      url={p.url ?? undefined}
    />
  );
}

export function ProvList({ provenance }: { provenance?: DataProvenance[] }) {
  if (!provenance?.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-x-2">
      {provenance.map((p, i) => <Prov key={`${p.dataset}-${p.field}-${i}`} p={p} />)}
    </span>
  );
}
