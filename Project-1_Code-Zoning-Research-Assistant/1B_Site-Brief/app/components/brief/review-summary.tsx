"use client";

import { CircleAlert, CircleCheck, CircleHelp, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReviewSummary } from "@/lib/brief-client/review";
import { toneClass } from "@/components/status-pill";
import { cn } from "@/lib/utils";

interface Chip { key: string; text: string; href: string; tone: "ok" | "warn" | "flag"; icon: LucideIcon }

const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** What the review has to deal with, counted from the real brief. Each chip scrolls to the section it counts. */
export function reviewChips(s: ReviewSummary): Chip[] {
  const out: Chip[] = [{ key: "cited", text: `${s.cited} cited`, href: "#section-4", tone: "ok", icon: CircleCheck }];
  if (s.inferred > 0) out.push({ key: "inferred", text: `${s.inferred} inferred`, href: "#section-4", tone: "warn", icon: CircleAlert });
  if (s.needsInput > 0) out.push({ key: "needs", text: `${s.needsInput} need${s.needsInput === 1 ? "s" : ""} input`, href: "#section-4", tone: "warn", icon: CircleHelp });
  if (s.unsettled > 0) out.push({ key: "unsettled", text: `${s.unsettled} unverified or conflicting`, href: "#section-4", tone: "warn", icon: TriangleAlert });
  if (s.assumptionsTotal > 0) {
    const left = s.assumptionsTotal - s.assumptionsReviewed;
    out.push(left > 0
      ? { key: "assumptions", text: `${n(left, "assumption")} to confirm`, href: "#section-6", tone: "warn", icon: CircleHelp }
      : { key: "assumptions", text: "All assumptions reviewed", href: "#section-6", tone: "ok", icon: CircleCheck });
  }
  out.push(s.flags > 0
    ? { key: "flags", text: n(s.flags, "flag"), href: "#section-7", tone: "flag", icon: TriangleAlert }
    : { key: "flags", text: "0 flags", href: "#section-7", tone: "ok", icon: CircleCheck });
  return out;
}

export function ReviewSummaryStrip({ summary }: { summary: ReviewSummary }) {
  const chips = reviewChips(summary);
  return (
    <section aria-labelledby="review-summary" className="mt-8">
      <h3 id="review-summary" className="heading-wide text-[1.125rem]">Review summary</h3>
      <ul className="mt-3 flex flex-wrap gap-2">
        {chips.map((c) => (
          <li key={c.key}>
            <a
              href={c.href}
              className={cn(
                "tabular inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-[0.875rem] font-medium hover:underline hover:underline-offset-4",
                toneClass[c.tone],
              )}
            >
              <c.icon className="size-4 shrink-0" aria-hidden="true" />
              {c.text}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
