"use client";
import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { fmtInt } from "@wxy/massing";
import { loadSample } from "@/lib/studio/actions";
import { SAMPLE_SITES, summarizeRawEnvelope, type SampleSite } from "@/lib/studio/samples";
import { DUR_REDUCED, EASE_OUT, FOLLOW, staggerDelay } from "@/lib/motion";
import { useStudio } from "@/lib/store/studio";
import { HANDOFF_GUIDANCE } from "@/lib/studio/handoff";
import { Headline } from "./Headline";
import { SampleTag } from "./tags";

const VB_W = 240;
const VB_H = 180;
const PAD = 18;

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});

function lotPoints(envelope: unknown): [number, number][] {
  const raw = obj(obj(envelope).lot).polygonLocal;
  return (Array.isArray(raw) ? raw : []).filter(
    (p): p is [number, number] => Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number",
  );
}

function extent(pts: [number, number][]) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] as const;
}

/** Viewbox units per foot that fits the largest sample lot, so every footprint is drawn at one shared scale. */
const SHARED_SCALE = Math.min(
  ...SAMPLE_SITES.map((s) => {
    const pts = lotPoints(s.envelope);
    if (pts.length < 3) return Infinity;
    const [x0, x1, y0, y1] = extent(pts);
    return Math.min((VB_W - 2 * PAD) / Math.max(1e-6, x1 - x0), (VB_H - 2 * PAD) / Math.max(1e-6, y1 - y0));
  }),
);

/** Lot outline from the raw envelope (`lot.polygonLocal`, [x, y] feet), centred in the viewBox with y flipped. */
export function lotPath(envelope: unknown, k = SHARED_SCALE): string {
  const pts = lotPoints(envelope);
  if (pts.length < 3 || !Number.isFinite(k)) return "";
  const [x0, x1, y0, y1] = extent(pts);
  const ox = (VB_W - k * (x1 - x0)) / 2;
  const oy = (VB_H - k * (y1 - y0)) / 2;
  const f = (n: number) => n.toFixed(2);
  return pts.map((p, i) => `${i ? "L" : "M"}${f(ox + k * (p[0] - x0))} ${f(oy + k * (y1 - p[1]))}`).join(" ") + " Z";
}

function SiteCard({ site, order }: { site: SampleSite; order: number }) {
  const reduced = useReducedMotion();
  const sum = useMemo(() => summarizeRawEnvelope(site.envelope), [site.envelope]);
  const d = useMemo(() => lotPath(site.envelope), [site.envelope]);
  const delay = staggerDelay(order, 0.15);
  return (
    <li className="min-w-0">
      <button
        type="button"
        aria-label={`Load ${site.name}, sample site, ${sum.district}, ${sum.areaSf ? fmtInt(sum.areaSf) : "unknown"} square feet`}
        onClick={() => void loadSample(site.id)}
        className="group/site flex w-full flex-col gap-3 text-left outline-none transition-transform duration-100 active:scale-[.98] focus-visible:ring-2 focus-visible:ring-ring"
      >
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="aspect-[4/3] w-full text-ink" aria-hidden>
          <motion.path
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.25}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            // Same initial on server and client (no motion-preference branch) so hydration matches; reduced motion
            // shortens the draw to the 150 ms cross-fade duration instead.
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={reduced ? { duration: DUR_REDUCED } : { duration: 0.9, ease: EASE_OUT, delay }}
          />
        </svg>
        <motion.span
          className="flex flex-col gap-0.5 border-t border-rule pt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reduced ? { duration: DUR_REDUCED } : { duration: 0.35, ease: EASE_OUT, delay: delay + 0.9 * 0.6 + FOLLOW }}
        >
          <span className="display-sm text-ink">{site.name}</span>
          <span className="num text-sm text-ink-3">{sum.district} district, {sum.areaSf ? fmtInt(sum.areaSf) : "?"} sf lot</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1"><SampleTag /><span className="text-sm font-semibold text-signal underline underline-offset-4">Use this site</span></span>
        </motion.span>
      </button>
    </li>
  );
}

/** First screen: the sample lots as large hairline plan footprints that draw on. Click loads the site. */
export function SiteChooser() {
  const handoffFailed = useStudio((s) => s.handoff === "failed");
  return (
    <div className="flex size-full flex-col gap-8 overflow-y-auto [&>:first-child]:mt-auto [&>:last-child]:mb-auto px-8 py-8 lg:px-14">
      <div className="flex max-w-2xl flex-col gap-2">
        <h2 className="display">
          <Headline text="Start with a site" />
        </h2>
        {handoffFailed && <p className="text-fail">{HANDOFF_GUIDANCE}</p>}
        <p className="text-ink-3">Choose a sample lot, or load your own zoning envelope from the Site step. Plans are drawn to one scale.</p>
      </div>
      <ul className="grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-3" aria-label="Sample lots">
        {SAMPLE_SITES.map((s, i) => (
          <SiteCard key={s.id} site={s} order={i} />
        ))}
      </ul>
    </div>
  );
}
