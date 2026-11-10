"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { DUR, EASE_OUT, FADE_REDUCED } from "@/lib/motion";

/**
 * Heading whose text rises from behind its baseline under a clip-path mask. Remount it (change `key`) to replay,
 * for example when the site changes. Reduced motion: the text appears in place, with no rise.
 */
export function MaskedHeading({
  as: Tag = "h2", className, children, delay = 0,
}: { as?: "h1" | "h2" | "h3"; className?: string; children: ReactNode; delay?: number }) {
  const reduce = !!useReducedMotion();
  return (
    <Tag className={className}>
      {/* The mask extends a little below the box so descenders are not clipped once the text has arrived. */}
      <span className="block" style={{ clipPath: "inset(0 0 -0.2em 0)" }}>
        <motion.span
          className={cn("block")}
          // One initial state for server and client (the server can't know the motion preference, so branching here
          // breaks hydration). Under reduced motion MotionConfig makes the y move instant.
          initial={{ y: "115%" }}
          animate={{ y: "0%" }}
          transition={reduce ? FADE_REDUCED : { duration: DUR.mask, ease: EASE_OUT, delay }}
        >
          {children}
        </motion.span>
      </span>
    </Tag>
  );
}
