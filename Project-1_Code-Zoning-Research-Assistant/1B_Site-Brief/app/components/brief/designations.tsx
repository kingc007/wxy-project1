"use client";

import { AlertTriangle } from "lucide-react";
import type { SiteData } from "@/lib/types";
import type { ZoningBrief } from "@/lib/zoning/model";
import { COPY } from "@/lib/brief-client/events";
import { CiteList, ProvList } from "./cite";

export function Designations({ site, brief }: { site: SiteData; brief: ZoningBrief }) {
  const p = site.pluto;
  const split = brief.splitLot;
  const conflicts = brief.flags.filter((f) => f.kind === "data_conflict");
  const splitCites = Object.values(brief.controls.maxFar).flatMap((v) => v.citations ?? []);
  const seen = new Set<string>();
  const splitCitations = splitCites.filter((c) => {
    const k = `${c.section}|${c.paragraph ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return /^77-/.test(c.section);
  });
  const codes = p?.zoneDist ?? [];
  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {(split.isSplit ? split.portions : codes.map((c) => ({ districtCodes: [c], share: null as number | null }))).map((pt) => (
          <li key={pt.districtCodes.join("+")} className="flex flex-wrap items-baseline gap-x-3">
            <span className="tabular font-mono text-[1.25rem] font-semibold">{pt.districtCodes.join(", ")}</span>
            {split.isSplit && pt.share !== null && (
              <span className="tabular text-[0.9375rem] text-ink-2">{(pt.share * 100).toFixed(1)}% of lot</span>
            )}
          </li>
        ))}
        {!codes.length && !split.isSplit && <li className="text-ink-2">No base zoning district identified.</li>}
      </ul>
      <p className="text-[0.9375rem] text-ink-2">
        Overlays: <span className="font-mono">{p?.overlays.length ? p.overlays.join(", ") : "none listed"}</span>. Special districts:{" "}
        <span className="font-mono">{p?.specialDistricts.length ? p.specialDistricts.join(", ") : "none listed"}</span>.
      </p>
      {p?.provenance.zoneDist && <ProvList provenance={[p.provenance.zoneDist]} />}
      {split.isSplit && (
        <div className="rounded-md bg-warn-wash px-4 py-3 text-[0.9375rem]">
          <p className="inline-flex items-center gap-1.5 font-semibold text-warn">
            <AlertTriangle className="size-4" aria-hidden="true" /> Split lot
          </p>
          <p className="mt-1 text-ink">{COPY.splitLot}</p>
          {splitCitations.length > 0 && (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-ink-2">Adjusted FAR follows <CiteList citations={splitCitations} /></p>
          )}
        </div>
      )}
      {conflicts.map((f, i) => (
        <div key={i} className="rounded-md bg-flag-wash px-4 py-3 text-[0.9375rem] text-ink">
          <p><span className="font-semibold text-flag">Data conflict.</span> {f.message}</p>
          <ProvList provenance={f.provenance} />
        </div>
      ))}
    </div>
  );
}
