// Motion tokens for "Drafted, not printed" (see _Shared/Motion & Feel.md). Mirrors the CSS vars in app/globals.css.
// Only transform, opacity and clip-path are animated. Reduced motion collapses everything to a short cross-fade.
import type { Transition, Variants } from "motion/react";

/** ease-out-quint: enters. */
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
/** ease-in-quint: exits (exits are faster than enters). */
export const EASE_IN: [number, number, number, number] = [0.64, 0, 0.78, 0];

export const DUR = { enter: 0.42, exit: 0.22, draw: 0.38, press: 0.1, wipe: 0.7, mask: 0.6, reduced: 0.15 } as const;

/** Direct manipulation, panels and shared-element morphs. */
export const SPRING: Transition = { type: "spring", bounce: 0, duration: 0.4 };

/** Siblings stagger 45ms, at most 8 items; the rest arrive together with the 8th. */
export const STAGGER_S = 0.045;
export const STAGGER_MAX_ITEMS = 8;
export const staggerDelay = (index: number, base = 0): number => base + Math.min(index, STAGGER_MAX_ITEMS - 1) * STAGGER_S;

/** Within one item the label follows the line by 80ms (follow-through). */
export const FOLLOW_THROUGH_S = 0.08;

export const ENTER: Transition = { duration: DUR.enter, ease: EASE_OUT };
export const EXIT: Transition = { duration: DUR.exit, ease: EASE_IN };
export const FADE_REDUCED: Transition = { duration: DUR.reduced, ease: "linear" };

/** Text change: opacity plus 6px of travel. */
export const textVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  shown: { opacity: 1, y: 0, transition: ENTER },
  exit: { opacity: 0, y: -4, transition: EXIT },
};

/** Opacity only, for surfaces that sit next to something that moves. */
export const surfaceVariants: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: ENTER },
  exit: { opacity: 0, transition: EXIT },
};

/** Clip-path masks. Text rises from behind its baseline; panels are uncovered left to right like a sheet. */
export const CLIP = {
  textHidden: "inset(0 0 100% 0)",
  textShown: "inset(0 0 -20% 0)",
  wipeHidden: "inset(0 100% 0 0)",
  wipeShown: "inset(0 0% 0 0)",
} as const;

/** Parallax ratio for the plan-grid backdrop relative to the scroll distance of the content. */
export const PARALLAX = 0.4;
/** The plan grid is periodic at its 64px major spacing, so the offset can wrap and stay a small transform. */
export const GRID_PERIOD_PX = 64;

/** Map arrival: flyTo options (MapLibre FlyToOptions). */
export const MAP_FLY = { duration: 1900, curve: 1.5 } as const;
/** Wide starting view for the arrival: roughly the five-borough extent (lon, lat, zoom). */
export const NYC_WIDE = { center: [-73.94, 40.7] as [number, number], zoom: 9.6 };
