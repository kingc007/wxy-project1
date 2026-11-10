"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { BriefRequest } from "@/lib/brief-client/events";
import { useBriefUi } from "./context";

type Format = "pdf" | "md" | "json";
const ITEMS: { format: Format; label: string }[] = [
  { format: "pdf", label: "Download PDF sheet" },
  { format: "md", label: "Download Markdown" },
  { format: "json", label: "Download envelope JSON" },
];

function fileNameFrom(res: Response, bbl: string, format: Format): string {
  const cd = res.headers.get("content-disposition") ?? "";
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  if (m) return decodeURIComponent(m[1]);
  return format === "json" ? `zoning-envelope-${bbl}.json` : `zoning-brief-${bbl}.${format}`;
}

/** Posts to /api/export {bbl, intendedUse, programs, overrides, verifiedBy, format} and saves the response body. */
export function ExportMenu({ bbl, request }: { bbl: string; request: BriefRequest }) {
  const { reviewer } = useBriefUi();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Format | null>(null);

  async function run(format: Format) {
    setBusy(format);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bbl, intendedUse: request.intendedUse, programs: request.programs, overrides: request.overrides,
          verifiedBy: reviewer || request.verifiedBy, format,
        }),
      });
      if (!res.ok) {
        toast(res.status === 404 ? "Export isn’t available yet in this build." : `Export failed (HTTP ${res.status}). Try again in a minute.`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileNameFrom(res, bbl, format);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setOpen(false);
    } catch {
      toast("Export failed. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline">
          <Download className="size-4" aria-hidden="true" />Export
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 rounded-md border border-rule-strong bg-sheet p-1 shadow-none ring-0">
        <ul>
          {ITEMS.map((i) => (
            <li key={i.format}>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void run(i.format)}
                className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-[0.9375rem] hover:bg-accent-wash disabled:text-ink-3"
              >
                {busy === i.format ? "Preparing…" : i.label}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
