import type { PValue } from "@/lib/types";
import type { Controls } from "@/lib/zoning/model";

/** Stable anchor id for a bulk row (used by the Key controls strip). */
export function rowId(label: string): string {
  return `bulk-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

/**
 * The portion's own value for a merged bulk row, found by the row's label. Only the rows that exist per portion in
 * Controls are covered (FAR, floor area, coverage, heights, yards); others return undefined and render as a dash.
 */
export function portionValue(c: Controls, label: string): PValue | undefined {
  const key = (re: RegExp) => re.exec(label)?.[1]?.replace(/ /g, "_");
  const far = key(/^Max FAR \((.+)\)$/);
  if (far) return c.maxFar[far];
  const fa = key(/^Max floor area \((.+)\)$/);
  if (fa) return c.maxFloorArea[fa];
  switch (label) {
    case "Lot coverage (max)": return c.lotCoverage.max;
    case "Base height (min)": return c.baseHeight.min;
    case "Base height (max)": return c.baseHeight.max;
    case "Max building height": return c.maxBuildingHeight;
    case "Front yard": return c.yards.front;
    case "Rear yard": return c.yards.rear;
    case "Side yard": return c.yards.side;
    case "Max stories": return c.maxStories;
    default: return undefined;
  }
}

export function portionHeader(codes: string[], share: number | null): string {
  return `${codes.join(", ")}${share === null ? "" : ` · ${Math.round(share * 100)}%`}`;
}
