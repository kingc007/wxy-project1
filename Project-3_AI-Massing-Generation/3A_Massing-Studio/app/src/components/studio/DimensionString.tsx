"use client";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "cn";
import { DUR_DRAW, DUR_REDUCED, EASE_OUT, FOLLOW } from "@/lib/motion";

/**
 * Signature component: a hairline that is drawn left to right (scaleX 0 to 1), end ticks that pop in at ~60%,
 * then the value above and the label below. Renders fully drawn under reduced motion.
 * Accessible text is just "Label: value".
 */
export function DimensionString({
  label,
  value,
  delay = 0,
  className,
}: {
  label: string;
  value: string;
  /** Seconds before this string starts drawing (stagger). */
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const tickAt = delay + DUR_DRAW * 0.6;
  const line = reduced ? { duration: 0 } : { duration: DUR_DRAW, ease: EASE_OUT, delay };
  const tick = reduced ? { duration: 0 } : { duration: 0.12, ease: EASE_OUT, delay: tickAt };
  const text = reduced ? { duration: DUR_REDUCED } : { duration: 0.3, ease: EASE_OUT, delay: delay + DUR_DRAW * 0.6 + FOLLOW };
  const label2 = reduced ? { duration: DUR_REDUCED } : { duration: 0.3, ease: EASE_OUT, delay: delay + DUR_DRAW * 0.6 + FOLLOW * 2 };
  return (
    <div role="group" aria-label={`${label}: ${value}`} className={cn("flex min-w-0 flex-col", className)}>
      <motion.span
        aria-hidden
        className="hero-value truncate pb-1"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={text}
      >
        {value}
      </motion.span>
      <span aria-hidden className="relative block h-2">
        <motion.span
          className="absolute inset-x-0 top-1/2 block h-px origin-left bg-ink"
          initial={{ scaleX: reduced ? 1 : 0 }}
          animate={{ scaleX: 1 }}
          transition={line}
        />
        <motion.span
          className="absolute top-0 left-0 block h-2 w-px bg-ink"
          initial={{ opacity: reduced ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={tick}
        />
        <motion.span
          className="absolute top-0 right-0 block h-2 w-px bg-ink"
          initial={{ opacity: reduced ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={tick}
        />
      </span>
      <motion.span
        aria-hidden
        className="pt-1 text-xs text-ink-3"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={label2}
      >
        {label}
      </motion.span>
    </div>
  );
}
