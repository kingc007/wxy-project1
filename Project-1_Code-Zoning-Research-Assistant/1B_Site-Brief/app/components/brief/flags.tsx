import { CircleCheck, TriangleAlert } from "lucide-react";
import type { ReviewFlag } from "@/lib/types";
import { CiteList, ProvList } from "./cite";

const LABEL: Record<ReviewFlag["kind"], string> = {
  landmark: "Landmark",
  historic_district: "Historic district",
  special_district: "Special district",
  split_lot: "Split lot",
  irregular_lot: "Irregular lot",
  pending_rezoning: "Pending rezoning",
  unsupported_district: "Unsupported district",
  manual_geometry: "Manual geometry",
  data_conflict: "Data conflict",
  other: "Review",
};

/** Flags are the one place --flag fills a block in the memo body: always an icon, a label and the message. */
export function Flags({ flags }: { flags: ReviewFlag[] }) {
  if (!flags.length) {
    return (
      <p className="flex items-start gap-2 rounded-md bg-ok-wash px-4 py-3 text-[0.9375rem] text-ink">
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden="true" />
        <span><span className="font-semibold text-ok">No flags raised.</span> A professional still reviews the whole memo.</span>
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {flags.map((f, i) => (
        <li key={i} className="rounded-md bg-flag-wash px-4 py-3">
          <p className="inline-flex items-center gap-1.5 text-[0.9375rem] font-semibold text-flag">
            <TriangleAlert className="size-4" aria-hidden="true" />
            {(LABEL[f.kind] ?? "Review")}
          </p>
          <p className="mt-1.5 text-[0.9375rem] leading-[1.5] text-ink">{f.message}</p>
          <div className="mt-2 flex flex-wrap gap-2"><CiteList citations={f.citations} /><ProvList provenance={f.provenance} /></div>
        </li>
      ))}
    </ul>
  );
}
