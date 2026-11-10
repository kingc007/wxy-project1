"use client";

import type { Assumption, PValue } from "@/lib/types";
import type { BulkRow } from "@/lib/zoning/model";
import { StatusPill } from "@/components/status-pill";
import { markKind } from "@/lib/brief-client/review";
import { Pencil } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtValue, showOption } from "@/lib/brief-client/format";
import { CiteList, ProvList } from "./cite";
import { portionHeader, portionValue, rowId } from "@/lib/brief-client/portion-cells";
import type { Controls } from "@/lib/zoning/model";
import { VerifyButton } from "./verify";
import { useBriefUi } from "./context";

export { markKind };

/** Subtle "overridden" mark, with the original value on hover/focus. */
export function OverriddenMark({ original }: { original: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex min-h-6 items-center gap-1 rounded-md bg-paper-2 px-2 text-[0.8125rem] font-medium text-ink-2">
          <Pencil className="size-3.5" aria-hidden="true" />
          Overridden
        </span>
      </TooltipTrigger>
      <TooltipContent>Overridden. Source value: {original}.</TooltipContent>
    </Tooltip>
  );
}

function ValueCell({ pv }: { pv: PValue }) {
  if (pv.status === "needs_input") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-block rounded-md text-ink-2">Needs input</span>
        </TooltipTrigger>
        <TooltipContent>No source gives this value for this lot. Enter it or leave it open.</TooltipContent>
      </Tooltip>
    );
  }
  if (pv.status === "manual") return <span className="font-sans text-ink">Manual, needs professional analysis</span>;
  if (pv.status === "not_applicable" || pv.value === null) return <span className="font-sans text-ink-2">Not applicable</span>;
  return <span>{fmtValue(pv)}</span>;
}

function MiniCell({ pv }: { pv: PValue | undefined }) {
  if (!pv) return <span className="text-ink-3">—</span>;
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="tabular text-ink"><ValueCell pv={pv} /></span>
      <StatusPill kind={markKind(pv)} />
      <CiteList citations={pv.citations} />
    </div>
  );
}

export function BulkTable({ rows, assumptions, split }: { rows: BulkRow[]; assumptions: Assumption[]; split?: { codes: string[]; share: number | null; controls: Controls }[] }) {
  const { assumptionOriginals } = useBriefUi();
  const overridden = new Map(assumptions.filter((a) => a.state === "overridden").map((a) => [a.id, a]));
  return (
    <div className="relative overflow-x-auto" role="region" aria-label="Bulk regulations table" tabIndex={0}>
      <table className="tabular w-full min-w-[36rem] border-collapse text-[0.875rem] leading-[1.4]">
        <caption className="sr-only">Bulk regulations. Each row gives the rule, its value, why it applies and its citation.</caption>
        <thead>
          <tr className="border-b border-ink text-left">
            <th scope="col" className="px-3 py-2.5 text-[0.8125rem] font-semibold text-ink-2">Rule</th>
            {split?.length ? (
              <>
                {split.map((pt) => <th key={pt.codes.join()} scope="col" className="tabular px-3 py-2.5 text-right font-mono text-[0.8125rem] font-medium text-ink-2">{portionHeader(pt.codes, pt.share)}</th>)}
                <th scope="col" className="px-3 py-2.5 text-right text-[0.8125rem] font-semibold text-ink-2">Combined</th>
              </>
            ) : (
              <>
                <th scope="col" className="px-3 py-2.5 text-right text-[0.8125rem] font-semibold text-ink-2">Value</th>
                <th scope="col" className="px-3 py-2.5 text-[0.8125rem] font-semibold text-ink-2">Applies because</th>
                <th scope="col" className="px-3 py-2.5 text-[0.8125rem] font-semibold text-ink-2">Source</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const pv = r.value;
            const dep = (pv.assumptionIds ?? []).map((id) => overridden.get(id)).filter((a): a is Assumption => !!a);
            const claimKey = `row:${r.label}`;
            if (split?.length) {
              return (
                <tr key={`${r.label}-${i}`} id={rowId(r.label)} className="min-h-11 scroll-mt-24 border-b border-rule align-top">
                  <th scope="row" className="px-3 py-3 text-left font-normal text-ink">{r.label}</th>
                  {split.map((pt) => <td key={pt.codes.join()} className="px-3 py-3 text-right"><MiniCell pv={portionValue(pt.controls, r.label)} /></td>)}
                  <td className="bg-paper-2 px-3 py-3 text-right">
                    <MiniCell pv={pv} />
                    {pv.formula && <div className="mt-1 text-[0.8125rem] text-ink-3">{pv.formula}</div>}
                    {pv.note && <div className="mt-1 text-[0.8125rem] text-ink-3">{pv.note}</div>}
                    {pv.value !== null && <div className="mt-1 flex justify-end"><VerifyButton compact claimKey={claimKey} subject={r.label} /></div>}
                  </td>
                </tr>
              );
            }
            return (
              <tr key={`${r.label}-${i}`} id={rowId(r.label)} className="min-h-11 scroll-mt-24 border-b border-rule align-top">
                <th scope="row" className="min-h-11 px-3 py-3 text-left font-normal">
                  <div className="text-ink">{r.label}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <StatusPill kind={markKind(pv)} />
                    {pv.override && <OverriddenMark original={pv.override.originalValue === null ? "none" : String(pv.override.originalValue)} />}
                    {!pv.override && dep.map((a) => (
                      <OverriddenMark key={a.id} original={showOption(assumptionOriginals[a.id] ?? "unknown")} />
                    ))}
                  </div>
                </th>
                <td className="tabular px-3 py-3 text-right font-medium text-ink">
                  <ValueCell pv={pv} />
                  {pv.formula && <div className="mt-0.5 text-[0.8125rem] text-ink-3">{pv.formula}</div>}
                </td>
                <td className="px-3 py-3 text-ink-2">
                  {pv.appliesBecause ?? (pv.status === "computed" ? "Computed in code from the values above." : "—")}
                  {pv.note && <div className="mt-1 text-[0.8125rem] text-ink-3">{pv.note}</div>}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-col items-start gap-1.5">
                    {pv.citations?.length ? <CiteList citations={pv.citations} /> : <span className="text-[0.8125rem] text-ink-3">{pv.status === "computed" ? "Computed" : "No citation"}</span>}
                    <ProvList provenance={pv.provenance} />
                    {pv.value !== null && <VerifyButton compact claimKey={claimKey} subject={r.label} />}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
