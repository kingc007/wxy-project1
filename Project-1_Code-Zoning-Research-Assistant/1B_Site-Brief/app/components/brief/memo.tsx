"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, TriangleAlert } from "lucide-react";
import type { SiteData } from "@/lib/types";
import type { ZoningBrief } from "@/lib/zoning/model";
import { Sheet } from "@/components/sheet";
import { MaskedHeading } from "@/components/masked-heading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { COPY } from "@/lib/brief-client/events";
import { isoDate, titleCase } from "@/lib/brief-client/format";
import { BulkTable } from "./bulk-table";
import { Calculations } from "./calculations";
import { Designations } from "./designations";
import { EnvelopeOutput } from "./envelope-output";
import { Flags } from "./flags";
import { KeyControls } from "./key-controls";
import { Ledger } from "./ledger";
import { LotFacts } from "./lot-facts";
import { ExportMenu } from "./export-menu";
import { NarrativeSlot } from "./narrative-slot";
import type { NarrativeState } from "@/lib/brief-client/use-narrative";
import type { BriefRequest } from "@/lib/brief-client/events";
import { UseGroups } from "./use-groups";
import { VerifyButton } from "./verify";
import { ReviewSummaryStrip } from "./review-summary";
import { SectionIndex, type IndexItem } from "./section-index";
import { summarize, type Decision, type Decisions } from "@/lib/brief-client/review";
import { useBriefUi } from "./context";

function Section({ n, title, meta, children }: { n: number; title: string; meta?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={`section-${n}`} aria-labelledby={`sec-${n}`} className="mt-14 scroll-mt-16 xl:scroll-mt-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-rule-strong pt-4">
        <h3 id={`sec-${n}`} className="heading-wide text-[1.375rem]">
          <span aria-hidden="true" className="tabular mr-3 text-[1rem] font-medium text-ink-3">{n}</span>{title}
        </h3>
        {meta}
      </div>
      {children}
    </section>
  );
}

/** "2 of 5 reviewed" with a short bar; turns green when nothing is left. */
function Progress({ done, total }: { done: number; total: number }) {
  const complete = total > 0 && done === total;
  return (
    <p className="tabular flex items-center gap-2 text-[0.875rem] font-medium text-ink-2">
      <span aria-hidden="true" className="h-1.5 w-16 overflow-hidden rounded-full bg-paper-2">
        <span className={`block h-full rounded-full ${complete ? "bg-ok" : "bg-warn"}`} style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </span>
      <span className={complete ? "text-ok" : undefined}>{done} of {total} reviewed</span>
    </p>
  );
}

const EMPTY: Decisions = {};

export interface MemoProps {
  site: SiteData;
  brief: ZoningBrief;
  llm: boolean | null;
  recomputing: boolean;
  narrative?: NarrativeState;
  request: BriefRequest | null;
  onOverride: (key: string, value: string | boolean | null) => void;
}

