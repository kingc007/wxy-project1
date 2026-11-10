"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert, CircleDashed, CircleHelp, CircleX, type LucideIcon } from "lucide-react";
import type { UseGroupSummary, UseStatus } from "@/lib/zr/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CiteTag } from "./cite";

const STATUS: Record<UseStatus, string> = {
  as_of_right: "Permitted as of right",
  limited: "Permitted with limits",
  special_permit: "Special permit",
  not_permitted: "Not permitted",
  mixed: "Varies by use",
  unknown: "Unknown",
};
const SHORT: Record<UseStatus, string> = {
  as_of_right: "As of right", limited: "Limited", special_permit: "Permit", not_permitted: "No", mixed: "Varies", unknown: "Unknown",
};

const LOOK: Record<UseStatus, { icon: LucideIcon; cls: string }> = {
  as_of_right: { icon: Check, cls: "bg-ok-wash text-ok" },
  limited: { icon: CircleAlert, cls: "bg-warn-wash text-warn" },
  special_permit: { icon: CircleHelp, cls: "bg-warn-wash text-warn" },
  not_permitted: { icon: CircleX, cls: "bg-paper-2 text-ink-2" },
  mixed: { icon: CircleDashed, cls: "bg-paper-2 text-ink-2" },
  unknown: { icon: CircleHelp, cls: "bg-warn-wash text-warn" },
};

/** Status as a pill: wash, icon and word, so it never relies on colour alone. */
function UsePill({ s, long = false }: { s: UseStatus; long?: boolean }) {
  const { icon: Icon, cls } = LOOK[s];
  return (
    <span className={`inline-flex min-h-7 items-center gap-1 rounded-md px-2 text-[0.8125rem] font-medium ${cls}`}>
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />{long ? STATUS[s] : SHORT[s]}
    </span>
  );
}

interface Col { key: string; district: string; column: string; groups: Map<string, UseGroupSummary> }
type Load = { state: "loading" } | { state: "ok"; cols: Col[]; order: { ug: string; title: string }[]; failed: string[] };

/** The /api/uses response is an array of UseGroupSummary; accept an object wrapping one too. */
function extractGroups(json: unknown): UseGroupSummary[] | null {
  if (Array.isArray(json)) return json as UseGroupSummary[];
  if (json && typeof json === "object") {
    for (const k of ["groups", "results", "summaries", "useGroups"]) {
      const v = (json as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v as UseGroupSummary[];
    }
  }
  return null;
}

function Cell({ g, colLabel }: { g: UseGroupSummary | undefined; colLabel: string }) {
  if (!g) return <span className="text-ink-3">—</span>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Use group ${g.useGroup}, ${colLabel}: ${STATUS[g.status]}. Show counts and examples.`}
          className="inline-flex min-h-10 items-center rounded-md px-1 hover:bg-accent-wash"
        >
          <UsePill s={g.status} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 rounded-md border border-rule-strong bg-paper p-3 text-[0.8125rem] shadow-none ring-0">
        <p className="font-semibold">Use group {g.useGroup} {g.title}, {colLabel}</p>
        <p className="mt-1.5"><UsePill s={g.status} long /></p>
        <p className="tabular mt-2 text-[0.8125rem] text-ink-2">
          {g.counts.asOfRight} as of right, {g.counts.limited} limited, {g.counts.specialPermit} special permit, {g.counts.notPermitted} not permitted
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-ink-2">Use group definition <CiteTag citation={g.citation} /></p>
        {g.examples.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {g.examples.map((ex, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-2">
                <span>{ex.use}</span>
                <span className="font-mono text-ink-2" aria-label={`table symbol ${ex.symbol}`}>{ex.symbol}</span>
                <CiteTag citation={ex.citation} />
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function UseGroups({ districts, overlays }: { districts: string[]; overlays: string[] }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const dKey = districts.join(",");
  const oKey = overlays.join(",");
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setLoad({ state: "loading" });
      const cols: Col[] = [];
      const failed: string[] = [];
      const order: { ug: string; title: string }[] = [];
      await Promise.all(dKey.split(",").filter(Boolean).map(async (district) => {
        try {
          const res = await fetch(`/api/uses?district=${encodeURIComponent(district)}&overlays=${encodeURIComponent(oKey)}`, { signal: ac.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const groups = extractGroups(await res.json());
          if (!groups) throw new Error("unexpected response");
          for (const g of groups) {
            const key = `${district}|${g.column}`;
            let col = cols.find((c) => c.key === key);
            if (!col) { col = { key, district, column: g.column, groups: new Map() }; cols.push(col); }
            col.groups.set(g.useGroup, g);
            if (!order.some((o) => o.ug === g.useGroup)) order.push({ ug: g.useGroup, title: g.title });
          }
        } catch {
          if (!ac.signal.aborted) failed.push(district);
        }
      }));
      if (ac.signal.aborted) return;
      const dOrder = dKey.split(",");
      cols.sort((a, b) => dOrder.indexOf(a.district) - dOrder.indexOf(b.district));
      setLoad({ state: "ok", cols, order, failed });
    })();
    return () => ac.abort();
  }, [dKey, oKey]);

  const multiDistrict = districts.length > 1;
  return (
    <div className="space-y-3">
      <p className="text-[0.875rem] text-ink-2">Summarised from the official use tables; check specific uses in the source.</p>
      {districts.length === 0 && <p className="text-ink-2">No district to look up.</p>}
      {load.state === "loading" && districts.length > 0 && <p className="text-[0.875rem] text-ink-2" role="status">Reading the use tables…</p>}
      {load.state === "ok" && (
        <>
          {load.failed.length > 0 && <p className="text-[0.875rem] text-ink-2">Use groups for {load.failed.join(", ")} are unavailable.</p>}
          {load.cols.length > 0 && (
            <div className="relative overflow-x-auto" role="region" aria-label="Permitted use groups matrix" tabIndex={0}>
              <table className="tabular w-full border-collapse text-[0.8125rem] leading-[1.3]">
                <caption className="sr-only">Use groups by district column. Each cell opens counts and cited examples.</caption>
                <thead>
                  <tr className="border-b border-ink text-left">
                    <th scope="col" className="px-3 py-2.5 text-[0.8125rem] font-semibold text-ink-2">Use group</th>
                    {load.cols.map((c) => (
                      <th key={c.key} scope="col" className="tabular px-3 py-2.5 font-mono text-[0.8125rem] font-medium text-ink-2">
                        {multiDistrict && c.district !== c.column ? `${c.district} ${c.column}` : c.column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {load.order.map((o) => (
                    <tr key={o.ug} className="border-b border-rule">
                      <th scope="row" className="px-3 py-0.5 text-left text-[0.875rem] font-normal">
                        <span className="tabular mr-2 font-mono text-ink-2">{o.ug}</span>{o.title}
                      </th>
                      {load.cols.map((c) => (
                        <td key={c.key} className="px-1.5 py-0.5"><Cell g={c.groups.get(o.ug)} colLabel={c.column} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
