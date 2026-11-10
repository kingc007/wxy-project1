import type { ReviewFlag } from "@/lib/types";
import type { BulkRow, ZoningBrief } from "@/lib/zoning/model";

export interface CrosscheckEvent {
  error?: string;
  flags?: ReviewFlag[];
  /** engine field names such as "maxFar.residential", "yards.rear" */
  conflictingFields?: string[];
}

/** Bulk-table row label for a cross-check field name (labels come from lib/zoning/controls.ts bulkTable). */
export function rowLabelForField(field: string): string | null {
  if (field.startsWith("maxFar.")) return `Max FAR (${field.slice(7).replace(/_/g, " ")})`;
  switch (field) {
    case "baseHeight.min": return "Base height (min)";
    case "baseHeight.max": return "Base height (max)";
    case "maxBuildingHeight": return "Max building height";
    case "yards.front": return "Front yard";
    case "yards.rear": return "Rear yard";
    case "yards.side": return "Side yard";
    case "lotCoverage.max": return "Lot coverage (max)";
    default: return null;
  }
}

/** Returns the brief with disagreeing rows marked "conflicting" and the cross-check flags appended. Values are never changed. */
export function applyCrosscheck(brief: ZoningBrief, x: CrosscheckEvent | null): ZoningBrief {
  if (!x || x.error) return brief;
  const labels = new Set((x.conflictingFields ?? []).map(rowLabelForField).filter((l): l is string => !!l));
  const rows: BulkRow[] = labels.size
    ? brief.bulkTable.map((r) => (labels.has(r.label) && r.value.value !== null ? { ...r, value: { ...r.value, confidence: "conflicting" as const } } : r))
    : brief.bulkTable;
  return { ...brief, bulkTable: rows, flags: [...brief.flags, ...(x.flags ?? []).filter((f) => f.kind === "data_conflict" || x.conflictingFields?.length)] };
}