export function Memo({ site, brief, llm, recomputing, narrative, request, onOverride }: MemoProps) {
  const { verified } = useBriefUi();
  // What the reviewer decided about each assumption. Kept per lot, so a new lot starts clean.
  const lotKey = site.geocode?.bbl ?? site.pluto?.bbl ?? site.query;
  const [stored, setStored] = useState<{ lot: string; map: Decisions }>({ lot: lotKey, map: {} });
  const decisions = stored.lot === lotKey ? stored.map : EMPTY;
  const onDecide = (id: string, d: Decision | null) =>
    setStored((prev) => {
      const base = prev.lot === lotKey ? prev.map : {};
      const next = { ...base };
      if (d === null) delete next[id]; else next[id] = d;
      return { lot: lotKey, map: next };
    });
  const summary = useMemo(() => summarize(brief.bulkTable, brief.assumptions, brief.flags, decisions), [brief.bulkTable, brief.assumptions, brief.flags, decisions]);
  const indexItems: IndexItem[] = [
    { id: "section-1", label: "Lot facts" },
    { id: "section-2", label: "Zoning designations" },
    { id: "section-3", label: "Permitted uses" },
    { id: "section-4", label: "Bulk regulations" },
    { id: "section-5", label: "Calculations" },
    {
      id: "section-6", label: "Assumptions",
      meta: summary.assumptionsTotal > 0
        ? { text: `${summary.assumptionsReviewed} of ${summary.assumptionsTotal} reviewed`, tone: summary.assumptionsReviewed === summary.assumptionsTotal ? "ok" : "warn" }
        : undefined,
    },
    { id: "section-7", label: "Flags", meta: { text: summary.flags === 0 ? "None" : String(summary.flags), tone: summary.flags === 0 ? "ok" : "flag" } },
    { id: "section-8", label: "Envelope output" },
  ];
  const p = site.pluto;
  const bbl = site.geocode?.bbl ?? p?.bbl ?? null;
  const address = p?.address ? titleCase(p.address) : site.geocode?.label ?? site.query;
  const districts = brief.splitLot.isSplit ? brief.splitLot.portions.flatMap((x) => x.districtCodes) : (p?.zoneDist.slice(0, 1) ?? []);
  const overlays = p?.overlays ?? [];
  const notices = site.errors.map((e) =>
    e.cachedAt ? COPY.cached(e.source, isoDate(e.cachedAt)) : COPY.down(e.source),
  );
  const unsupported = brief.flags.filter((f) => f.kind === "unsupported_district");
  return (
    <Sheet
      title="Zoning brief"
      sheetNo="Z-101"
      site={`${address}, BBL ${bbl ?? "—"}`}
      date={isoDate(new Date().toISOString())}
      checked={verified.sheet ? `${verified.sheet.name}, ${verified.sheet.date}` : "—"}
    >
      <div className="xl:grid xl:grid-cols-[10rem_minmax(0,1fr)] xl:gap-10">
      <SectionIndex items={indexItems} />
      <div aria-busy={recomputing} className={recomputing ? "opacity-60 transition-opacity motion-reduce:transition-none" : undefined}>
        <MaskedHeading key={address} className="display max-w-[72ch]">
          {address}
        </MaskedHeading>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.875rem] text-ink-2">
            <span>BBL <span className="tabular font-mono">{bbl}</span></span>
            {p?.version && <span>PLUTO <span className="tabular font-mono">{p.version}</span></span>}
          </p>
          {bbl && request && <ExportMenu bbl={bbl} request={request} />}
        </div>

        <p role="note" className="mt-5 flex items-start gap-2 rounded-md bg-warn-wash px-3 py-2.5 text-[0.9375rem] text-ink">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
          <span><span className="font-semibold">Draft for professional review.</span> Not a zoning determination.</span>
        </p>

        <KeyControls brief={brief} />
        <ReviewSummaryStrip summary={summary} />

        {notices.length > 0 && (
          <div className="mt-4 space-y-2">
            {notices.map((n, i) => (
              <Alert key={i} className="rounded-md border-rule-strong bg-paper-2">
                <AlertTriangle className="size-4" aria-hidden="true" />
                <AlertDescription className="text-ink">{n}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}
        {unsupported.length > 0 && (
          <p className="mt-4 text-[0.875rem] text-ink-2">{COPY.unsupported(districts.join(", ") || "This district")}</p>
        )}

        <div className="mt-4 max-w-[72ch] leading-[1.55]"><NarrativeSlot llm={llm} narrative={narrative} /></div>

        <Section n={1} title="Lot facts"><LotFacts pluto={p} /></Section>
        <Section n={2} title="Zoning designations"><Designations site={site} brief={brief} /></Section>
        <Section n={3} title="Permitted use groups"><UseGroups districts={districts} overlays={overlays} /></Section>
        <Section n={4} title="Bulk regulations"><BulkTable rows={brief.bulkTable} assumptions={brief.assumptions} split={brief.splitLot.isSplit ? brief.splitLot.portions.map((x) => ({ codes: x.districtCodes, share: x.share, controls: x.controls })) : undefined} /></Section>
        <Section n={5} title="Calculations"><Calculations brief={brief} site={site} /></Section>
        <Section n={6} title="Assumptions and open questions" meta={summary.assumptionsTotal > 0 ? <Progress done={summary.assumptionsReviewed} total={summary.assumptionsTotal} /> : undefined}>
          <Ledger assumptions={brief.assumptions} onOverride={onOverride} decisions={decisions} onDecide={onDecide} disabled={recomputing} />
        </Section>
        <Section n={7} title="Flags requiring professional review"><Flags flags={brief.flags} /></Section>
        <Section n={8} title="Envelope output"><EnvelopeOutput brief={brief} bbl={bbl} address={address} /></Section>

        <div className="mt-14 flex flex-wrap items-center gap-3 border-t border-rule-strong pt-4">
          <VerifyButton claimKey="sheet" subject="whole sheet" />
        </div>
      </div>
      </div>
    </Sheet>
  );
}
