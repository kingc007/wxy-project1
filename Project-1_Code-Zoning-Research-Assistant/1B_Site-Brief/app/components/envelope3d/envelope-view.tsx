"use client";

import { useMemo, useState } from "react";
import type { EnvelopeLike } from "@/lib/geometry/envelope-input";
import { buildEnvelopeSolids } from "@/lib/geometry/envelope-solids";
import { polygonArea } from "@/lib/geometry/polygon";
import { usePrefersReducedMotion, useThemeColors } from "@/components/map/use-theme-colors";
import { EnvelopeScene } from "./scene";

export interface EnvelopeViewProps {
  envelope: EnvelopeLike;
  className?: string;
}

const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString("en-US");

export function EnvelopeView({ envelope, className }: EnvelopeViewProps) {
  const colors = useThemeColors();
  const reduced = usePrefersReducedMotion();
  const solids = useMemo(() => buildEnvelopeSolids(envelope), [envelope]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const toggle = (id: string) => setSelected((s) => (s === id ? null : id));
  const drawn = solids.stages.length > 0;
  const label = drawn
    ? `3D buildable envelope preview, ${solids.stages.length} volume${solids.stages.length > 1 ? "s" : ""} up to ${fmt(solids.topHeight ?? 0)} feet. Drag to orbit. A table of the dimensions drawn follows.`
    : "3D buildable envelope preview with no volumes drawn.";

  return (
    <div className={`flex flex-col bg-paper-2 text-ink ${className ?? ""}`}>
      <div className="relative h-[clamp(16rem,48vh,30rem)] shrink-0">
        {drawn ? (
          <EnvelopeScene
            solids={solids} colors={colors} reducedMotion={reduced}
            hovered={hovered} selected={selected} onHover={setHovered} onSelect={toggle} label={label}
          />
        ) : (
          <div className="grid h-full place-items-center p-6 text-center text-[0.875rem] text-ink-3">
            {solids.manualGeometry ?? solids.emptyMessage}
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-rule bg-paper px-3 py-2 text-[0.8125rem]">
        {solids.notDrawn.length > 0 && (
          <p>
            <span className="font-medium">Not drawn (Needs input):</span>{" "}
            <span className="text-ink-2">{solids.notDrawn.join(", ")}</span>
          </p>
        )}
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-3">
          <Key kind="vol" /> Envelope volume (wireframe)
          {solids.skyPlanes.length > 0 && (<><Key kind="sky" /> Sky exposure plane, SIMPLIFIED</>)}
          <span>Selected or hovered: blue.</span>
          <span>Units: ft. Drag to orbit, scroll to zoom, arrow keys pan.</span>
        </p>
        <details className="group">
          <summary className="min-h-6 cursor-pointer text-ink">Dimensions drawn (text alternative)</summary>
          <div className="mt-1 max-h-56 overflow-auto">
            <table className="w-full border-collapse text-left text-[0.8125rem]">
              <caption className="sr-only">Heights, footprints and setbacks drawn in the 3D envelope preview, in feet</caption>
              <thead>
                <tr className="border-b border-rule-strong text-ink-3">
                  <th scope="col" className="py-1 pr-2 font-medium">Element</th>
                  <th scope="col" className="py-1 pr-2 text-right font-medium">Height range (ft)</th>
                  <th scope="col" className="py-1 pr-2 text-right font-medium">Footprint (sf)</th>
                  <th scope="col" className="py-1 font-medium">Shaped by</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-rule align-top">
                  <th scope="row" className="py-1 pr-2 font-normal">Lot polygon</th>
                  <td className="py-1 pr-2 text-right font-mono tabular">0</td>
                  <td className="py-1 pr-2 text-right font-mono tabular">{fmt(polygonArea(solids.lot))}</td>
                  <td className="py-1 text-ink-2">{solids.lot.length} vertices</td>
                </tr>
                {solids.stages.map((s) => (
                  <tr key={s.id} className="border-b border-rule align-top"
                    onMouseEnter={() => setHovered(s.id)} onMouseLeave={() => setHovered(null)}>
                    <th scope="row" className="py-1 pr-2 font-normal">
                      <button type="button" aria-pressed={selected === s.id} onClick={() => toggle(s.id)}
                        onFocus={() => setHovered(s.id)} onBlur={() => setHovered(null)}
                        className="min-h-6 text-left underline decoration-rule-strong underline-offset-2 hover:decoration-signal aria-pressed:text-signal">
                        {s.label}
                      </button>
                    </th>
                    <td className="py-1 pr-2 text-right font-mono tabular">{fmt(s.z0)} to {fmt(s.z1)}</td>
                    <td className="py-1 pr-2 text-right font-mono tabular">{fmt(polygonArea(s.footprint))}</td>
                    <td className="py-1 text-ink-2">{s.shapedBy.length ? s.shapedBy.join("; ") : "Lot outline"}</td>
                  </tr>
                ))}
                {solids.skyPlanes.map((s) => (
                  <tr key={s.id} className="border-b border-rule align-top">
                    <th scope="row" className="py-1 pr-2 font-normal">{s.label} (SIMPLIFIED)</th>
                    <td className="py-1 pr-2 text-right font-mono tabular">{fmt(s.corners[0][2])} to {fmt(s.corners[2][2])}</td>
                    <td className="py-1 pr-2 text-right font-mono">n/a</td>
                    <td className="py-1 text-ink-2">Starts {fmt(s.startHeight)} ft up, {fmt(s.initialSetback)} ft in, rises {fmt(s.slope)} ft per ft</td>
                  </tr>
                ))}
                {solids.reference.map((r) => (
                  <tr key={r.label} className="border-b border-rule align-top">
                    <th scope="row" className="py-1 pr-2 font-normal">{r.label}</th>
                    <td className="py-1 pr-2 text-right font-mono tabular" colSpan={3}>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </div>
  );
}

function Key({ kind }: { kind: "vol" | "sky" }) {
  return (
    <svg width="22" height="10" aria-hidden="true" className="inline-block">
      <rect x="1" y="1" width="20" height="8" fill="currentColor" fillOpacity={kind === "vol" ? 0.1 : 0.2}
        stroke="currentColor" strokeWidth="1" strokeDasharray={kind === "sky" ? "3 2" : undefined} />
    </svg>
  );
}
