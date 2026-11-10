"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";
import { CLIP, DUR, EASE_OUT, FADE_REDUCED } from "@/lib/motion";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Ring } from "@/lib/types";
import type { EnvelopeLike } from "@/lib/geometry/envelope-input";
import type { MapDistrict } from "@/components/map/site-map";

type View = "plan" | "3d";

// MapLibre and three.js are heavy and need the browser: load them only when their view is shown.
const Loading = () => <div className="grid h-full place-items-center text-[0.875rem] text-ink-3">Loading view…</div>;
const SiteMap = dynamic(() => import("@/components/map/site-map").then((m) => m.SiteMap), { ssr: false, loading: Loading });
const EnvelopeView = dynamic(() => import("@/components/envelope3d/envelope-view").then((m) => m.EnvelopeView), { ssr: false, loading: Loading });

export interface MapPanelProps {
  lot4326?: Ring | null;
  neighbors4326?: Ring[];
  districts?: MapDistrict[];
  center?: [number, number];
  bbl?: string | null;
  /** ZoningEnvelope (or any object with the fields the 3D view reads); null until calculated */
  envelope?: EnvelopeLike | null;
  /** controlled view; defaults to internal state */
  defaultView?: View;
}

const EMPTY_DISTRICTS: MapDistrict[] = [];
const EMPTY_RINGS: Ring[] = [];

export function MapPanel({
  lot4326 = null, neighbors4326 = EMPTY_RINGS, districts = EMPTY_DISTRICTS, center, bbl, envelope = null, defaultView = "plan",
}: MapPanelProps) {
  const [view, setView] = useState<View>(defaultView);
  const reduce = !!useReducedMotion();
  const hasLot = !!lot4326 && lot4326.length >= 3;
  const showMap = hasLot || !!center;
  // The wipe has finished for this lot: the placeholder underneath can go. Keyed by lot so a new search replays it.
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const mapKey = bbl ?? "lot";
  const revealed = revealedFor === mapKey;
  return (
    <section aria-label="Site view" className="flex h-full min-h-[18rem] flex-col">
      <div className="flex items-center justify-between border-b border-rule px-0 py-2">
        <h2 className="field-label">Site view</h2>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          className="!rounded-md border border-rule-strong divide-x divide-rule overflow-hidden"
          value={view}
          onValueChange={(v) => v && setView(v as View)}
          aria-label="Site view mode"
        >
          <ToggleGroupItem value="plan" className="h-10 border-0 !rounded-none bg-transparent px-3 text-ink-2 hover:bg-paper-2 data-[state=on]:bg-ink data-[state=on]:text-paper">Plan</ToggleGroupItem>
          <ToggleGroupItem value="3d" className="h-10 border-0 !rounded-none bg-transparent px-3 text-ink-2 hover:bg-paper-2 data-[state=on]:bg-ink data-[state=on]:text-paper">3D</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="relative min-h-0 flex-1 bg-paper-2 border-b border-rule">
        {view === "plan" ? (
          <>
            {(!showMap || !revealed) && (
              <div aria-hidden={showMap || undefined} className="absolute inset-0"><Empty>Map appears when a lot is found.</Empty></div>
            )}
            {showMap && (
              // Uncovered left to right like a sheet being lifted. Reduced motion: a short cross-fade.
              <motion.div
                key={mapKey}
                className="absolute inset-0"
                initial={revealed ? false : reduce ? { opacity: 0 } : { clipPath: CLIP.wipeHidden }}
                animate={{ opacity: 1, clipPath: CLIP.wipeShown }}
                transition={reduce ? FADE_REDUCED : { duration: DUR.wipe, ease: EASE_OUT }}
                onAnimationComplete={() => setRevealedFor(mapKey)}
              >
                <SiteMap lot4326={lot4326} neighbors4326={neighbors4326} districts={districts} center={center} bbl={bbl} arrive={!revealed} />
              </motion.div>
            )}
          </>
        ) : envelope ? (
          <EnvelopeView envelope={envelope} />
        ) : (
          <Empty>{hasLot ? "The envelope appears once the rules are calculated." : "Map appears when a lot is found."}</Empty>
        )}
      </div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full min-h-[14rem] place-items-center p-6 text-center text-[0.875rem] text-ink-3">{children}</div>;
}
