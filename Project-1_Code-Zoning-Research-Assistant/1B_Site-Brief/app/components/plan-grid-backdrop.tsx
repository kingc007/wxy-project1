"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { GRID_PERIOD_PX, PARALLAX } from "@/lib/motion";

/**
 * The plan grid, fixed behind the page. As the page scrolls it drifts at 0.4x the content's speed. The grid is
 * periodic at 64px (8px minor, 64px major), so the offset wraps and the layer stays a plain translateY.
 * The scroll container is the document (the memo scrolls the page; the map pane is sticky). Off under reduced motion.
 */
export function PlanGridBackdrop() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, (v) => -((v * PARALLAX) % GRID_PERIOD_PX));
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        className="plan-grid absolute inset-x-0 top-0"
        style={{ height: `calc(100% + ${GRID_PERIOD_PX}px)`, y: reduce ? 0 : y }}
      />
    </div>
  );
}
