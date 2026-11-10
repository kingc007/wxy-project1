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

/** "MapPLUTO (DCP ArcGIS)" -> "MapPLUTO": the chip names the dataset; the full name is in the hover card. */
export function shortDataset(dataset: string): string {
  return dataset.replace(/\s*\(.*?\)\s*/g, " ").trim() || dataset;
}

/** A data source as a readable chip: dataset name plus its release. The fetch date and raw value are in the hover card. */
export function ProvenanceTag({ dataset, version, fetched, field, rawValue, url, className }: ProvenanceTagProps) {
  const hasVersion = !!version && !/^\(no version/.test(version);
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex min-h-6 items-center gap-1.5 rounded-md bg-paper-2 px-2 text-[0.8125rem] leading-none text-ink-2 hover:bg-rule hover:text-ink",
            className,
          )}
        >
          <span className="font-medium">{shortDataset(dataset)}</span>
          {hasVersion && <>{" "}<span className="tabular font-mono text-ink-3">{version}</span></>}
          <span className="sr-only">, fetched {fetched}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-80 rounded-md p-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[0.8125rem]">
          <dt className="title-block-label">Dataset</dt>
          <dd>{dataset}{hasVersion ? ` ${version}` : " (no version published)"}</dd>
          <dt className="title-block-label">Fetched</dt>
          <dd className="tabular">{fetched}</dd>
          <dt className="title-block-label">Field</dt>
          <dd className="font-mono">{field}</dd>
          <dt className="title-block-label">Raw value</dt>
          <dd className="tabular break-all font-mono">{rawValue}</dd>
          {url && (
            <>
              <dt className="title-block-label">URL</dt>
              <dd className="break-all font-mono text-signal">{url}</dd>
            </>
          )}
        </dl>
      </HoverCardContent>
    </HoverCard>
  );
}
