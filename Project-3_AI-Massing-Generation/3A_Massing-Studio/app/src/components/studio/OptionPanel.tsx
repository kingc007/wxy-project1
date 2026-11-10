"use client";
import { useMemo } from "react";
import { History, MoreHorizontal, SlidersHorizontal, Table2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { thinkHarder } from "@/lib/studio/actions";
import { Textarea } from "@/components/ui/textarea";
import { TYPOLOGY_PRESETS, allowedNumbersFromOption, checkGrounding, fmtFar, fmtFt, fmtInt, fmtRound10, type TypologyLabel } from "@wxy/massing";
import { useStudio } from "@/lib/store/studio";
import type { OptionSlot } from "@/lib/store/logic";
import { maxFarOf, overallInfo } from "@/lib/studio/format";
import { staggerDelay } from "@/lib/motion";
import { DimensionString } from "./DimensionString";
import { Headline } from "./Headline";
import { HistoryList, IteratePanel } from "./IteratePanel";
import { ParamControls } from "./ParamControls";
import { ProgramFitTable, ZoningTable } from "./ZoningTable";
import { SampleTag, StatusBadge } from "./tags";

const typologyName = (t: TypologyLabel): string => (t === "block" ? "Block" : TYPOLOGY_PRESETS[t].name);

function Section({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 border-t border-rule px-4 py-4">
      <h3 id={id} className="panel-title">{title}</h3>
      {children}
    </section>
  );
}

/** Headline metrics as dimension strings. Redraws when the selected option changes (key), not on slider edits. */
function HeadlineMetrics({ slot }: { slot: OptionSlot }) {
  const m = slot.option.metrics;
  const max = maxFarOf(slot.option);
  const items = [
    { label: "Gross floor area", value: `${fmtRound10(m.gfa)} sf` },
    { label: max === null ? "FAR used" : `FAR used, max ${fmtFar(max)}`, value: fmtFar(m.far) },
    { label: "Height", value: fmtFt(m.height) },
    { label: "Floors", value: fmtInt(m.floors) },
  ];
  return (
    <div key={slot.index} className="grid grid-cols-2 gap-x-6 gap-y-5 py-1" aria-label="Headline numbers">
      {items.map((it, i) => (
        <DimensionString key={it.label} label={it.label} value={it.value} delay={staggerDelay(i, 0.12)} />
      ))}
    </div>
  );
}

function IntentNote({ slot }: { slot: OptionSlot }) {
  const setIntent = useStudio((s) => s.setIntent);
  const g = useMemo(
    () =>
      checkGrounding(slot.intent, allowedNumbersFromOption(slot.option), {
        ignoreTokens: [slot.name, `Option ${slot.index + 1}`],
      }),
    [slot.intent, slot.option, slot.name, slot.index],
  );
  return (
    <>
      <label htmlFor="intent-note" className="sr-only">Design intent</label>
      <Textarea
        id="intent-note"
        rows={3}
        value={slot.intent}
        onChange={(e) => setIntent(slot.index, e.target.value)}
        className="min-h-20 bg-paper text-sm leading-5"
        aria-describedby={!g.ok ? "intent-warning" : undefined}
      />
      {!g.ok && (
        <p id="intent-warning" className="flex items-start gap-1.5 text-review">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Contains numbers not computed by the engine: <span className="num">{g.unmatched.join(", ")}</span></span>
        </p>
      )}
      {slot.notes.length > 0 && (
        <ul className="flex list-disc flex-col gap-0.5 pl-4 text-ink-3">
          {slot.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </>
  );
}

const PREVIEW: { Icon: typeof Table2; title: string; text: string }[] = [
  { Icon: Table2, title: "Zoning table", text: "Every rule with its allowed and proposed value, marked pass, fails or needs input." },
  { Icon: SlidersHorizontal, title: "Parameters", text: "Sliders for height, setbacks and tower position. Numbers update as you move them." },
  { Icon: History, title: "History", text: "Each change you make, with undo." },
];

/** Shown until an option is selected: what will appear here, and the one next step. */
function EmptyPanel() {
  const hasOptions = useStudio((s) => s.slots.some(Boolean));
  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="panel-title">Option details</h2>
        <p className="text-ink-2">
          {hasOptions ? "Pick an option in the viewer to see its numbers here." : "Generate options, then pick one. You will see:"}
        </p>
      </div>
      <ul className="flex flex-col gap-4">
        {PREVIEW.map(({ Icon, title, text }) => (
          <li key={title} className="flex gap-3">
            <Icon className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden />
            <div className="flex flex-col">
              <span className="font-semibold">{title}</span>
              <span className="text-ink-2">{text}</span>
            </div>
          </li>
        ))}
      </ul>
      {hasOptions && <p className="text-ink-3">Keyboard: press 1 to 6 to pick an option.</p>}
      <p className="text-ink-3">Numbers come from the geometry engine, not the AI. Study-grade only; check with a zoning professional.</p>
    </div>
  );
}

export function OptionPanel() {
  const idx = useStudio((s) => s.selectedIndex);
  const slot = useStudio((s) => (s.selectedIndex === null ? null : s.slots[s.selectedIndex]));
  const sample = useStudio((s) => s.siteIsSample);
  const canThink = useStudio((s) => !!s.aiStatus?.ai && s.mode === "ai" && !!s.schedule?.confirmed);
  const thinking = useStudio((s) => s.thinkingSlot !== null);
  if (idx === null || !slot) return <EmptyPanel />;
  const st = overallInfo(slot.option);
  return (
    <div className="flex flex-col">
      <header className="flex flex-col gap-2 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="display min-w-0">
            <span className="block font-sans text-sm font-normal text-ink-3" style={{ fontVariationSettings: '"wdth" 100' }}>Option {slot.index + 1} of 6</span>
            <Headline text={slot.name} />
          </h2>
          {canThink && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More actions for this option" />}>
                <MoreHorizontal aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem disabled={thinking} onClick={() => void thinkHarder(slot.index)}>
                  Think harder (Opus)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {thinking && <p className="text-ink-3" role="status">Thinking harder about this option…</p>}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge kind={st.kind} label={st.label} />
          {sample && <SampleTag />}
        </div>
        <p className="text-ink-3">
          {typologyName(slot.option.typology) !== slot.name ? `${typologyName(slot.option.typology)} massing. ` : ""}
          {slot.source === "ai" ? "Proposed by AI." : "From the built-in strategies."}
        </p>
        <HeadlineMetrics slot={slot} />
        <IntentNote slot={slot} />
      </header>
      <Section id="sec-zoning" title="Zoning table"><ZoningTable option={slot.option} /></Section>
      <Section id="sec-fit" title="Program fit"><ProgramFitTable option={slot.option} /></Section>
      <Section id="sec-params" title="Parameters"><ParamControls slot={slot} /></Section>
      <Section id="sec-iterate" title="Iterate"><IteratePanel slot={slot} /></Section>
      <Section id="sec-history" title="History"><HistoryList slot={slot} /></Section>
    </div>
  );
}
