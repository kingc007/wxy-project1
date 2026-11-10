"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { Check, LayoutGrid, Maximize2 } from "lucide-react";
import { cn } from "cn";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ViewerToolbar } from "@/components/viewer/ViewerToolbar";
import type { CameraPreset } from "@/components/viewer/types";
import { fmtFt } from "@wxy/massing";
import { generate, lotLatLng } from "@/lib/studio/actions";
import { DUR_REDUCED, EASE_IN, EASE_OUT, SPRING } from "@/lib/motion";
import { useDark } from "@/lib/studio/hooks";
import { metricRow, overallInfo, plainNotice } from "@/lib/studio/format";
import { sunAt, presetById, daylightRange } from "@/lib/studio/sun-study";
import { envelopeSections, optionLabel, slotIdToIndex, viewerOption } from "@/lib/studio/viewer-data";
import { OPTION_COUNT, type OptionSlot } from "@/lib/store/logic";
import { useStudio } from "@/lib/store/studio";

const st = () => useStudio.getState();
import { MassingScene, OptionsGrid } from "./Viewer";
import { SiteChooser } from "./SiteChooser";
import { SunPanel } from "./SunPanel";
import { StatusBadge } from "./tags";
import { goToStep, useGenerateBlocker } from "@/lib/studio/blocker";

function TileLabel({ slot, order, selected }: { slot: OptionSlot; order: number; selected: boolean }) {
  const reduced = useReducedMotion();
  const st = overallInfo(slot.option);
  const shown = metricRow(slot.option).filter((m) => m.id === "far" || m.id === "gfa" || m.id === "height");
  return (
    <motion.div
      // The one orchestrated moment: tiles' captions "set down" in sequence (fade only under reduced motion).
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0.15 } : { type: "spring", bounce: 0, duration: 0.35, delay: order * 0.05 }}
      className="flex flex-col gap-1 border-t border-rule bg-sheet px-3 py-2"
    >
      <div className="flex items-center justify-between gap-2 text-[13px] text-ink-3">
        <span>Option {slot.index + 1}</span>
        {selected && (
          <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-signal">
            <Check className="size-4" aria-hidden />
            Selected
          </span>
        )}
      </div>
      <p className="display-sm line-clamp-2 min-w-0" title={slot.name}>{slot.name}</p>
      <StatusBadge kind={st.kind} label={st.label} className="w-fit" />
      <p className="num flex flex-wrap gap-x-3 gap-y-0 text-sm max-sm:hidden">
        {shown.map((m) => (
          <span key={m.id} className="whitespace-nowrap">
            <span className="text-ink-3">{m.label} </span>
            <span className="font-semibold">{m.value}</span>
          </span>
        ))}
      </p>
    </motion.div>
  );
}

/**
 * Shared-layout frame: the focused option's tile frame morphs into the focus stage and back (layoutId).
 * The R3F canvases are separate (one per mode), so only this frame morphs and the canvases cross-fade.
 */
function StageFrame() {
  return (
    <motion.div
      layoutId="stage-frame"
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 border-2 border-signal"
      transition={SPRING}
    />
  );
}

