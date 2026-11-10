"use client";

import { Calculator, Check, CircleAlert, CircleCheck, CircleHelp, CircleX, Pencil, TriangleAlert, type LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { Status } from "@/lib/brief-client/review";
export type { Status };

/** One status vocabulary for the whole app. Colour is never alone: every status also carries an icon and a word. */

type Tone = "ok" | "warn" | "flag" | "neutral";

const META: Record<Status, { label: string; tip: string; icon: LucideIcon; tone: Tone }> = {
  cited: { label: "Cited", tip: "Quoted directly from the source.", icon: CircleCheck, tone: "ok" },
  inferred: { label: "Inferred", tip: "Derived from more than one clause; check the reasoning.", icon: CircleAlert, tone: "warn" },
  unverified: { label: "Unverified", tip: "No source found for this. Treat as a lead, not a fact.", icon: CircleHelp, tone: "warn" },
  conflicting: { label: "Conflicting", tip: "Sources disagree. Both readings are shown.", icon: TriangleAlert, tone: "flag" },
  "needs-input": { label: "Needs input", tip: "No source gives this value for this lot. Enter it or leave it open.", icon: CircleHelp, tone: "warn" },
  computed: { label: "Computed", tip: "Calculated in code from the values above.", icon: Calculator, tone: "neutral" },
  flag: { label: "Flag", tip: "A professional needs to look at this.", icon: TriangleAlert, tone: "flag" },
  accepted: { label: "Accepted", tip: "You accepted this assumption.", icon: Check, tone: "ok" },
  rejected: { label: "Rejected", tip: "You rejected this assumption; the memo uses the other value.", icon: CircleX, tone: "flag" },
  edited: { label: "Edited", tip: "You changed this assumption; the memo uses your value.", icon: Pencil, tone: "neutral" },
};

const TONE: Record<Tone, string> = {
  ok: "bg-ok-wash text-ok",
  warn: "bg-warn-wash text-warn",
  flag: "bg-flag-wash text-flag",
  neutral: "bg-paper-2 text-ink-2",
};

export function statusTone(kind: Status): Tone {
  return META[kind].tone;
}
export const toneClass = TONE;

export interface StatusPillProps {
  kind: Status;
  /** Replaces the default word, e.g. "Set by you". */
  label?: string;
  /** Hide the explanatory tooltip (and the tab stop) when the pill sits inside a link or button. */
  plain?: boolean;
  className?: string;
}

export function StatusPill({ kind, label, plain = false, className }: StatusPillProps) {
  const { label: word, tip, icon: Icon, tone } = META[kind];
  const body = (
    <>
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {label ?? word}
    </>
  );
  const cls = cn("inline-flex min-h-6 items-center gap-1 rounded-md px-2 text-[0.8125rem] font-medium leading-none whitespace-nowrap", TONE[tone], className);
  if (plain) return <span className={cls}>{body}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={cls}>{body}</span>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}
