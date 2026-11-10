"use client";
import { useState } from "react";
import { Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtInt, type Program, type ProgramUse } from "@wxy/massing";
import { generate } from "@/lib/studio/actions";
import { canConfirmSchedule } from "@/lib/store/logic";
import { useStudio } from "@/lib/store/studio";
import { SourceTag } from "./tags";

export const USE_LABEL: Record<Program, string> = {
  residential: "Residential",
  commercial: "Commercial",
  community_facility: "Community facility",
};

function parseNum(t: string): number | null {
  const n = Number(t.replace(/,/g, "").trim());
  return t.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
}

/** "Lower 2 floors" when the brief fixes a floor count; else the placement. */
export function placementLabel(u: Pick<ProgramUse, "placement" | "floors">, ground: boolean): string {
  const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
  if (u.floors !== null && u.floors > 0) {
    const n = `${u.floors} floor${u.floors === 1 ? "" : "s"}`;
    if (u.placement === "any") return n;
    if (u.placement === "ground" && u.floors === 1) return "Ground floor";
    return `${cap(u.placement)} ${n}`;
  }
  if (ground) return "Ground floor";
  return u.placement === "any" ? "Any floor" : `${cap(u.placement)} floors`;
}

function UseRow({ u, ground }: { u: ProgramUse; ground: boolean }) {
  const acceptUse = useStudio((s) => s.acceptUse);
  const editUse = useStudio((s) => s.editUse);
  const [editing, setEditing] = useState(false);
  const [gfa, setGfa] = useState("");
  const [units, setUnits] = useState("");
  const isRes = u.use === "residential";
  const startEdit = () => {
    setGfa(u.targetGfa === null ? "" : String(u.targetGfa));
    setUnits(u.targetUnits === null ? "" : String(u.targetUnits));
    setEditing(true);
  };
  const save = () => {
    const g = gfa.trim() === "" ? null : parseNum(gfa);
    const n = units.trim() === "" ? null : parseNum(units);
    editUse(u.use, { targetGfa: g, targetUnits: isRes ? n : null });
    setEditing(false);
  };
  const name = USE_LABEL[u.use];
  return (
    <TableRow>
      <TableCell className="align-top whitespace-normal">
        <div className="font-medium">{name}</div>
        <div className="text-ink-3">{placementLabel(u, ground)}</div>
        <SourceTag source={u.source} />
      </TableCell>
      <TableCell className="num text-right align-top">
        {editing ? (
          <div className="flex flex-col items-end gap-1">
            <Input aria-label={`${name} target GFA (sf)`} inputMode="numeric" className="h-9 w-24 text-right" value={gfa} onChange={(e) => setGfa(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
            {isRes && <Input aria-label="Target units" inputMode="numeric" className="h-9 w-24 text-right" value={units} onChange={(e) => setUnits(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />}
          </div>
        ) : (
          <>
            <div>{u.targetGfa === null ? "—" : `${fmtInt(u.targetGfa)} sf`}</div>
            {isRes && <div>{u.targetUnits === null ? "— units" : `${fmtInt(u.targetUnits)} units`}</div>}
          </>
        )}
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col items-start gap-1">
          {editing ? (
            <Button size="xs" onClick={save}>Save</Button>
          ) : u.accepted ? (
            <span className="pill pill-ok"><Check className="size-3.5" aria-hidden />Accepted</span>
          ) : (
            <Button size="xs" onClick={() => acceptUse(u.use)} aria-label={`Accept ${name}`}>Accept</Button>
          )}
          {!editing && (
            <Button size="xs" variant="outline" onClick={startEdit} aria-label={`Edit ${name}`}>
              <Pencil data-icon="inline-start" />Edit
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function ScheduleStep() {
  const schedule = useStudio((s) => s.schedule);
  const confirm = useStudio((s) => s.confirm);
  const editOpen = useStudio((s) => s.editOpenSpace);
  const gen = useStudio((s) => s.gen);
  const [open, setOpen] = useState<string | null>(null);
  if (!schedule)
    return (
      <Empty className="items-start p-0 text-left">
        <EmptyHeader className="items-start">
          <EmptyTitle>No schedule yet</EmptyTitle>
          <EmptyDescription>Read your brief, or start with an empty schedule, to get one.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  const can = canConfirmSchedule(schedule);
  const openText = open ?? (schedule.openSpaceTargetPct === null ? "" : String(schedule.openSpaceTargetPct));
  return (
    <>
      <p className="max-w-[60ch] text-ink-3">Check what we took from your brief. Nothing is generated until you confirm.</p>
      {schedule.uses.length === 0 ? (
        <p className="text-ink-3">No uses in the schedule. The stack is all residential at the defaults.</p>
      ) : (
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="h-8 px-1">Use</TableHead>
              <TableHead scope="col" className="h-8 px-1 text-right">Target</TableHead>
              <TableHead scope="col" className="h-8 px-1"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedule.uses.map((u) => (
              <UseRow key={u.use} u={u} ground={schedule.groundFloorUse === u.use} />
            ))}
          </TableBody>
        </Table>
      )}
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="open-target" className="text-graphite">Open space target (%)</label>
        <Input
          id="open-target"
          inputMode="decimal"
          className="num h-9 w-20 text-right"
          value={openText}
          placeholder="none"
          onChange={(e) => setOpen(e.target.value)}
          onBlur={() => {
            if (open !== null) {
              editOpen(open.trim() === "" ? null : (parseNum(open) ?? schedule.openSpaceTargetPct));
              setOpen(null);
            }
          }}
        />
      </div>
      {schedule.publicCourtyard && <p className="text-ink-3">Brief asks for a public courtyard.</p>}
      {schedule.moves.length > 0 && (
        <div>
          <p className="font-medium">Design moves</p>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-ink-3">
            {schedule.moves.map((m, i) => (
              <li key={i}>{m.text}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {!schedule.confirmed ? (
          <Button size="sm" disabled={!can} onClick={confirm}>Confirm schedule</Button>
        ) : (
          <>
            <span className="pill pill-ok"><Check className="size-4" aria-hidden />Schedule confirmed</span>
            <Button size="sm" disabled={gen.phase === "running"} onClick={() => void generate()}>Generate 6 options</Button>
          </>
        )}
        {!schedule.confirmed && !can && <span className="text-ink-3">Accept or edit every row to confirm.</span>}
      </div>
    </>
  );
}
