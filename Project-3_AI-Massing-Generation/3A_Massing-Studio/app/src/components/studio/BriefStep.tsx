"use client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { readBrief, startEmptySchedule } from "@/lib/studio/actions";
import { useStudio } from "@/lib/store/studio";
import { plainNotice } from "@/lib/studio/format";

export function BriefStep() {
  const brief = useStudio((s) => s.brief);
  const setBrief = useStudio((s) => s.setBrief);
  const model = useStudio((s) => s.model);
  const status = useStudio((s) => s.briefStatus);
  const error = useStudio((s) => s.briefError);
  const warning = useStudio((s) => s.briefWarning);
  const ai = useStudio((s) => s.aiStatus);
  const schedule = useStudio((s) => s.schedule);
  const loading = status === "loading";
  return (
    <>
      {ai && !ai.ai && <p className="text-ink-3">AI is not connected. If reading the brief fails, skip it and fill the schedule in by hand.</p>}
      <label htmlFor="brief-text" className="font-medium">
        Project brief
      </label>
      <Textarea
        id="brief-text"
        aria-label="Project brief"
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        disabled={!model}
        rows={9}
        placeholder="Describe the project the way you'd brief the team: units, uses, ground floor, open space, moves you want to try. e.g. ~120 units, ground-floor retail, a public courtyard, step down toward the park."
        className="min-h-44 resize-y rounded-sm border-rule bg-paper px-3 py-2 text-[15px] leading-6"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={!model || !brief.trim() || loading} onClick={() => void readBrief()}>
          {loading && <Spinner data-icon="inline-start" />}
          {loading ? "Reading the brief…" : "Read brief"}
        </Button>
        {!schedule && (
          <Button variant="link" disabled={!model} onClick={startEmptySchedule}>
            Skip the brief and start with an empty schedule
          </Button>
        )}
      </div>
      {!model && <p className="text-ink-3">Choose a site first.</p>}
      {warning && <p className="text-ink-3">{plainNotice(warning)}</p>}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Brief not read</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  );
}
