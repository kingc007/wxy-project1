"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, CircleCheck, Download, TriangleAlert } from "lucide-react";
import type { ZoningBrief } from "@/lib/zoning/model";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { openInMassing, toastTimeout, TOAST_BLOCKED, TOAST_SENT } from "@/lib/brief-client/massing-handoff";
import { envelopeFilename } from "@/lib/brief-client/format";

export function EnvelopeOutput({ brief, bbl, address }: { brief: ZoningBrief; bbl: string | null; address: string }) {
  const cancelRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelRef.current?.(), []);
  const [open, setOpen] = useState(false);
  const json = JSON.stringify(brief.envelope, null, 2);
  const version = typeof brief.envelope.schemaVersion === "string" ? brief.envelope.schemaVersion : "1.0.0";
  const { valid, errors } = brief.validation;

  function download() {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = envelopeFilename(bbl);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function sendToMassing() {
    cancelRef.current?.();
    cancelRef.current = openInMassing({
      envelope: brief.envelope,
      address,
      bbl,
      onBlocked: () => toast(TOAST_BLOCKED),
      onSent: () => toast(TOAST_SENT),
      onTimeout: () => toast(toastTimeout()),
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {valid ? (
          <p data-testid="envelope-valid" className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-ok-wash px-3 text-[0.875rem] font-medium text-ok">
            <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
            Valid against zoning-envelope.schema.json v{version}
          </p>
        ) : (
          <p data-testid="envelope-invalid" className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-flag-wash px-3 text-[0.875rem] font-medium text-flag">
            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
            Not valid against zoning-envelope.schema.json v{version}: {errors.length} {errors.length === 1 ? "error" : "errors"}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={sendToMassing}
          disabled={!valid}
          aria-describedby={valid ? undefined : "massing-disabled-reason"}
        >
          Open in Massing
        </Button>
        <Button type="button" variant="outline" onClick={download}>
          <Download className="size-4" aria-hidden="true" />Download JSON
        </Button>
        {!valid && <span id="massing-disabled-reason" className="text-[0.875rem] text-ink-2">Fix the envelope errors first.</span>}
      </div>
      {!valid && (
        <ul className="list-disc pl-5 font-mono text-[0.8125rem] text-ink-2">
          {errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}
      <div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="envelope-json"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-md text-[0.9375rem] font-medium text-signal hover:underline"
        >
          <ChevronRight className={`size-4 transition-transform motion-reduce:transition-none ${open ? "rotate-90" : ""}`} aria-hidden="true" />
          {open ? "Hide envelope JSON" : "Show envelope JSON"}
        </button>
        {open && (
          <pre
            id="envelope-json"
            tabIndex={0}
            aria-label="Zoning envelope JSON"
            className="mt-2 max-h-96 overflow-auto border border-rule bg-paper-2 p-3 font-mono text-[0.8125rem] leading-[1.5] text-ink"
          >
            {json}
          </pre>
        )}
      </div>
    </div>
  );
}
