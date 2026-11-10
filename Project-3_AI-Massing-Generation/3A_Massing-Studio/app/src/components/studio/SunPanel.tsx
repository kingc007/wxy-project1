"use client";
import { useEffect, useMemo, useState } from "react";
import { Sun } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SUN_PRESETS } from "@wxy/massing";
import { lotLatLng } from "@/lib/studio/actions";
import { dateLabel, fmtHours, minutesLabel } from "@/lib/studio/format";
import { courtyardSunHours, daylightRange, presetById, type SunStudyResult } from "@/lib/studio/sun-study";
import { useStudio, type SunPresetId } from "@/lib/store/studio";

/** Sun scrubber + the courtyard-hours metric. Computed in 8 ms slices, so the UI never blocks. */
export function SunPanel() {
  const sun = useStudio((s) => s.sun);
  const set = useStudio((s) => s.set);
  const model = useStudio((s) => s.model);
  const context = useStudio((s) => s.context);
  const slot = useStudio((s) => s.slots[s.selectedIndex ?? s.slots.findIndex(Boolean)] ?? null);
  const site = useStudio((s) => s.site);
  const preset = presetById(sun.preset);
  const { lat, lng, reference } = useMemo(() => lotLatLng(), [site]); // eslint-disable-line react-hooks/exhaustive-deps
  const [lo, hi] = useMemo(() => daylightRange(preset, lat, lng), [preset, lat, lng]);
  const minutes = Math.min(hi, Math.max(lo, sun.minutes));
  const [result, setResult] = useState<{ key: string; r: SunStudyResult | null } | null>(null);
  const option = slot?.option ?? null;
  const key = option ? `${option.id}|${preset.id}|${context.length}|${lat}` : "";

  useEffect(() => {
    if (!option || !model) return;
    let cancelled = false;
    const run = () => {
      void courtyardSunHours({ option, model, context, preset, lat, lng }, () => cancelled).then((r) => {
        if (!cancelled && r) setResult({ key, r });
      });
    };
    const h = window.setTimeout(run, 30);
    return () => {
      cancelled = true;
      window.clearTimeout(h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const res = result && result.key === key ? result.r : null;
  const date = dateLabel(preset.month, preset.day);
  return (
    <section aria-label="Sun study" className="pointer-events-auto material flex w-full max-w-4xl flex-col gap-1 rounded-sm px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="panel-title flex items-center gap-1.5"><Sun className="size-4" aria-hidden />Sun study</span>
        <ToggleGroup
          aria-label="Date"
          size="sm"
          spacing={1}
          variant="outline"
          value={[sun.preset]}
          onValueChange={(v) => v[0] && set({ sun: { ...sun, preset: v[0] as SunPresetId } })}
        >
          {SUN_PRESETS.map((p) => (
            <ToggleGroupItem key={p.id} value={p.id} aria-label={p.label} title={p.label}>{dateLabel(p.month, p.day)}</ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex min-w-40 flex-1 items-center gap-2">
          <Slider aria-label="Time of day" min={lo} max={hi} step={15} value={[minutes]} onValueChange={(v) => set({ sun: { ...sun, minutes: Array.isArray(v) ? v[0] : v } })} />
          <span className="num w-20 shrink-0 text-right text-xs whitespace-nowrap">{minutesLabel(minutes)}</span>
        </div>
        <p aria-live="polite" className="num text-[13px]">
          {!option ? "Generate options to measure courtyard sun." : res === null ? "Measuring courtyard sun…" : res.hours === null ? "No courtyard or open space at grade." : `Courtyard sun: ${fmtHours(res.hours)} h on ${date}`}
        </p>
      </div>
      <p className="text-xs text-ink-3">{preset.label}. Study-grade shadow approximation, not a certified daylight analysis.{reference ? " Location is the Fort Greene sample point (SIMPLIFIED)." : ""}</p>
    </section>
  );
}
