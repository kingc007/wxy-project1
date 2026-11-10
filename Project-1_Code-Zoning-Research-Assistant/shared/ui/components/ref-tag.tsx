"use client";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

export interface RefTagProps {
  /** Short clause label shown in the box, e.g. a section number. */
  label: string;
  /** Verbatim passage shown in the preview. */
  quote: string;
  /** Section title. */
  title: string;
  /** Last-amended date as display text. */
  lastAmended?: string;
  /** Opens the Source pane at the cited span. */
  onOpen?: () => void;
  className?: string;
}

/** Hairline leader from the tag to its preview card. Sits on whichever side faces the trigger. */
function Leader() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      className="absolute left-3 text-signal group-data-[side=bottom]/rt:-top-4 group-data-[side=top]/rt:-bottom-4"
    >
      <line className="leader-line" x1="2" y1="0" x2="2" y2="16" stroke="currentColor" strokeWidth="1" />
      <circle cx="2" cy="0" r="1.5" fill="currentColor" className="hidden group-data-[side=bottom]/rt:block" />
      <circle cx="2" cy="16" r="1.5" fill="currentColor" className="hidden group-data-[side=top]/rt:block" />
    </svg>
  );
}

export function RefTag({ label, quote, title, lastAmended, onOpen, className }: RefTagProps) {
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open source: ${label}`}
          className={cn(
            "inline-flex items-center rounded-[2px] border border-signal px-1 align-baseline font-mono text-xs leading-5 text-signal",
            "hover:bg-accent-wash active:scale-[0.98] motion-reduce:active:scale-100 transition-transform duration-100",
            className,
          )}
        >
          {label}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        sideOffset={16}
        className="group/rt relative w-80 overflow-visible rounded-[2px] border border-rule-strong bg-paper p-3 shadow-none ring-0"
      >
        <Leader />
        <p className="text-[0.8125rem] font-medium text-ink">{title}</p>
        <blockquote className="mt-1.5 border-l border-signal pl-2 text-[0.8125rem] leading-[1.55] text-ink-2">{quote}</blockquote>
        {lastAmended && <p className="tabular mt-2 font-mono text-[0.6875rem] text-ink-3">Last amended {lastAmended}</p>}
      </HoverCardContent>
    </HoverCard>
  );
}
