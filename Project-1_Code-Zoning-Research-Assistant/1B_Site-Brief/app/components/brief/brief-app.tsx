"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { LayoutGroup } from "motion/react";
import { AddressInput } from "@/components/address-input";
import { MaskedHeading } from "@/components/masked-heading";
import { MapPanel } from "@/components/map-panel";
import { PlanGridBackdrop } from "@/components/plan-grid-backdrop";
import { SourcePane } from "@/components/source-pane";
import { StepRail, type RailStep } from "@/components/step-rail";
import { ChevronRight } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Citation } from "@/lib/types";
import type { EnvelopeLike } from "@/lib/geometry/envelope-input";
import type { IntendedUse } from "@/lib/zoning/model";
import { COPY, STEP_IDS, STEP_LABELS, type BriefRequest } from "@/lib/brief-client/events";
import { useBrief } from "@/lib/brief-client/use-brief";
import { BriefUiProvider, readStoredReviewer } from "./context";
import { applyCrosscheck } from "@/lib/brief-client/crosscheck-apply";
import { useNarrative } from "@/lib/brief-client/use-narrative";
import { DevDrawer } from "./dev-drawer";
import { EXAMPLES } from "./examples";
import { Memo } from "./memo";
import { Options } from "./options";

export function BriefApp() {
  const { state, start, recompute } = useBrief();
  const [text, setText] = useState("");
  const [intendedUse, setIntendedUse] = useState<IntendedUse>("residential");
  const [programs, setPrograms] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string | boolean>>({});
  const [citation, setCitation] = useState<Citation | null>(null);
  const [paneOpen, setPaneOpen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const pendingToast = useRef(false);

  const bbl = state.site?.geocode?.bbl ?? null;
  const busy = state.status === "running";

  const build = useCallback(
    (query: string, o: Record<string, string | boolean>, use: IntendedUse, progs: string[]): BriefRequest => ({
      query, intendedUse: use, programs: progs, overrides: o, verifiedBy: readStoredReviewer(),
    }),
    [],
  );

  const submit = useCallback((query: string) => {
    setOverrides({});
    void start(build(query, {}, intendedUse, programs));
  }, [start, build, intendedUse, programs]);

  const rerun = useCallback((o: Record<string, string | boolean>, use: IntendedUse, progs: string[], toastIt: boolean) => {
    if (!state.request) return;
    pendingToast.current = toastIt;
    void recompute({ ...build(state.request.query, o, use, progs), bbl: bbl ?? undefined });
  }, [state.request, recompute, build, bbl]);

  const onOverride = useCallback((key: string, value: string | boolean | null) => {
    const next = { ...overrides };
    if (value === null) delete next[key]; else next[key] = value;
    setOverrides(next);
    rerun(next, intendedUse, programs, true);
  }, [overrides, rerun, intendedUse, programs]);

  useEffect(() => {
    if (state.status === "done" && pendingToast.current) {
      pendingToast.current = false;
      toast(COPY.saved);
    }
  }, [state.status, state.runs]);

  // Live-region narration of real step progress.
  useEffect(() => {
    const running = STEP_IDS.find((id) => state.steps[id].state === "running");
    if (running) setAnnounce(`${STEP_LABELS[running]} in progress.`); // eslint-disable-line react-hooks/set-state-in-effect
    else if (state.status === "done") setAnnounce("Brief ready.");
    else if (state.status === "error" && state.error) setAnnounce(state.error);
  }, [state.steps, state.status, state.error]);

  const narrativeKey = state.request ? JSON.stringify([state.request.intendedUse, state.request.programs, state.request.overrides, state.runs === 0 ? 0 : 1]) : "";
  const narrative = useNarrative(state.status === "done" && state.meta?.llm === true && !!state.brief, state.request, bbl, narrativeKey);
  const shownBrief = useMemo(() => (state.brief ? applyCrosscheck(state.brief, narrative.crosscheck) : null), [state.brief, narrative.crosscheck]);

  const steps: RailStep[] = STEP_IDS.map((id) => {
    const s = state.steps[id];
    return { id, label: STEP_LABELS[id], state: s.state, doneWord: id === "locate" ? "Found" : undefined };
  });

  const primary = state.site?.pluto?.zoneDist[0] ?? "";
  const showResSite = /^R[1-5]/i.test(primary);

  const envelope = (state.brief?.envelope ?? null) as EnvelopeLike | null;
  const mapDistricts = useMemo(
    () => (state.site?.districts ?? []).map((d) => ({ code: d.code, kind: d.kind, geometry4326: d.geometry4326 })),
    [state.site],
  );
  const g = state.site?.geocode;
  const openCitation = useCallback((c: Citation) => { setCitation(c); setPaneOpen(true); }, []);

  const closePane = useCallback(() => setPaneOpen(false), []);

  // First screen: before any request the address field is the hero. Submitting sets the request, the field
  // morphs (shared layoutId frame) into the header bar and the working layout takes over.
  const hero = state.status === "idle";
  const options = (
    <Options
      intendedUse={intendedUse}
      onIntendedUse={(u) => { setIntendedUse(u); if (state.brief) rerun(overrides, u, programs, false); }}
      programs={programs}
      onPrograms={(p) => { setPrograms(p); if (state.brief) rerun(overrides, intendedUse, p, false); }}
      showResidentialSite={showResSite}
    />
  );
  const pick = (q: string) => { setText(q); submit(q); };

  return (
    <BriefUiProvider bbl={bbl} onOpenCitation={openCitation} assumptionOriginals={state.originals}>
      <LayoutGroup>
      <div className="relative isolate flex w-full flex-1 flex-col">
        <PlanGridBackdrop />
        <header className="flex items-center justify-between gap-4 border-b border-ink bg-paper px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <span className="text-[17px] font-bold tracking-wide text-ink [font-stretch:75%]">WXY</span>
            <span aria-hidden="true" className="h-5 w-px bg-rule" />
            <h1 className="heading-wide text-[17px] leading-none text-ink">Site Brief</h1>
          </div>
          <ThemeToggle />
        </header>

        <div className="sr-only" role="status" aria-live="polite">{announce}</div>

        {hero ? (
          <main className="flex flex-1 flex-col items-center px-4 pb-16 pt-[14vh] md:px-8">
            <section aria-label="Zoning brief" className="w-full max-w-[720px]">
              <MaskedHeading className="display mb-8">Which lot are you looking at?</MaskedHeading>
              <AddressInput variant="hero" value={text} onValueChange={setText} onSubmit={(q) => submit(q)} busy={false} />
              <p className="mt-4 text-[0.9375rem] text-ink-2">{COPY.empty}</p>
              {options}
              <EvalLots onPick={pick} className="mt-14" />
            </section>
          </main>
        ) : (
          <>
            <div className="border-b border-rule px-4 py-5 md:px-8">
              <AddressInput value={text} onValueChange={setText} onSubmit={(q) => submit(q)} busy={busy && !state.recomputing} />
              {options}
              <StepRail steps={steps} className="mt-5" />
            </div>

            {state.error && (
              <Alert role="alert" className="rounded-md border-0 border-b border-rule bg-paper-2 px-4 md:px-8">
                <AlertDescription className="text-ink">{state.error}</AlertDescription>
              </Alert>
            )}

            <main className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-[minmax(0,1fr)] md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:grid-cols-[minmax(22rem,1.4fr)_minmax(0,3fr)]">
              <div className="min-h-[22rem] border-b border-rule px-4 py-4 md:sticky md:top-0 md:h-dvh md:self-start md:border-b-0 md:border-r md:px-8">
                <MapPanel
                  lot4326={state.site?.geometry?.ring4326 ?? null}
                  neighbors4326={state.site?.neighbors4326}
                  districts={mapDistricts}
                  center={g ? [g.lon, g.lat] : undefined}
                  bbl={bbl}
                  envelope={envelope}
                />
              </div>
              <div className="bg-sheet">
                {state.site && shownBrief ? (
                  <Memo
                    site={state.site}
                    brief={shownBrief}
                    narrative={narrative}
                    request={state.request}
                    llm={state.meta?.llm ?? null}
                    recomputing={state.recomputing}
                    onOverride={onOverride}
                  />
                ) : (
                  <section aria-label="Zoning brief" className="p-5 md:p-8">
                    {busy ? (
                      <p className="text-base text-ink-2">Drafting the brief. Steps above show what is running.</p>
                    ) : (
                      <>
                        <p className="max-w-[72ch] text-base leading-[1.55] text-ink-2">{COPY.empty}</p>
                        <EvalLots onPick={pick} className="mt-10" />
                      </>
                    )}
                  </section>
                )}
              </div>
            </main>
          </>
        )}

        <footer className="border-t border-rule px-4 pb-12 pt-4 text-[0.8125rem] text-ink-2 md:px-8">{COPY.disclaimer}</footer>
      </div>
      </LayoutGroup>
      <DevDrawer state={state} narrative={narrative} />
      <SourcePane open={paneOpen} citation={citation} onClose={closePane} />
    </BriefUiProvider>
  );
}

/** The evaluation lots: whole rows are the target, with a hover wash and a readable tag on the right. */
function EvalLots({ onPick, className }: { onPick: (q: string) => void; className?: string }) {
  return (
    <section aria-labelledby="eval-lots" className={className}>
      <h2 id="eval-lots" className="field-label">Try an evaluation lot</h2>
      <ul className="mt-2 divide-y divide-rule border border-rule bg-sheet">
        {EXAMPLES.map((e) => (
          <li key={e.query}>
            <button
              type="button"
              onClick={() => onPick(e.query)}
              className="group flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors duration-100 hover:bg-accent-wash focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal active:bg-accent-wash"
            >
              <span className="text-[0.9375rem] font-medium text-ink">{e.query}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="rounded-md bg-paper-2 px-2 py-0.5 text-[0.8125rem] text-ink-2">{e.note}</span>
                <ChevronRight className="size-4 text-ink-3 group-hover:text-signal" aria-hidden="true" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
