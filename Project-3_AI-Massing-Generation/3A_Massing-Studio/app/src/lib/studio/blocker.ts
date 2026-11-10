import { useStudio, type StepId } from "@/lib/store/studio";

export interface GenerateBlocker {
  /** Plain-words reason Generate is unavailable. */
  reason: string;
  /** The step that unblocks it. */
  step: StepId;
  /** Link text for jumping there. */
  action: string;
}

/** Why Generate is disabled right now (null when it can run). Shown once, next to the button. */
export function useGenerateBlocker(): GenerateBlocker | null {
  const hasModel = useStudio((s) => !!s.model);
  const hasSchedule = useStudio((s) => !!s.schedule);
  const confirmed = useStudio((s) => !!s.schedule?.confirmed);
  if (!hasModel) return { reason: "Choose a site first.", step: "site", action: "Go to the site step" };
  if (!hasSchedule) return { reason: "Write a brief, or skip it, to get a program schedule.", step: "brief", action: "Go to the brief" };
  if (!confirmed) return { reason: "Confirm the program schedule to generate.", step: "schedule", action: "Go to the schedule" };
  return null;
}

/** Opens a setup step; below lg the steps live in the Setup sheet, so this also asks the shell to open it. */
export function goToStep(step: StepId) {
  useStudio.getState().set({ activeStep: step });
  window.dispatchEvent(new CustomEvent("studio:open-setup"));
}