export function CenterStage() {
  const slots = useStudio((s) => s.slots);
  const model = useStudio((s) => s.model);
  const gen = useStudio((s) => s.gen);
  const sel = useStudio((s) => s.selectedIndex);
  const mode = useStudio((s) => s.viewMode);
  const style = useStudio((s) => s.style);
  const sun = useStudio((s) => s.sun);
  const cutZ = useStudio((s) => s.sectionCutZ);
  const context = useStudio((s) => s.context);
  const settle = useStudio((s) => s.settleNonce);
  const site = useStudio((s) => s.site);
  const siteId = useStudio((s) => s.siteId);
  const handoff = useStudio((s) => s.handoff);
  const set = useStudio((s) => s.set);
  const dark = useDark();
  const reduced = useReducedMotion();
  const [ready, setReady] = useState({ scene: false, grid: false });
  const [preset, setPreset] = useState<{ p: CameraPreset; n: number }>({ p: "axon-ne", n: 0 });

  const filled = slots.filter((s): s is OptionSlot => !!s);
  const sections = useMemo(() => (model ? envelopeSections(model) : []), [model]);
  const lot = useMemo(() => (model ? [model.lot] : []), [model]);
  const options = useMemo(() => filled.map(viewerOption), [slots]); // eslint-disable-line react-hooks/exhaustive-deps
  const { lat, lng } = useMemo(() => lotLatLng(), [site]); // eslint-disable-line react-hooks/exhaustive-deps
  const sunState = useMemo(() => {
    const pr = presetById(sun.preset);
    const [lo, hi] = daylightRange(pr, lat, lng);
    const v = sunAt(pr, Math.min(hi, Math.max(lo, sun.minutes)), lat, lng);
    return { dir: v.dir, enabled: sun.enabled && v.altitudeDeg > 0 };
  }, [sun, lat, lng]);

  const selSlot = sel !== null ? slots[sel] : null;
  const focusSlot = selSlot ?? filled[0] ?? null;
  const running = gen.phase === "running";
  const focusOptions = useMemo(() => {
    const f = (sel !== null ? slots[sel] : null) ?? slots.find(Boolean) ?? null;
    return f ? [viewerOption(f)] : [];
  }, [slots, sel]);
  const hasOptions = filled.length > 0;
  const focus = !hasOptions || mode === "focus";
  const maxZ = Math.max(10, model?.maxBuildingHeight?.value ?? 0, ...filled.map((s) => s.option.metrics.height));
  const blocker = useGenerateBlocker();
  const canGenerate = !blocker && !running;
  const toolbar = (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex flex-col items-center gap-2 px-4">
      {sun.enabled && <SunPanel />}
      <ViewerToolbar
        preset={preset.p}
        onPreset={(p) => setPreset((s) => ({ p, n: s.n + 1 }))}
        sectionCutZ={cutZ}
        sectionMaxZ={maxZ}
        onSectionCutZ={(z) => set({ sectionCutZ: z })}
        sunEnabled={sun.enabled}
        onSunEnabled={(on) => set({ sun: { ...sun, enabled: on } })}
        style={style}
        onStyle={(s) => set({ style: s })}
      />
    </div>
  );

  const describe = (s: OptionSlot) => {
    const m = s.option.metrics;
    return `${optionLabel(s)}, ${m.floors} floors, ${fmtFt(m.height)}. ${s.option.overall.label}. Full numbers are in the zoning table in the option panel.`;
  };

  return (
    <section aria-label="Viewer" className="relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-paper">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-rule bg-paper px-4 py-2">
        <ToggleGroup
          aria-label="View"
          size="sm"
          variant="outline"
          spacing={0}
          value={[hasOptions ? mode : "focus"]}
          onValueChange={(v) => v[0] && set({ viewMode: v[0] as "compare" | "focus" })}
        >
          <ToggleGroupItem value="compare" disabled={!hasOptions} aria-label="Compare, all options (C)"><LayoutGrid data-icon="inline-start" />Compare</ToggleGroupItem>
          <ToggleGroupItem value="focus" aria-label="Focus, one option (C)"><Maximize2 data-icon="inline-start" />Focus</ToggleGroupItem>
        </ToggleGroup>
        <Button disabled={!canGenerate} onClick={() => void generate()}>
          {running && <Spinner data-icon="inline-start" />}
          {running ? `Building ${OPTION_COUNT} options… ${gen.done}/${OPTION_COUNT}` : "Generate 6 options"}
        </Button>
        {blocker && !running && (
          <p className="flex flex-wrap items-center gap-x-1 text-ink-2">
            {blocker.reason}
            <Button variant="link" onClick={() => goToStep(blocker.step)}>{blocker.action}</Button>
          </p>
        )}
        {gen.message && !running && (
          <Alert variant={gen.phase === "error" ? "destructive" : "default"} className="w-auto max-w-xl py-1">
            <AlertDescription>{plainNotice(gen.message)}</AlertDescription>
          </Alert>
        )}
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-sheet">
        {!model ? (
          handoff === "waiting" ? (
            <p role="status" className="flex size-full items-center justify-center px-8 text-center text-ink-3">
              Receiving the lot from Site Brief…
            </p>
          ) : (
            <SiteChooser />
          )
        ) : (
          <LayoutGroup id="stage">
            <AnimatePresence initial={false}>
              {focus ? (
                <motion.div
                  key="focus"
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: reduced ? { duration: DUR_REDUCED } : { duration: 0.3, ease: EASE_OUT, delay: 0.1 } }}
                  exit={{ opacity: 0, transition: { duration: reduced ? DUR_REDUCED : 0.22, ease: EASE_IN } }}
                >
                  <MassingScene
                    options={focusOptions}
                    selectedId={focusOptions[0]?.id}
                    envelopeSections={sections}
                    lot={lot}
                    context={context}
                    style={style}
                    sun={sunState}
                    sectionCutZ={cutZ}
                    cameraPreset={preset.p}
                    presetNonce={preset.n}
                    arrivalKey={siteId}
                    onPresetRequest={(p) => setPreset((s) => ({ p, n: s.n + 1 }))}
                    description={focusSlot ? describe(focusSlot) : `Site ${model.envelopeId}: lot, zoning envelope and context buildings. No options yet.`}
                    dark={dark}
                    onReady={() => setReady((r) => (r.scene ? r : { ...r, scene: true }))}
                  />
                  {hasOptions && sel !== null && <StageFrame />}
                </motion.div>
              ) : (
                <motion.div
                  key="compare"
                  className="absolute inset-0"
                  exit={{ opacity: 0, transition: { duration: reduced ? DUR_REDUCED : 0.22, ease: EASE_IN } }}
                >
                  <motion.div
                    key={settle}
                    className={cn("size-full", sun.enabled ? "pb-56 sm:pb-64" : "pb-16 sm:pb-28")}
                    initial={reduced || settle === 0 ? false : { opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={reduced ? { duration: DUR_REDUCED } : { type: "spring", bounce: 0, duration: 0.35 }}
                  >
                    <OptionsGrid
                      className="size-full"
                      options={options}
                      selectedId={sel !== null ? `opt-${sel}` : undefined}
                      onSelect={(id) => {
                        st().select(slotIdToIndex(id));
                        set({ viewMode: "focus" });
                      }}
                      envelopeSections={sections}
                      lot={lot}
                      context={context}
                      style={style}
                      sun={sunState}
                      sectionCutZ={cutZ}
                      cameraPreset={preset.p}
                      presetNonce={preset.n}
                      dark={dark}
                      onReady={() => setReady((r) => (r.grid ? r : { ...r, grid: true }))}
                      tileAriaLabel={(o) => {
                        const s = slots[slotIdToIndex(o.id)];
                        return s ? `${describe(s)} ${metricRow(s.option).map((m) => m.spoken).join(", ")}. Press Enter to focus.` : o.label;
                      }}
                      renderLabel={(o) => {
                        const s = slots[slotIdToIndex(o.id)];
                        return s ? <TileLabel slot={s} order={s.index} selected={sel === s.index} /> : null;
                      }}
                      renderOverlay={(o) => (sel !== null && o.id === `opt-${sel}` ? <StageFrame /> : null)}
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </LayoutGroup>
        )}
        {model && !(focus ? ready.scene : ready.grid) && (
          <p role="status" className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 text-center text-ink-3">
            Setting up the model…
          </p>
        )}
        {model && toolbar}
      </div>
    </section>
  );
}
