"use client";

import { useState } from "react";
import { SourcePane } from "@/components/source-pane";
import type { Citation } from "@/lib/types";

// Dev harness for the Source pane. Quotes are copied verbatim from the shared rules JSON
// (R7A.far.res.std and ALL.rear.attached.narrowlot), so they exercise a table-row and a paragraph highlight.
const SAMPLES: { id: string; label: string; citation: Citation }[] = [
  {
    id: "R7A.far.res.std",
    label: "R7A.far.res.std (table row)",
    citation: {
      source: "NYC Zoning Resolution",
      section: "23-22",
      url: "https://zr.planning.nyc.gov/article-ii/chapter-3/23-22",
      lastAmended: "12/5/2024",
      quote: "R7A R7-1¹ R7-2¹ | 4.00 | 5.01",
    },
  },
  {
    id: "ALL.rear.attached.narrowlot",
    label: "ALL.rear.attached.narrowlot (paragraph)",
    citation: {
      source: "NYC Zoning Resolution",
      section: "23-342",
      url: "https://zr.planning.nyc.gov/article-ii/chapter-3/23-342",
      lastAmended: null,
      quote:
        "for zoning lots with a lot width of less than 40 feet, a rear yard with a depth of not less than 30 feet shall be provided at every rear lot line on any zoning lot",
    },
  },
  {
    id: "not-found",
    label: "Quote not in section (notice)",
    citation: {
      source: "NYC Zoning Resolution",
      section: "23-22",
      url: null,
      quote: "the maximum floor area ratio is 99.00 everywhere",
    },
  },
];

export default function SourceDevPage() {
  const [active, setActive] = useState<Citation | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-medium tracking-[-0.01em]">Source pane (dev)</h1>
      <p className="mt-2 text-sm text-ink-2">Open a citation. Esc closes; focus returns to the button.</p>
      <ul className="mt-6 space-y-3">
        {SAMPLES.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className="min-h-11 rounded-[2px] border border-signal px-3 font-mono text-xs text-signal hover:bg-accent-wash"
              onClick={() => {
                setActive(s.citation);
                setOpen(true);
              }}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>
      <SourcePane open={open} citation={active} onClose={() => setOpen(false)} />
    </main>
  );
}
