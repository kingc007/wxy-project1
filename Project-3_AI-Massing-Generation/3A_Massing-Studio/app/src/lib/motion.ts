// Shared motion constants ("Drafted, not printed", _Shared/Motion & Feel.md). Mirrors the CSS vars in globals.css.
import type { Transition, Variants } from "motion/react";

/** Enter: ease-out-quint. */
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
/** Exit: ease-in (exits are faster than enters). */
export const EASE_IN: [number, number, number, number] = [0.64, 0, 0.78, 0];

export const DUR_ENTER = 0.42;
export const DUR_EXIT = 0.22;
export const DUR_DRAW = 0.38;
/** Reduced motion collapses everything to a short cross-fade. */
export const DUR_REDUCED = 0.15;

/** Direct manipulation and panels. */
export const SPRING: Transition = { type: "spring", bounce: 0, duration: 0.4 };

/** Sibling stagger (seconds), max 8 items then the rest arrive together. */
export const STAGGER = 0.045;
export const STAGGER_MAX = 8;
/** Follow-through: label arrives this long after its line. */
export const FOLLOW = 0.08;

export const staggerDelay = (i: number, base = 0): number => base + Math.min(i, STAGGER_MAX) * STAGGER;

export const enterTransition: Transition = { duration: DUR_ENTER, ease: EASE_OUT };
export const exitTransition: Transition = { duration: DUR_EXIT, ease: EASE_IN };

/** Text: opacity + 6px y. */
export const textVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: enterTransition },
  exit: { opacity: 0, transition: exitTransition },
};

/** Surfaces next to moving things: opacity only. */
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR_ENTER, ease: EASE_OUT } },
  exit: { opacity: 0, transition: exitTransition },
};

/** Sheet uncovered left to right. */
export const wipeVariants: Variants = {
  hidden: { clipPath: "inset(0 100% 0 0)" },
  show: { clipPath: "inset(0 0% 0 0)", transition: { duration: 0.6, ease: EASE_OUT } },
};
