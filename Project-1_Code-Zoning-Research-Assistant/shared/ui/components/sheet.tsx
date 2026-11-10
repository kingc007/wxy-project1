import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SheetProps {
  title: string;
  sheetNo: string;
  site?: string;
  date?: string;
  checked?: string;
  /** "Drawn" line of the title block, e.g. "Site Brief (draft)" or "Clause (draft)". */
  drawn?: string;
  draft?: boolean;
  children: ReactNode;
  className?: string;
  /** Label for the site row, e.g. "Site" (1B) or "Project" (1A). */
  siteLabel?: string;
}

/** A drawing-set sheet: opaque paper, 1px frame, title block bottom right, DRAFT stamp. */
export function Sheet({
  title,
  sheetNo,
  site = "—",
  date = "—",
  checked = "—",
  drawn = "Site Brief (draft)",
  siteLabel = "Site",
  draft = true,
  children,
  className,
}: SheetProps) {
  return (
    <section aria-label={title} className={cn("relative flex flex-col border border-rule-strong bg-paper", className)}>
      {draft && (
        <div
          className="pointer-events-none absolute right-4 top-4 -rotate-3 border border-flag px-2 py-1 text-[0.75rem] font-semibold tracking-wide text-flag"
          role="note"
        >
          DRAFT — for professional review
        </div>
      )}
      <div className="flex-1 p-5 md:p-8">{children}</div>
      <div className="flex justify-end">
        <dl className="grid w-full max-w-md grid-cols-[auto_1fr] border-l border-t border-rule-strong text-[0.8125rem] [&>dt]:border-b [&>dt]:border-rule-strong [&>dt]:bg-paper-2 [&>dt]:px-2 [&>dt]:py-1.5 [&>dd]:border-b [&>dd]:border-rule-strong [&>dd]:px-2 [&>dd]:py-1.5">
          <dt className="title-block-label">{siteLabel}</dt>
          <dd>{site}</dd>
          <dt className="title-block-label">Sheet title</dt>
          <dd className="font-medium">{title}</dd>
          <dt className="title-block-label">Sheet no.</dt>
          <dd className="tabular font-mono">{sheetNo}</dd>
          <dt className="title-block-label">Date</dt>
          <dd className="tabular font-mono">{date}</dd>
          <dt className="title-block-label">Drawn</dt>
          <dd>{drawn}</dd>
          <dt className="title-block-label">Checked</dt>
          <dd>{checked}</dd>
        </dl>
      </div>
    </section>
  );
}
