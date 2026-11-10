"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronUp, Info, Moon, PanelLeft, PanelRight, Sun } from "lucide-react";
import { MotionConfig } from "motion/react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { generate, refreshStatus } from "@/lib/studio/actions";
import { isTypingTarget, toggleTheme, useDark, useIsDesktop } from "@/lib/studio/hooks";
import { startHandoff, wantsHandoff } from "@/lib/studio/handoff";
import { metricsAnnouncement } from "@/lib/studio/format";
import { useStudio } from "@/lib/store/studio";
import { useGenerateBlocker } from "@/lib/studio/blocker";
import { CenterStage } from "./CenterStage";
import { DevDrawer } from "./DevDrawer";
import { ExportMenu } from "./ExportMenu";
import { LeftRail } from "./LeftRail";
import { OptionPanel } from "./OptionPanel";

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-sm border border-rule-strong bg-sheet px-1 font-sans text-[13px] text-ink-2">{children}</kbd>;
}

function ModeSwitch() {
  const ai = useStudio((s) => s.aiStatus);
  const mode = useStudio((s) => s.mode);
  const set = useStudio((s) => s.set);
  const off = !ai?.ai;
  const current = off ? "builtin" : mode;
  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger
          render={<button type="button" className="inline-flex min-h-10 items-center gap-1 rounded-md px-1 text-sm font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:hidden" />}
        >
          Strategies
          <Info className="size-4 text-ink-3" aria-hidden />
        </TooltipTrigger>
        <TooltipContent className="max-w-72 flex-col items-start gap-1 py-2 text-left">
          <span><strong>AI:</strong> Claude reads your brief and proposes the six options.</span>
          <span><strong>Built-in:</strong> six fixed rule-based strategies. No AI, same zoning checks.</span>
          <span>The geometry engine computes every number in both modes.</span>
        </TooltipContent>
      </Tooltip>
      <ToggleGroup
        aria-label="Strategies: where the options come from"
        size="sm"
        variant="outline"
        spacing={0}
        value={[current]}
        onValueChange={(v) => v[0] && !off && set({ mode: v[0] as "ai" | "builtin" })}
      >
        <ToggleGroupItem value="ai" disabled={off} aria-label={off ? "AI (not connected)" : "AI"}>AI</ToggleGroupItem>
        <ToggleGroupItem value="builtin" aria-label="Built-in strategies">Built-in</ToggleGroupItem>
      </ToggleGroup>
      {off && ai !== null && <span className="text-sm text-ink-3 max-xl:hidden">AI is not connected, so options use the built-in strategies.</span>}
    </div>
  );
}

