"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { IntendedUse } from "@/lib/zoning/model";

export const USE_OPTIONS: { value: IntendedUse; label: string }[] = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "community_facility", label: "Community facility" },
  { value: "mixed", label: "Mixed" },
];

export interface OptionsProps {
  intendedUse: IntendedUse;
  onIntendedUse: (u: IntendedUse) => void;
  programs: string[];
  onPrograms: (p: string[]) => void;
  /** show "Qualifying residential site" (R1-R5 only) */
  showResidentialSite: boolean;
}

export function Options({ intendedUse, onIntendedUse, programs, onPrograms, showResidentialSite }: OptionsProps) {
  const item = "h-10 px-2 sm:px-3 text-[0.875rem] border-0 !rounded-none bg-transparent text-ink-2 hover:bg-paper-2 data-[state=on]:bg-ink data-[state=on]:font-medium data-[state=on]:text-paper data-[state=on]:hover:bg-ink";
  const seg = "!rounded-md border border-rule-strong divide-x divide-rule overflow-x-auto max-w-full";
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span id="use-label" className="field-label">Intended use</span>
        <ToggleGroup
          type="single" variant="outline" spacing={0} value={intendedUse} aria-labelledby="use-label" className={seg}
          onValueChange={(v) => v && onIntendedUse(v as IntendedUse)}
        >
          {USE_OPTIONS.map((o) => <ToggleGroupItem key={o.value} value={o.value} className={item}>{o.label}</ToggleGroupItem>)}
        </ToggleGroup>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span id="program-label" className="field-label">Program</span>
        <ToggleGroup
          type="multiple" variant="outline" spacing={0} value={programs} aria-labelledby="program-label" className={seg}
          onValueChange={(v) => onPrograms(v)}
        >
          <ToggleGroupItem value="qualifying_affordable" className={item}>Qualifying affordable or senior housing</ToggleGroupItem>
          {showResidentialSite && <ToggleGroupItem value="qualifying_residential_site" className={item}>Qualifying residential site</ToggleGroupItem>}
        </ToggleGroup>
      </div>
    </div>
  );
}
