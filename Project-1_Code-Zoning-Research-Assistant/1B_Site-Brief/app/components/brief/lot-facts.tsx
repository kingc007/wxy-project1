"use client";

import type { DataProvenance, PlutoLot } from "@/lib/types";
import { lotTypeLabel } from "@/lib/brief-client/format";
import { Prov } from "./cite";

interface Row { label: string; value: string; prov?: DataProvenance[] }

function list(xs: string[]): string {
  return xs.length ? xs.join(", ") : "None listed";
}

export function LotFacts({ pluto }: { pluto: PlutoLot | null }) {
  if (!pluto) {
    return <p className="text-ink-2">PLUTO has no record for this lot. Lot values are left as Needs input.</p>;
  }
  const P = pluto.provenance;
  const pv = (...keys: string[]) => keys.map((k) => P[k]).filter((x): x is DataProvenance => !!x);
  const num = (n: number | null, unit: string) => (n === null ? "Not available" : `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${unit}`);
  const rows: Row[] = [
    { label: "Lot area", value: num(pluto.lotArea, "sf"), prov: pv("lotArea") },
    { label: "Frontage", value: num(pluto.lotFront, "ft"), prov: pv("lotFront") },
    { label: "Depth", value: num(pluto.lotDepth, "ft"), prov: pv("lotDepth") },
    { label: "Existing floor area", value: num(pluto.bldgArea, "sf"), prov: pv("bldgArea") },
    { label: "Lot type", value: lotTypeLabel(pluto.lotType), prov: pv("lotType") },
    { label: "Borough", value: pluto.borough ?? "Not available", prov: pv("borough") },
    { label: "Zoning districts", value: list(pluto.zoneDist), prov: pv("zoneDist") },
    { label: "Overlays", value: list(pluto.overlays), prov: pv("overlays") },
    { label: "Special districts", value: list(pluto.specialDistricts), prov: pv("specialDistricts") },
    {
      label: "Landmark / historic",
      value: [pluto.landmark, pluto.histDist].filter(Boolean).join("; ") || "None listed",
      prov: pv("landmark", "histDist"),
    },
  ];
  return (
    <div className="relative overflow-x-auto" role="region" aria-label="Lot facts table" tabIndex={0}>
      <table className="tabular w-full border-collapse text-[0.875rem] leading-[1.3]">
        <caption className="sr-only">Lot facts from PLUTO, each with its data source</caption>
        <thead>
          <tr className="border-b border-ink text-left">
            <th scope="col" className="text-[0.8125rem] font-semibold text-ink-2 px-3 py-2.5">Fact</th>
            <th scope="col" className="text-[0.8125rem] font-semibold text-ink-2 px-3 py-2.5 text-right">Value</th>
            <th scope="col" className="text-[0.8125rem] font-semibold text-ink-2 px-3 py-2.5">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="min-h-11 border-b border-rule align-middle">
              <th scope="row" className="h-12 px-3 py-1 text-left font-normal text-ink-2">{r.label}</th>
              <td className="tabular px-3 py-1 text-right font-medium text-ink">{r.value}</td>
              <td className="px-3 py-1">
                {r.prov?.length ? (
                  <span className="inline-flex flex-col">{r.prov.slice(0, 1).map((p) => <Prov key={p.field ?? r.label} p={p} />)}</span>
                ) : (
                  <span className="text-[0.8125rem] text-ink-2">No record</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
