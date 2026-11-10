import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepState = "pending" | "running" | "done" | "attention";

export interface RailStep {
  id: string;
  label: string;
  state: StepState;
  elapsedMs?: number;
  /** shown instead of the elapsed time, e.g. "cached" when no network work ran */
  detail?: string;
}

const STATE_LABEL: Record<StepState, string> = {
  pending: "Pending",
  running: "Running",
  done: "Done",
  attention: "Needs attention",
};

function formatElapsed(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function Tick({ state }: { state: StepState }) {
  if (state === "attention") {
    return <Flag className="size-4 text-flag" aria-hidden="true" />;
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="text-ink">
      {state === "done" ? (
        <circle cx="8" cy="8" r="5" fill="currentColor" />
      ) : (
        <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1" />
      )}
      {state === "running" && (
        <path className="rail-arc text-signal" d="M8 1.5 A6.5 6.5 0 0 1 14.5 8" fill="none" stroke="var(--signal)" strokeWidth="2" strokeLinecap="butt" />
      )}
    </svg>
  );
}

/** Purely presentational. Reports only the state it is given; never invents progress. */
export function StepRail({ steps, className }: { steps: RailStep[]; className?: string }) {
  return (
    <nav aria-label="Progress" className={className}>
      <ol className="grid grid-cols-3 gap-y-3 sm:flex sm:items-start">
        {steps.map((step, i) => (
          <li key={step.id} className="relative sm:flex-1" aria-current={step.state === "running" ? "step" : undefined}>
            {/* hairline segment from this tick to the next */}
            {i < steps.length - 1 && <span aria-hidden="true" className="absolute left-4 right-0 top-2 hidden h-px bg-rule-strong sm:block" />}
            <div className="relative flex flex-col items-start gap-1">
              <span className="relative z-10 grid size-4 place-items-center bg-paper">
                <Tick state={step.state} />
              </span>
              <span className={cn("text-[0.8125rem] leading-tight", step.state === "pending" ? "text-ink-3" : "text-ink font-medium")}>
                {step.label}
                <span className="sr-only">, {STATE_LABEL[step.state]}</span>
              </span>
              <span className="tabular min-h-4 font-mono text-[0.6875rem] text-ink-3">
                {step.detail ?? (step.elapsedMs !== undefined ? formatElapsed(step.elapsedMs) : "")}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}
