"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Sets data-theme on <html> and persists it. Icon swap is done in CSS so no state or flash. */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const explicit = root.getAttribute("data-theme");
    const isDark = explicit ? explicit === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = isDark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage unavailable: theme still applies for this session */
    }
  }

  return (
    <Button type="button" variant="outline" size="icon" onClick={toggle} aria-label="Switch between paper and blueprint theme" className="size-10 md:size-8">
      <Moon className="theme-icon-moon size-4" aria-hidden="true" />
      <Sun className="theme-icon-sun size-4" aria-hidden="true" />
    </Button>
  );
}
