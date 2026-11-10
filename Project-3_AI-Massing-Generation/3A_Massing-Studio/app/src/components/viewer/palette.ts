// Viewer colors. Program colors are the dataviz-validated values from _manager/design-system.md.
import type { Program } from "@wxy/massing";

export const PROGRAM_COLOR: Record<"light" | "dark", Record<Program, string>> = {
  light: { residential: "#2a78d6", commercial: "#eb6834", community_facility: "#1baf7a" },
  dark: { residential: "#3987e5", commercial: "#d95926", community_facility: "#199e70" },
};

export const CHROME = {
  light: { paper: "#F6F5F1", graphite: "#22252A", graphite2: "#5C6068", rule: "#D5D3CC" },
  dark: { paper: "#16181B", graphite: "#E9E7E1", graphite2: "#A4A6AB", rule: "#34373C" },
} as const;

export const MODEL_MASS = "#f6f4ee";
export const CONTEXT_MASS = "#d0cec7";
// Night model
export const MODEL_MASS_DARK = "#d8d5cc";
export const CONTEXT_MASS_DARK = "#3a3d42";
