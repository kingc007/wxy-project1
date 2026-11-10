"use client";
import { CircleCheck, CircleHelp, ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtInt, type ComplianceRow, type MassingOption, type ProgramFitRow } from "@wxy/massing";
import { cn } from "cn";
import { RowStatus } from "./tags";

function AllowedCell({ row }: { row: ComplianceRow }) {
  if (row.status === "na") return <span aria-hidden>—</span>;
  if (row.citations.length === 0) return <>{row.allowed}</>;
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`${row.rule}: allowed ${row.allowed}. Show source`}
        className="num cursor-pointer rounded-sm text-sm text-signal underline decoration-1 underline-offset-4 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        {row.allowed}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <PopoverTitle>{row.rule}</PopoverTitle>
        {row.citations.map((c, i) => (
          <div key={i} className="flex flex-col gap-1">
            <PopoverDescription className="text-ink">
              <span className="font-medium">{c.source} {c.section}</span>
            </PopoverDescription>
            <blockquote className="border-l-2 border-rule pl-2 text-ink-3">“{c.quote}”</blockquote>
            {c.url ? (
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline underline-offset-2">
                Source: {c.section}
                <ExternalLink className="size-3" aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            ) : (
              <span className="text-ink-3">Source: {c.section} (no link)</span>
            )}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function ZoningTable({ option }: { option: MassingOption }) {
  return (
    <div className="flex flex-col gap-1">
      <Table className="w-full table-fixed text-sm">
        <caption className="sr-only">Zoning compliance for this option: rule, allowed value, proposed value, status.</caption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="h-9 w-[37%] px-1.5 text-ink-2">Rule</TableHead>
            <TableHead scope="col" className="h-9 w-[14%] px-1 text-right text-ink-2">Allowed</TableHead>
            <TableHead scope="col" className="h-9 w-[16%] px-1 text-right text-ink-2">Proposed</TableHead>
            <TableHead scope="col" className="h-9 px-1.5 text-ink-2">Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {option.compliance.map((r) => (
            <TableRow key={r.id} className={cn(r.status === "na" && "text-ink-3")}>
              <TableHead scope="row" className="h-auto px-1.5 py-2 whitespace-normal align-top font-normal text-ink">
                <div title={r.shortRule}>
                  {r.rule}
                  {r.simplified && r.status !== "na" && <sup aria-label="simplified rule"> †</sup>}
                </div>
                {r.detail && r.status !== "na" && <div className="mt-0.5 text-ink-3">{r.detail}</div>}
              </TableHead>
              <TableCell className="num px-1 py-2 text-right align-top text-sm whitespace-normal"><AllowedCell row={r} /></TableCell>
              <TableCell className="num px-1 py-2 text-right align-top text-sm whitespace-normal">{r.status === "na" ? "—" : r.proposed}</TableCell>
              <TableCell className="px-1.5 py-2 align-top whitespace-normal"><RowStatus status={r.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {option.compliance.some((r) => r.simplified && r.status !== "na") && (
        <p className="text-ink-3">† Simplified rule; see the site&apos;s simplifications list.</p>
      )}
      <p className="text-ink-3">Metrics are computed by the geometry engine, not the AI. Study-grade; verify with a zoning professional.</p>
    </div>
  );
}

const FIT_LABEL: Record<ProgramFitRow["use"], string> = {
  residential: "Residential GFA",
  commercial: "Commercial GFA",
  community_facility: "Community facility GFA",
  units: "Units (est.)",
};

export function ProgramFitTable({ option }: { option: MassingOption }) {
  if (option.programFit.length === 0) return <p className="text-ink-3">No program targets set in the schedule.</p>;
  return (
    <Table className="text-sm">
      <caption className="sr-only">Program fit: target against proposed.</caption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col" className="h-9 px-1.5 text-ink-2">Program</TableHead>
          <TableHead scope="col" className="h-9 px-1.5 text-right text-ink-2">Target</TableHead>
          <TableHead scope="col" className="h-9 px-1.5 text-right text-ink-2">Proposed</TableHead>
          <TableHead scope="col" className="h-9 px-1.5 text-ink-2">Fit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {option.programFit.map((r) => (
          <TableRow key={r.use}>
            <TableHead scope="row" className="h-auto px-1.5 py-2 whitespace-normal font-normal">{FIT_LABEL[r.use]}</TableHead>
            <TableCell className="num px-1.5 text-right">{fmtInt(Math.round(r.target / (r.use === "units" ? 1 : 10)) * (r.use === "units" ? 1 : 10))}</TableCell>
            <TableCell className="num px-1.5 text-right">{fmtInt(Math.round(r.proposed / (r.use === "units" ? 1 : 10)) * (r.use === "units" ? 1 : 10))}</TableCell>
            <TableCell className="px-1.5 whitespace-normal">
              <span className={cn("pill", r.met ? "pill-ok" : "pill-warn")}>
                {r.met ? <CircleCheck className="size-4" aria-hidden /> : <CircleHelp className="size-4" aria-hidden />}
                {r.met ? "Met" : "Not met"}
              </span>
              <span className="num mt-0.5 block text-ink-3">{r.deltaPct > 0 ? "+" : ""}{r.deltaPct.toFixed(1)}% vs target (within 5% counts as met)</span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
