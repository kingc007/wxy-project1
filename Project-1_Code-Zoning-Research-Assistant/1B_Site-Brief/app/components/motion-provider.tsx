"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";

/** Root motion config: transform and layout animations are disabled for users who prefer reduced motion. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
