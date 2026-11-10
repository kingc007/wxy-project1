"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type Confidence = "cited" | "inferred" | "unverified" | "conflicting" | "needs-input";

const COPY: Record<Confidence, { label: string; tip: string }> = {
  cited: { label: "Cited", tip: "Quoted directly from the source." },
  inferred: { label: "Inferred", tip: "Derived from more than one clause; check the reasoning." },
  unverified: { label: "Unverified", tip: "No source found for this. Treat as a lead, not a fact." },
  conflicting: { label: "Conflicting", tip: "Sources disagree. Both readings are shown." },
  "needs-input": { label: "Needs input", tip: "No source gives this value for this lot. Enter it or leave it open." },
};

/** Shape plus label, never colour alone. All in ink. */
function Shape({ kind }: { kind: Confidence }) {
  const common = { "aria-hidden": true as const, className: "shrink-0 text-ink" };
  switch (kind) {
    case "cited":
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" {...common}>
          <rect x="1.5" y="1.5" width="9" height="9" fill="currentColor" />
        </svg>
      );
    case "inferred":
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" {...common}>
          <rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
      );
    case "unverified":
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" {...common}>
          <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" />
        </svg>
      );
    case "conflicting":
      return (
        <svg width="16" height="14" viewBox="0 0 16 14" {...common}>
          <rect x="1.5" y="1.5" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
          <rect x="5.5" y="4.5" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
      );
    case "needs-input":
      return (
        <svg width="28" height="12" viewBox="0 0 28 12" {...common}>
          <rect x="0.5" y="1.5" width="27" height="9" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />
        </svg>
      );
  }
}

export function ConfidenceMark({ kind, className }: { kind: Confidence; className?: string }) {
  const { label, tip } = COPY[kind];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={cn("inline-flex min-h-6 items-center gap-1.5 rounded-[2px] text-xs text-ink", className)}>
          <Shape kind={kind} />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}
