"use client";

import type { DataProvenance, Citation, PValue, SiteData } from "@/lib/types";
import type { ZoningBrief } from "@/lib/zoning/model";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtValue, meter, type Meter } from "@/lib/brief-client/format";
import { CiteList, ProvList } from "./cite";
import { StatusPill } from "@/components/status-pill";
import { markKind } from "@/lib/brief-client/review";

/** Resolve a PValue input path ("lot.area", "controls.maxFar.residential", "splitLot.portions[0].share") for tag display. */
function getByPath(root: unknown, path: string): unknown {
  let cur: unknown = root;
  for (const part of path.replace(/\[(\d+)\]/g, ".$1").split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

const LOT_KEYS: Record<string, { key: string; label: string }> = {
  "lot.area": { key: "lotArea", label: "Lot area" },
  "lot.frontage": { key: "lotFront", label: "Frontage" },
  "lot.depth": { key: "lotDepth", label: "Depth" },
};

interface InputView { path: string; label: string; citations?: Citation[]; provenance?: DataProvenance[]; value?: string | null }

function resolveInput(path: string, brief: ZoningBrief, site: SiteData): InputView {
  const lot = LOT_KEYS[path];
  if (lot) {
    const prov = site.pluto?.provenance[lot.key];
    return { path, label: lot.label, provenance: prov ? [prov] : undefined };
  }
  const hit = getByPath({ controls: brief.controls, splitLot: brief.splitLot, calculations: brief.calculations }, path) as PValue | number | undefined;
  if (hit && typeof hit === "object" && "unit" in hit) {
    return { path, label: path.split(".").slice(-2).join(" "), citations: hit.citations, provenance: hit.provenance, value: fmtValue(hit) };
  }
  if (typeof hit === "number") return { path, label: path, value: String(hit) };
  return { path, label: path };
}

function Bar({ label, m, valueLabel, summary }: { label: string; m: Meter; valueLabel: string; summary: string }) {
  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
        <span className="text-ink-2" id={`m-${label}`}>{label}</span>
        <span className="tabular text-ink">{valueLabel}</span>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            tabIndex={0}
            role="meter"
            aria-label={`${label}: ${summary}`}
            aria-valuemin={0}
            aria-valuemax={m.max}
            aria-valuenow={m.value}
            className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-paper-2"
          >
            <div className="h-full rounded-full bg-ink-2" style={{ width: `${Math.round(m.fraction * 1000) / 10}%` }} />
          </div>
        </TooltipTrigger>
        <TooltipContent>{summary}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function Calculations({ brief, site }: { brief: ZoningBrief; site: SiteData }) {
  const calcs = brief.calculations;
  const existing = site.pluto?.bldgArea ?? null;
  const firstFa = Object.entries(brief.controls.maxFloorArea).find(([, v]) => v.value !== null);
  const farMeter = firstFa ? meter(existing, firstFa[1].value) : null;
  const covPct = brief.controls.lotCoverage.max.value;
  const covMeter = meter(covPct, 100);
  const covCalc = calcs.find((c) => c.id === "coverageArea");
  return (
    <div className="space-y-5">
      {calcs.length === 0 && <p className="text-ink-2">No calculations could run. Inputs are marked Needs input in the table above.</p>}
      <ul className="space-y-4">
        {calcs.map((c) => (
          <li key={c.id} className="border-b border-rule pb-4 last:border-b-0">
            <h4 className="flex flex-wrap items-center gap-2 text-[0.9375rem] font-semibold">{c.label}<StatusPill kind={markKind(c.pvalue)} /></h4>
            {c.pvalue.formula ? (
              <p className="tabular mt-1.5 text-[1.0625rem] font-medium text-ink">{c.pvalue.formula}</p>
            ) : (
              <p className="mt-1 text-[0.875rem] text-ink-2">{c.pvalue.status === "needs_input" ? "Needs input" : c.pvalue.note ?? "—"}</p>
            )}
            {c.pvalue.status === "needs_input" && c.pvalue.note && <p className="mt-1 text-[0.8125rem] text-ink-2">{c.pvalue.note}</p>}
            {c.pvalue.inputs && c.pvalue.inputs.length > 0 && (
              <ul className="mt-2 space-y-1">
                {c.pvalue.inputs.map((path) => {
                  const iv = resolveInput(path, brief, site);
                  return (
                    <li key={path} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-ink-2">
                      <span>Input: {iv.label}</span>
                      {iv.value && <span className="tabular text-ink">{iv.value}</span>}
                      <CiteList citations={iv.citations} />
                      <ProvList provenance={iv.provenance} />
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {(farMeter || covMeter) && (
        <div className="max-w-md border-t border-rule pt-3">
          <h4 className="text-[0.9375rem] font-semibold">Meters</h4>
          {farMeter && firstFa && (
            <Bar
              label="Existing floor area against the maximum"
              m={farMeter}
              valueLabel={`${farMeter.value.toLocaleString("en-US")} of ${farMeter.max.toLocaleString("en-US")} sf`}
              summary={`PLUTO existing floor area ${farMeter.value.toLocaleString("en-US")} sf; maximum ${farMeter.max.toLocaleString("en-US")} sf (${Math.round(farMeter.fraction * 100)}% used).`}
            />
          )}
          {covMeter && covPct !== null && (
            <Bar
              label="Maximum lot coverage"
              m={covMeter}
              valueLabel={`${covPct.toLocaleString("en-US")}% of the lot${covCalc?.pvalue.value != null ? `, ${covCalc.pvalue.value.toLocaleString("en-US")} sf` : ""}`}
              summary={`Up to ${covPct}% of the lot may be covered.`}
            />
          )}
        </div>
      )}
    </div>
  );
}
