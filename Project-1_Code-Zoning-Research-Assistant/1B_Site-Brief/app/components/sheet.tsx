import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SheetProps {
  title: string;
  sheetNo: string;
  site?: string;
  date?: string;
  checked?: string;
  children: ReactNode;
  className?: string;
}

/** A drawing-set sheet: opaque paper, 1px frame, title block bottom right. */
export function Sheet({ title, sheetNo, site = "—", date = "—", checked = "—", children, className }: SheetProps) {
  return (
    <section aria-label={title} className={cn("relative flex flex-col bg-sheet", className)}>
      <div className="flex-1 p-5 md:p-8">{children}</div>
      <div className="flex justify-end">
        <dl className="grid w-full min-w-0 max-w-md grid-cols-[auto_minmax(0,1fr)] [&>dd]:break-words border-l border-t border-rule-strong text-[0.8125rem] [&>dt]:border-b [&>dt]:border-rule-strong [&>dt]:bg-paper-2 [&>dt]:px-3 [&>dt]:py-2 [&>dd]:border-b [&>dd]:border-rule-strong [&>dd]:px-3 [&>dd]:py-2">
          <dt className="title-block-label">Site</dt>
          <dd>{site}</dd>
          <dt className="title-block-label">Sheet title</dt>
          <dd className="font-medium">{title}</dd>
          <dt className="title-block-label">Sheet no.</dt>
          <dd className="tabular">{sheetNo}</dd>
          <dt className="title-block-label">Date</dt>
          <dd className="tabular">{date}</dd>
          <dt className="title-block-label">Drawn</dt>
          <dd>Site Brief (draft)</dd>
          <dt className="title-block-label">Checked</dt>
          <dd>{checked}</dd>
        </dl>
      </div>
    </section>
  );
}
