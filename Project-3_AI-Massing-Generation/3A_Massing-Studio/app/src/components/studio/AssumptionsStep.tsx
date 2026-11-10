"use client";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Assumptions } from "@wxy/massing";
import type { AssumptionKey } from "@/lib/store/logic";
import { useStudio } from "@/lib/store/studio";
import { SourceTag } from "./tags";

interface Row {
  key: AssumptionKey;
  label: string;
  unit: string;
  get: (a: Assumptions) => Assumptions["groundFloorHeight"];
  /** Display <-> stored value (efficiency is stored 0-1, shown as percent). */
  scale: number;
  max: number;
}

export const ASSUMPTION_ROWS: Row[] = [
  { key: "floorToFloor.residential", label: "Floor-to-floor, residential", unit: "ft", get: (a) => a.floorToFloor.residential, scale: 1, max: 40 },
  { key: "floorToFloor.commercial", label: "Floor-to-floor, commercial", unit: "ft", get: (a) => a.floorToFloor.commercial, scale: 1, max: 40 },
  { key: "floorToFloor.community_facility", label: "Floor-to-floor, community facility", unit: "ft", get: (a) => a.floorToFloor.community_facility, scale: 1, max: 40 },
  { key: "groundFloorHeight", label: "Ground floor height", unit: "ft", get: (a) => a.groundFloorHeight, scale: 1, max: 60 },
  { key: "avgUnitNetSf", label: "Average unit size (net)", unit: "sf", get: (a) => a.avgUnitNetSf, scale: 1, max: 3000 },
  { key: "efficiency", label: "Efficiency (net ÷ gross)", unit: "%", get: (a) => a.efficiency, scale: 100, max: 100 },
];

export function AssumptionRow({ row }: { row: Row }) {
  const a = useStudio((s) => s.assumptions);
  const edit = useStudio((s) => s.editAssumption);
  const [draft, setDraft] = useState<string | null>(null);
  const v = row.get(a);
  const shown = Number((v.value * row.scale).toFixed(2));
  const parsed = draft === null ? null : Number(draft);
  const invalid = draft !== null && !(Number.isFinite(parsed) && (parsed as number) > 0 && (parsed as number) <= row.max);
  const save = () => {
    if (draft === null || invalid) return;
    edit(row.key, (parsed as number) / row.scale);
    setDraft(null);
  };
  return (
    <TableRow>
      <TableCell className="align-top whitespace-normal">
        <div>{row.label}</div>
        {v.source !== "default" && <SourceTag source={v.source} />}
      </TableCell>
      <TableCell className="num text-right align-top">
        {draft === null ? (
          <>{shown} {row.unit}</>
        ) : (
          <Input
            aria-label={row.label}
            aria-invalid={invalid}
            inputMode="decimal"
            autoFocus
            className="h-9 w-20 text-right"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setDraft(null);
            }}
          />
        )}
      </TableCell>
      <TableCell className="align-top">
        {draft === null ? (
          <Button size="xs" variant="outline" aria-label={`Edit ${row.label}`} onClick={() => setDraft(String(shown))}>
            <Pencil data-icon="inline-start" />Edit
          </Button>
        ) : (
          <Button size="xs" onClick={save} disabled={invalid}>Save</Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export function AssumptionsStep() {
  return (
    <>
      <p className="max-w-[60ch] text-ink-3">Values we had to assume. Edit any of them; metrics update.</p>
      <p className="font-medium">Defaults, editable for your project</p>
      <Table className="text-sm">
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="h-8 px-1">Assumption</TableHead>
            <TableHead scope="col" className="h-8 px-1 text-right">Value</TableHead>
            <TableHead scope="col" className="h-8 px-1"><span className="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ASSUMPTION_ROWS.map((r) => (
            <AssumptionRow key={r.key} row={r} />
          ))}
        </TableBody>
      </Table>
    </>
  );
}
