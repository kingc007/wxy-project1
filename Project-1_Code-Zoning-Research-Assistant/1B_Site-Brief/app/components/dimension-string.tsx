"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { DUR, EASE_OUT, FOLLOW_THROUGH_S } from "@/lib/motion";

export interface DimensionStringProps {
  label: string;
  /** Plain text of the value; used for the accessible name "Label: value". */
  value: string;
  /** Seconds before this string starts drawing (stagger: staggerDelay(index)). */
  delay?: number;
  /** When set the value is a link (e.g. to the table row it came from). */
  href?: string;
  /** Value is not a number (e.g. "Needs input"): smaller type, dashed line. */
  muted?: boolean;
  /** Anything that belongs under the label, such as a confidence mark. */
  children?: ReactNode;
  className?: string;
}

/**
 * Signature component: a drafted dimension. The hairline is pulled from the left, the end ticks appear at about 60%
 * of the stroke, then the value fades in above and the label below. Mount it when the data arrives; it never uses a
 * timer. Fully drawn (no animation) under prefers-reduced-motion.
 */
export function DimensionString({ label, value, delay = 0, href, muted = false, children, className }: DimensionStringProps) {
  const reduce = !!useReducedMotion();
  const tickAt = delay + DUR.draw * 0.6;
  const valueAt = tickAt;
  const labelAt = valueAt + FOLLOW_THROUGH_S;
  const text = `${label}: ${value}`;

  const lineProps = reduce
    ? {}
    : { initial: { scaleX: 0 }, animate: { scaleX: 1 }, transition: { duration: DUR.draw, ease: EASE_OUT, delay } };
  const tickProps = (d: number) =>
    reduce ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.12, delay: d } };
  const valueProps = reduce
    ? {}
    : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: DUR.enter, ease: EASE_OUT, delay: valueAt } };
  const labelProps = reduce
    ? {}
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: DUR.enter, ease: EASE_OUT, delay: labelAt } };

  const valueClass = muted ? "text-[1.125rem] font-semibold text-ink-2" : "hero-num text-ink";

  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <motion.div className="flex min-h-9 items-end pb-1.5" {...valueProps}>
        {href ? (
          <a href={href} aria-label={text} className={cn(valueClass, "rounded-md hover:underline")}>{value}</a>
        ) : (
          <>
            <span className="sr-only">{text}</span>
            <span aria-hidden="true" className={valueClass}>{value}</span>
          </>
        )}
      </motion.div>
      <div aria-hidden="true" className="relative h-2 w-full">
        <motion.span
          className={cn("absolute inset-x-0 top-1/2 block h-px origin-left", muted ? "dim-dashed" : "bg-ink-2")}
          {...lineProps}
        />
        <motion.span className="absolute left-0 top-0 block h-2 w-px bg-ink-2" {...tickProps(tickAt)} />
        <motion.span className="absolute right-0 top-0 block h-2 w-px bg-ink-2" {...tickProps(tickAt)} />
      </div>
      <motion.p aria-hidden="true" className="mt-1.5 text-[0.875rem] font-medium text-ink-2" {...labelProps}>{label}</motion.p>
      {children && <motion.div className="mt-1.5" {...labelProps}>{children}</motion.div>}
    </div>
  );
}
