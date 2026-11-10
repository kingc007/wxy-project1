"use client";
import { useRef } from "react";
import { FileJson } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { fmtInt } from "@wxy/massing";
import { farSummary } from "@/lib/studio/format";
import { loadEnvelopeFile, loadSample, siteSubline } from "@/lib/studio/actions";
import { SAMPLE_SITES, summarizeRawEnvelope } from "@/lib/studio/samples";
import { useStudio } from "@/lib/store/studio";
import { cn } from "cn";
import { Headline } from "./Headline";
import { SampleTag, SimplifiedTag } from "./tags";

export function SiteStep() {
  const siteId = useStudio((s) => s.siteId);
  const model = useStudio((s) => s.model);
  const raw = useStudio((s) => s.envelopeRaw);
  const error = useStudio((s) => s.envelopeError);
  const flags = useStudio((s) => s.reviewFlags);
  const isSample = useStudio((s) => s.siteIsSample);
  const file = useRef<HTMLInputElement>(null);
  const sum = raw ? summarizeRawEnvelope(raw) : null;
  const siteName = SAMPLE_SITES.find((x) => x.id === siteId)?.name ?? model?.envelopeId ?? "";

  return (
    <>
      {!model && <p className="max-w-[60ch] text-ink-3">Pick a sample site or load a zoning envelope (.json).</p>}
      <ul className="flex flex-col divide-y divide-rule" aria-label="Sample sites">
        {SAMPLE_SITES.map((s) => {
          const r = summarizeRawEnvelope(s.envelope);
          const sel = siteId === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-pressed={sel}
                aria-label={`${s.name}, sample site, ${r.district}, ${r.lotType} lot, ${r.areaSf ? fmtInt(r.areaSf) : "unknown"} square feet, ${farSummary(r.maxFar)}`}
                onClick={() => void loadSample(s.id)}
                className="group/row flex w-full flex-col gap-0.5 py-2.5 text-left outline-none transition-transform duration-100 active:scale-[.98] focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className={cn("font-medium", sel ? "text-accent-ink" : "text-ink")}>{s.name}</span>
                  <SampleTag />
                </span>
                <span className="num text-[13px] text-ink-3">
                  {r.district} district, {r.lotType} lot
                </span>
                <span className="num text-[13px] text-ink-3">{r.areaSf ? fmtInt(r.areaSf) : "?"} sf</span>
                <span className="num text-[13px] text-ink-3">{farSummary(r.maxFar)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-1.5">
        <input
          ref={file}
          id="envelope-file"
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Load envelope JSON file"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void loadEnvelopeFile(f);
            e.target.value = "";
          }}
        />
        <Button variant="outline" size="sm" className="w-fit" onClick={() => file.current?.click()}>
          <FileJson data-icon="inline-start" />
          Load envelope (.json)
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Envelope not loaded</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {model && sum && (
        <div className="flex flex-col gap-2 border-t border-rule pt-4">
          <h3 className="display">
            <Headline text={siteName} />
          </h3>
          <p className="flex flex-wrap items-center gap-2">
            <span className="code text-[13px] text-ink-3">{model.envelopeId}</span>
            {isSample && <SampleTag />}
            {model.simplified && <SimplifiedTag />}
          </p>
          <p className="text-ink-3">{siteSubline(model, sum.district)}</p>
          {model.lotAreaSource === "data" && Math.abs(model.polygonArea - model.lotArea) / model.lotArea > 0.01 && (
            <p className="text-ink-3">
              FAR uses the recorded lot area ({fmtInt(model.lotArea)} sf), as Site Brief does. The drawn outline measures{" "}
              {fmtInt(model.polygonArea)} sf.
            </p>
          )}
          {model.simplifications.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Simplifications ({model.simplifications.length})
              </summary>
              <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-ink-3">
                {model.simplifications.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </details>
          )}
          {flags.length > 0 && (
            <div>
              <p className="font-medium">Review flags</p>
              <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-ink-3">
                {flags.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {model.unchecked.length > 0 && (
            <p className="text-ink-3">
              {model.unchecked.length} control{model.unchecked.length === 1 ? "" : "s"} not checked; see Review rows in the zoning table.
            </p>
          )}
          {siteId === "upload" && (
            <p className="text-ink-3">Sun study uses the Fort Greene sample location (SIMPLIFIED) and shows no context buildings for uploaded envelopes.</p>
          )}
        </div>
      )}
    </>
  );
}
