"use client";
import { siteSubline } from "@/lib/studio/actions";
import { summarizeRawEnvelope } from "@/lib/studio/samples";
import { useStudio } from "@/lib/store/studio";
import { AssumptionsStep } from "./AssumptionsStep";
import { BriefStep } from "./BriefStep";
import { ScheduleStep } from "./ScheduleStep";
import { SiteStep } from "./SiteStep";
import { Step, type StepState } from "./Step";

export function LeftRail() {
  const model = useStudio((s) => s.model);
  const raw = useStudio((s) => s.envelopeRaw);
  const brief = useStudio((s) => s.brief);
  const schedule = useStudio((s) => s.schedule);
  const a = useStudio((s) => s.assumptions);
  const edited = [...Object.values(a.floorToFloor), a.groundFloorHeight, a.avgUnitNetSf, a.efficiency].filter((v) => v.source === "user").length;
  const site = model ? siteSubline(model, summarizeRawEnvelope(raw).district) : "Not chosen yet";
  const b = brief.trim();
  // Sequence: the first step that is not done is "current"; later ones are upcoming.
  const done = [!!model, !!schedule || b.length > 0, !!schedule?.confirmed, edited > 0 && !!schedule?.confirmed];
  const first = done.indexOf(false);
  const state = (i: number): StepState => (done[i] ? "done" : i === first ? "current" : "upcoming");
  return (
    <nav aria-label="Project setup" className="relative flex flex-col overflow-y-auto border-rule bg-paper lg:border-r">
      <ol className="m-0 flex list-none flex-col p-0">
        <Step id="site" n={1} title="Site" state={state(0)} summary={site}>
          <SiteStep />
        </Step>
        <Step id="brief" n={2} title="Brief" state={state(1)} summary={b ? (b.length > 48 ? `${b.slice(0, 48)}…` : b) : (schedule ? "Skipped, using an empty schedule" : "Not written yet")}>
          <BriefStep />
        </Step>
        <Step
          id="schedule"
          n={3}
          title="Program schedule"
          state={state(2)}
          summary={schedule ? `${schedule.uses.length} use${schedule.uses.length === 1 ? "" : "s"}, ${schedule.confirmed ? "confirmed" : "not confirmed yet"}` : "No schedule yet"}
        >
          <ScheduleStep />
        </Step>
        <Step id="assumptions" n={4} title="Assumptions" state={state(3)} summary={edited ? `${edited} edited` : "Defaults (optional)"}>
          <AssumptionsStep />
        </Step>
      </ol>
    </nav>
  );
}
