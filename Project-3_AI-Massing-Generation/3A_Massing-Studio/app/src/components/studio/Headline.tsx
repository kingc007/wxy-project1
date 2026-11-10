"use client";
import { motion, useReducedMotion } from "motion/react";
import { DUR_REDUCED, EASE_OUT } from "@/lib/motion";

/**
 * Display headline that rises from behind a baseline (clip mask). Re-runs when `text` changes.
 * Under reduced motion the text appears in place, with no rise.
 */
export function Headline({ text, className }: { text: string; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <span className="block overflow-hidden pb-[0.12em] -mb-[0.12em]">
      <motion.span
        key={text}
        className={className}
        style={{ display: "block" }}
        // One initial state for server and client (the server can't know the motion preference, so branching here
        // breaks hydration). Under reduced motion MotionConfig makes the y move instant.
        initial={{ y: "105%" }}
        animate={{ y: "0%" }}
        transition={reduced ? { duration: DUR_REDUCED } : { duration: 0.5, ease: EASE_OUT }}
      >
        {text}
      </motion.span>
    </span>
  );
}
