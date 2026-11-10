"use client";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "cn";
import type { StepId } from "@/lib/store/studio";
import { useStudio } from "@/lib/store/studio";

export type StepState = "done" | "current" | "upcoming";

const STATE_WORD: Record<StepState, string> = { done: "done", current: "next step", upcoming: "not started" };

/** One stepper entry: numbered header button (jumpable), one-line summary when collapsed. */
export function Step({
  id,
  n,
  title,
  summary,
  state,
  children,
}: {
  id: StepId;
  n: number;
  title: string;
  summary: string;
  state: StepState;
  children: React.ReactNode;
}) {
  const active = useStudio((s) => s.activeStep);
  const set = useStudio((s) => s.set);
  const open = active === id;
  return (
    <li
      className={cn(
        "relative border-b border-rule last:border-b-0",
        // Current step: a 4px signal bar down the left edge (not colour alone: the badge is also filled and the word is announced).
        state === "current" && "before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-signal",
      )}
      data-state={state}
    >
      <h2 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`step-${id}`}
          onClick={() => set({ activeStep: open ? "none" : id })}
          className="flex min-h-14 w-full items-start gap-3 px-4 py-3 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span
            aria-hidden
            className={cn(
              "num mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
              state === "done" && "bg-ok-wash text-ok",
              state === "current" && "bg-signal text-sheet",
              state === "upcoming" && "border border-rule-strong text-ink-3",
            )}
          >
            {state === "done" ? <Check className="size-4" strokeWidth={2.5} /> : n}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={cn("panel-title", state === "upcoming" && "text-ink-2")}>
              {title}
              <span className="sr-only">, {STATE_WORD[state]}</span>
            </span>
            {!open && <span className="line-clamp-2 text-ink-3" title={summary}>{summary}</span>}
          </span>
          <ChevronRight className={cn("mt-1 size-4 shrink-0 text-ink-3 transition-transform", open && "rotate-90")} aria-hidden />
        </button>
      </h2>
      {open && (
        <div id={`step-${id}`} className="flex flex-col gap-3 px-4 pb-5 pl-[52px]">
          {children}
        </div>
      )}
    </li>
  );
}
