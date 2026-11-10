"use client";

import { useSyncExternalStore } from "react";

export interface ThemeColors {
  paper: string;
  paper2: string;
  ink: string;
  ink2: string;
  ink3: string;
  rule: string;
  ruleStrong: string;
  signal: string;
}

const FALLBACK: ThemeColors = {
  paper: "#f5f3ee", paper2: "#ece9e2", ink: "#1e2124", ink2: "#4a4f55", ink3: "#62676d",
  rule: "#cfcbc2", ruleStrong: "#8e8a82", signal: "#1f4e9e",
};

export function readThemeColors(): ThemeColors {
  if (typeof document === "undefined") return FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  const g = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
  return {
    paper: g("--paper", FALLBACK.paper), paper2: g("--paper-2", FALLBACK.paper2),
    ink: g("--ink", FALLBACK.ink), ink2: g("--ink-2", FALLBACK.ink2), ink3: g("--ink-3", FALLBACK.ink3),
    rule: g("--rule", FALLBACK.rule), ruleStrong: g("--rule-strong", FALLBACK.ruleStrong),
    signal: g("--signal", FALLBACK.signal),
  };
}

/** Subscribe to theme changes: data-theme attribute on <html> and the OS colour-scheme media query. */
export function subscribeTheme(cb: () => void): () => void {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => {
    mo.disconnect();
    mq.removeEventListener("change", cb);
  };
}

let cached: ThemeColors | null = null;
let cachedKey = "";
function snapshot(): ThemeColors {
  const next = readThemeColors();
  const key = Object.values(next).join("|");
  if (key !== cachedKey || !cached) {
    cachedKey = key;
    cached = next;
  }
  return cached;
}

/** Live theme colours from the CSS custom properties; re-renders on theme change. */
export function useThemeColors(): ThemeColors {
  return useSyncExternalStore(subscribeTheme, snapshot, () => FALLBACK);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}
