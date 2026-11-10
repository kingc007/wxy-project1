"use client";
import { Box, Footprints, Map as MapIcon, Move3d, Scissors, Shapes, Sun } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { CameraPreset, ViewerStyle } from "./types";

export interface ViewerToolbarProps {
  /** Currently highlighted preset, or null after the user orbits away. */
  preset: CameraPreset | null;
  onPreset: (p: CameraPreset) => void;
  /** null = no cut. */
  sectionCutZ: number | null;
  /** Highest elevation (ft) the slider can cut at. */
  sectionMaxZ: number;
  onSectionCutZ: (z: number | null) => void;
  sunEnabled: boolean;
  onSunEnabled: (on: boolean) => void;
  style: ViewerStyle;
  onStyle: (s: ViewerStyle) => void;
  className?: string;
}

// Labels approved by the manager ("Sun study" is from copy-deck-3A.md).
const PRESETS: { value: CameraPreset; label: string; tip: string; Icon: typeof Move3d }[] = [
  { value: "axon-ne", label: "Axon NE", tip: "3D view from the north-east (Home)", Icon: Move3d },
  { value: "axon-sw", label: "Axon SW", tip: "3D view from the south-west", Icon: Move3d },
  { value: "plan", label: "Plan", tip: "Top-down view, north up (P)", Icon: MapIcon },
  { value: "street", label: "Street", tip: "Eye-level view from the south side", Icon: Footprints },
];

function Tip({ text, children }: { text: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

const Sep = () => <span aria-hidden className="hidden h-6 w-px bg-rule-strong @[860px]:block" />;

export function ViewerToolbar(p: ViewerToolbarProps) {
  const cutOn = p.sectionCutZ != null;
  return (
    <TooltipProvider>
      {/* Every tool shows its own text label. Groups wrap onto a second row when the stage is narrow. */}
      <div className="@container flex w-full justify-center">
        <div
          role="toolbar"
          aria-label="Viewer controls"
          className={
            "pointer-events-auto material flex max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-1 px-3 py-1.5 text-ink max-sm:flex-nowrap max-sm:justify-start max-sm:overflow-x-auto " +
            (p.className ?? "")
          }
        >
          <div className="flex items-center gap-2">
            <ToggleGroup
              aria-label="Camera"
              size="sm"
              spacing={1}
              value={p.preset ? [p.preset] : []}
              onValueChange={(v) => {
                const next = v[0] as CameraPreset | undefined;
                if (next) p.onPreset(next);
                else if (p.preset) p.onPreset(p.preset); // re-click re-applies
              }}
            >
              {PRESETS.map(({ value, label, tip, Icon }) => (
                <Tip key={value} text={tip}>
                  <ToggleGroupItem value={value} aria-label={label}>
                    <Icon data-icon="inline-start" />
                    {label}
                  </ToggleGroupItem>
                </Tip>
              ))}
            </ToggleGroup>
          </div>

          <Sep />

          <div className="flex items-center gap-2">
            <ToggleGroup
              aria-label="Display style"
              size="sm"
              spacing={1}
              value={[p.style]}
              onValueChange={(v) => {
                if (v[0]) p.onStyle(v[0] as ViewerStyle);
              }}
            >
              <Tip text="White study model on paper">
                <ToggleGroupItem value="model" aria-label="Model">
                  <Box data-icon="inline-start" />
                  Model
                </ToggleGroupItem>
              </Tip>
              <Tip text="Flat program colors with hatches and labels">
                <ToggleGroupItem value="diagram" aria-label="Diagram">
                  <Shapes data-icon="inline-start" />
                  Diagram
                </ToggleGroupItem>
              </Tip>
            </ToggleGroup>
          </div>

          <Sep />

          <div role="group" aria-label="Section cut" className="flex shrink-0 items-center gap-2">
            <Tip text="Slice the model with a horizontal plane to see inside">
              <Toggle
                size="sm"
                aria-label="Section cut"
                pressed={cutOn}
                onPressedChange={(on) => p.onSectionCutZ(on ? Math.round(p.sectionMaxZ / 2) : null)}
              >
                <Scissors data-icon="inline-start" />
                Section cut
              </Toggle>
            </Tip>
            <span id="cut-height-label" className="whitespace-nowrap text-[13px] text-ink-3">Cut height</span>
            <div className="w-28 shrink-0">
            <Slider
              aria-labelledby="cut-height-label"
              min={0}
              max={Math.max(1, Math.round(p.sectionMaxZ))}
              step={1}
              disabled={!cutOn}
              value={[p.sectionCutZ ?? 0]}
              onValueChange={(v) => p.onSectionCutZ(Array.isArray(v) ? v[0] : v)}
            />
            </div>
            <output className="num w-14 text-sm text-ink-2" aria-label="Cut height value">
              {cutOn ? `${Math.round(p.sectionCutZ ?? 0)} ft` : "Off"}
            </output>
          </div>

          <Sep />

          <Tip text="Show sun and cast shadows, with a time-of-day scrubber. Study-grade approximation. Shortcut: S">
            <Toggle size="sm" aria-label="Sun study" pressed={p.sunEnabled} onPressedChange={p.onSunEnabled}>
              <Sun data-icon="inline-start" />
              Sun study
            </Toggle>
          </Tip>
        </div>
      </div>
    </TooltipProvider>
  );
}