/** Announce metric changes after parameter edits, once the slider has been quiet for 600 ms. */
function useMetricAnnouncer() {
  const sel = useStudio((s) => s.selectedIndex);
  const option = useStudio((s) => (s.selectedIndex === null ? null : (s.slots[s.selectedIndex]?.option ?? null)));
  const lastSel = useRef<number | null>(null);
  useEffect(() => {
    const changedSelection = lastSel.current !== sel;
    lastSel.current = sel;
    if (!option || changedSelection) return; // selection changes are announced elsewhere
    const t = setTimeout(() => useStudio.getState().announce(metricsAnnouncement(option)), 500);
    return () => clearTimeout(t);
  }, [option, sel]);
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStudio.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (isTypingTarget(e.target)) return; // native text undo
        e.preventDefault();
        s.undo();
        return;
      }
      if (mod || e.altKey || isTypingTarget(e.target)) return;
      if (/^[1-6]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (s.slots[i]) {
          s.select(i);
        }
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "c") s.set({ viewMode: s.viewMode === "compare" ? "focus" : "compare" });
      else if (k === "s") s.set({ sun: { ...s.sun, enabled: !s.sun.enabled } });
      else if (k === "e" && s.slots.some(Boolean)) {
        e.preventDefault();
        s.set({ exportOpen: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function StudioApp() {
  const dark = useDark();
  const announcement = useStudio((s) => s.announcement);
  const notice = useStudio((s) => s.notice);
  const devOpen = useStudio((s) => s.devOpen);
  const ai = useStudio((s) => s.aiStatus);
  const set = useStudio((s) => s.set);
  const hasOptions = useStudio((s) => s.slots.some(Boolean));
  const sel = useStudio((s) => s.selectedIndex);
  const genPhase = useStudio((s) => s.gen.phase);
  const scheduleConfirmed = useStudio((s) => !!s.schedule?.confirmed);
  const canGenerate = scheduleConfirmed && genPhase !== "running";
  const isDesktop = useIsDesktop();
  const [setupOpen, setSetupOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsNew, setDetailsNew] = useState(false);
  const blocker = useGenerateBlocker();
  useShortcuts();
  useMetricAnnouncer();
  useEffect(() => {
    const open = () => {
      if (!window.matchMedia("(min-width: 64rem)").matches) setSetupOpen(true);
    };
    window.addEventListener("studio:open-setup", open);
    return () => window.removeEventListener("studio:open-setup", open);
  }, []);
  useEffect(() => {
    void refreshStatus();
  }, []);
  useEffect(() => {
    if (!wantsHandoff(location.search)) return;
    return startHandoff();
  }, []);
  // State adjusted during render (React's "derive state from props" pattern), not in effects.
  // Below lg the rails live in sheets: close them when the layout goes inline.
  const [prevDesktop, setPrevDesktop] = useState(isDesktop);
  if (prevDesktop !== isDesktop) {
    setPrevDesktop(isDesktop);
    if (isDesktop) {
      setSetupOpen(false);
      setDetailsOpen(false);
      setDetailsNew(false);
    }
  }
  // Generation finished below lg: close Setup so the options are visible.
  const [prevPhase, setPrevPhase] = useState(genPhase);
  if (prevPhase !== genPhase) {
    setPrevPhase(genPhase);
    if (prevPhase === "running" && !isDesktop) setSetupOpen(false);
  }
  // Selecting an option below lg doesn't open Details; the button gets a "new" mark instead.
  const [prevSel, setPrevSel] = useState(sel);
  if (prevSel !== sel) {
    setPrevSel(sel);
    if (!isDesktop && sel !== null && !detailsOpen) setDetailsNew(true);
  }
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => set({ notice: null }), 5000);
    return () => clearTimeout(t);
  }, [notice, set]);

  return (
    <MotionConfig reducedMotion="user">
    <TooltipProvider>
      <div className="relative flex h-dvh flex-col overflow-hidden bg-paper text-graphite">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b-2 border-ink bg-paper px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="title-block text-base font-bold tracking-wide" aria-label="WXY">WXY</span>
            <span className="h-5 w-px bg-rule" aria-hidden />
            <h1 className="panel-title text-lg max-sm:sr-only">Massing Studio</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" className="lg:hidden" aria-haspopup="dialog" onClick={() => setSetupOpen(true)}>
              <PanelLeft data-icon="inline-start" aria-hidden />
              Setup
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="relative lg:hidden"
              aria-haspopup="dialog"
              disabled={!hasOptions}
              onClick={() => {
                setDetailsNew(false);
                setDetailsOpen(true);
              }}
            >
              <PanelRight data-icon="inline-start" aria-hidden />
              Details
              {detailsNew && hasOptions && (
                <>
                  <span aria-hidden className="absolute -top-1 -right-1 size-2.5 rounded-full bg-signal ring-2 ring-paper" />
                  <span className="sr-only"> (new selection)</span>
                </>
              )}
            </Button>
            <ModeSwitch />
            <ExportMenu />
          </div>
        </header>
        <main
          className={
            "grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden " +
            (isDesktop ? "grid-cols-[280px_minmax(0,1fr)_340px] xl:grid-cols-[320px_minmax(0,1fr)_420px]" : "grid-cols-1")
          }
        >
          {isDesktop && (
            <div className="flex min-h-0 flex-col overflow-hidden [&>nav]:min-h-0 [&>nav]:flex-1">
              <LeftRail />
            </div>
          )}
          <CenterStage />
          {isDesktop && (
            <aside aria-label="Option details" className="relative min-h-0 overflow-y-auto border-l border-rule bg-paper">
              <OptionPanel />
            </aside>
          )}
        </main>
        {!isDesktop && (
          <>
            <Sheet open={setupOpen} onOpenChange={setSetupOpen}>
              <SheetContent side="left" className="gap-0 p-0 data-[side=left]:w-[min(92vw,26rem)] data-[side=left]:sm:max-w-none">
                <SheetHeader className="border-b border-rule pr-14">
                  <SheetTitle>Setup</SheetTitle>
                  <SheetDescription className="sr-only">Site, brief, program schedule and assumptions</SheetDescription>
                </SheetHeader>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden [&>nav]:min-h-0 [&>nav]:flex-1">
                  <LeftRail />
                </div>
                {/* The stage's Generate button sits behind this sheet, so offer it here once the schedule is confirmed. */}
                <SheetFooter className="border-t border-rule">
                  <Button
                    disabled={!canGenerate}
                    onClick={() => {
                      setSetupOpen(false);
                      void generate();
                    }}
                  >
                    Generate 6 options
                  </Button>
                  {blocker && <p className="text-sm text-ink-3">{blocker.reason}</p>}
                </SheetFooter>
              </SheetContent>
            </Sheet>
            <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
              <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-[min(92vw,26rem)] data-[side=right]:sm:max-w-none">
                <SheetHeader className="border-b border-rule pr-14">
                  <SheetTitle>Details</SheetTitle>
                  <SheetDescription className="sr-only">Zoning numbers, parameters and history for the selected option</SheetDescription>
                </SheetHeader>
                <div aria-label="Option details" role="region" className="relative min-h-0 flex-1 overflow-y-auto">
                  <OptionPanel />
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}
        {devOpen && <DevDrawer />}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-rule bg-paper px-4 py-1 text-[13px] text-ink-3">
          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger
                render={<Button variant="ghost" size="xs" aria-expanded={devOpen} aria-controls="dev-drawer" onClick={() => set({ devOpen: !devOpen })} />}
              >
                <ChevronUp className={"size-4 transition-transform " + (devOpen ? "rotate-180" : "")} aria-hidden />
                AI usage and connection
              </TooltipTrigger>
              <TooltipContent>Opens a panel with AI status, token counts and cost for this session.</TooltipContent>
            </Tooltip>
            <span>{ai === null ? "" : ai.ai ? "AI is connected" : "Built-in strategies only"}</span>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <p className="truncate" aria-live="polite">
              {notice ?? (hasOptions ? <span className="[@media(hover:none)]:hidden">Shortcuts: <Kbd>1</Kbd> to <Kbd>6</Kbd> pick an option, <Kbd>C</Kbd> compare or focus, <Kbd>S</Kbd> sun, <Kbd>E</Kbd> export, <Kbd>⌘Z</Kbd> undo</span> : "")}
            </p>
            <Button variant="ghost" size="xs" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={toggleTheme}>
              {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
              {dark ? "Light theme" : "Dark theme"}
            </Button>
          </div>
        </footer>
        <div role="status" aria-live="polite" className="sr-only">
          {announcement}
        </div>
      </div>
    </TooltipProvider>
    </MotionConfig>
  );
}
