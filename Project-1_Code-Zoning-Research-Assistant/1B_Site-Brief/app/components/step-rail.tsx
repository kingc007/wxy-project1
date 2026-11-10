import { useState } from "react";
import { ChevronDown, CircleCheck, Flag } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { DUR, EASE_OUT } from "@/lib/motion";

export type StepState = "pending" | "running" | "done" | "attention";

export interface RailStep {
  id: string;
  label: string;
  state: StepState;
  /** state word shown once done, e.g. "Found" for the lookup step. Defaults to "Done". */
  doneWord?: string;
}

/** State words shown under each step. Timings are not shown here; they live in the dev panel. */
const STATE_WORD: Record<StepState, string> = {
  pending: "Waiting",
  running: "Checking",
  done: "Done",
  attention: "For review",
};

function Tick({ state }: { state: StepState }) {
  if (state === "attention") {
    return <Flag className="size-3.5 text-flag" aria-hidden="true" />;
  }
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" className={state === "running" ? "text-signal" : "text-ink-3"}>
      {state === "done" ? (
        <circle cx="8" cy="8" r="4" fill="var(--ok)" />
      ) : (
        <circle cx="8" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      )}
      {state === "running" && (
        <path className="rail-arc text-signal" d="M8 1.5 A6.5 6.5 0 0 1 14.5 8" fill="none" stroke="var(--signal)" strokeWidth="1.5" strokeLinecap="butt" />
      )}
    </svg>
  );
}

/** Purely presentational. Reports only the state it is given; never invents progress. */
export function StepRail({ steps, className }: { steps: RailStep[]; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const finished = steps.length > 0 && steps.every((s) => s.state === "done" || s.state === "attention");
  const forReview = steps.filter((s) => s.state === "attention").length;

  // All checks are in: the rail folds to one line so it stops taking space. Steps stay one click away.
  if (finished && !expanded) {
    return (
      <nav aria-label="Progress" className={className}>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.875rem] text-ink-2">
          <span className="inline-flex items-center gap-1.5 font-medium text-ink">
            <CircleCheck className="size-4 text-ok" aria-hidden="true" />
            Brief drafted from {steps.length} checks{forReview > 0 ? `, ${forReview} for review` : ""}
          </span>
          <button
            type="button"
            aria-expanded={false}
            onClick={() => setExpanded(true)}
            className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-signal hover:bg-accent-wash"
          >
            Show steps<ChevronDown className="size-4" aria-hidden="true" />
          </button>
        </p>
      </nav>
    );
  }

  return (
    <nav aria-label="Progress" className={className}>
      {finished && (
        <button
          type="button"
          aria-expanded
          onClick={() => setExpanded(false)}
          className="mb-2 inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-[0.875rem] text-signal hover:bg-accent-wash"
        >
          Hide steps<ChevronDown className="size-4 rotate-180" aria-hidden="true" />
        </button>
      )}
      <ol className="grid grid-cols-3 gap-y-3 sm:flex sm:items-start">
        {steps.map((step, i) => {
          const complete = step.state === "done" || step.state === "attention";
          return (
            <li key={step.id} className="relative sm:flex-1" aria-current={step.state === "running" ? "step" : undefined}>
              {/* hairline from this tick to the next: a faint track, drawn in as this step completes */}
              {i < steps.length - 1 && (
                <span aria-hidden="true" className="absolute left-3 right-0 top-1.5 hidden h-px bg-rule sm:block">
                  <motion.span
                    className="block h-px origin-left bg-ink-2"
                    initial={false}
                    animate={{ scaleX: complete ? 1 : 0 }}
                    transition={{ duration: DUR.enter, ease: EASE_OUT }}
                  />
                </span>
              )}
              <div className="relative flex flex-col items-start gap-1">
                <span className="relative z-10 grid size-3 place-items-center bg-paper">
                  <Tick state={step.state} />
                </span>
                <span className={cn("text-[0.875rem] leading-tight", step.state === "running" ? "font-medium text-ink" : "text-ink-2")}>
                  {step.label}
                </span>
                <span className={cn("min-h-4 text-[0.8125rem]", step.state === "attention" ? "text-flag" : "text-ink-3")}>
                  {step.state === "done" && step.doneWord ? step.doneWord : STATE_WORD[step.state]}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
