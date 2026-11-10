"use client";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

export interface ProvenanceTagProps {
  /** Dataset name, e.g. as displayed by the source portal. */
  dataset: string;
  /** Dataset release/version label. */
  version: string;
  /** ISO date the value was fetched. */
  fetched: string;
  /** Field the value came from. */
  field: string;
  /** Raw, unprocessed value as returned by the source. */
  rawValue: string;
  url?: string;
  className?: string;
}

export function ProvenanceTag({ dataset, version, fetched, field, rawValue, url, className }: ProvenanceTagProps) {
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn("tabular rounded-[2px] font-mono text-[0.6875rem] leading-5 text-ink-3 hover:text-ink", className)}
        >
          {dataset} {version} · fetched {fetched}
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-80 rounded-[2px] border border-rule-strong bg-paper p-3 shadow-none ring-0">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.8125rem]">
          <dt className="title-block-label">Dataset</dt>
          <dd>{dataset} {version}</dd>
          <dt className="title-block-label">Field</dt>
          <dd className="font-mono">{field}</dd>
          <dt className="title-block-label">Raw value</dt>
          <dd className="tabular break-all font-mono">{rawValue}</dd>
          <dt className="title-block-label">Fetched</dt>
          <dd className="tabular font-mono">{fetched}</dd>
          {url && (
            <>
              <dt className="title-block-label">URL</dt>
              <dd className="break-all font-mono text-[0.75rem] text-signal">{url}</dd>
            </>
          )}
        </dl>
      </HoverCardContent>
    </HoverCard>
  );
}
