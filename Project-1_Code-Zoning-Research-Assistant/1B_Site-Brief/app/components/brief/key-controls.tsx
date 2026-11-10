"use client";

import type { PValue } from "@/lib/types";
import type { ZoningBrief } from "@/lib/zoning/model";
import { StatusPill, type Status } from "@/components/status-pill";
import { fmtValue } from "@/lib/brief-client/format";
import { rowId } from "@/lib/brief-client/portion-cells";
import { DimensionString } from "@/components/dimension-string";
import { staggerDelay } from "@/lib/motion";
import { markKind } from "@/lib/brief-client/review";

const ORDER: Status[] = ["computed", "cited", "inferred", "unverified", "conflicting", "needs-input"];

function display(pv: PValue): string {
  if (pv.status === "needs_input") return "Needs input";
  if (pv.status === "manual") return "Manual";
  if (pv.status === "not_applicable" || pv.value === null) return "Not applicable";
  return fmtValue(pv) ?? "Needs input";
}

interface Item { label: string; text: string; kind: Status; rowLabel: string | null }

export function keyControlItems(brief: ZoningBrief): Item[] {
  const c = brief.controls;
  const one = (label: string, pv: PValue | undefined, rowLabel: string | null): Item => ({
    label, text: pv ? display(pv) : "Needs input", kind: pv ? markKind(pv) : "needs-input", rowLabel,
  });
  const labelOf = (re: RegExp) => brief.bulkTable.find((r) => re.test(r.label))?.label ?? null;
  const far = Object.values(c.maxFar)[0];
  const fa = Object.values(c.maxFloorArea)[0];
  const lo = c.baseHeight.min;
  const hi = c.baseHeight.max;
  const bothNum = lo.value !== null && hi.value !== null && lo.status !== "needs_input" && hi.status !== "needs_input";
  const worst = [markKind(lo), markKind(hi)].sort((a, b) => ORDER.indexOf(b) - ORDER.indexOf(a))[0];
  return [
    one("Max FAR", far, labelOf(/^Max FAR/)),
    one("Max floor area", fa, labelOf(/^Max floor area/)),
    {
      label: "Base height", rowLabel: "Base height (min)", kind: worst,
      text: bothNum ? `${lo.value}–${hi.value} ft` : lo.status === "manual" || hi.status === "manual" ? "Manual" : "Needs input",
    },
    one("Max height", c.maxBuildingHeight, "Max building height"),
    one("Rear yard", c.yards.rear, "Rear yard"),
    one("Coverage", c.lotCoverage.max, "Lot coverage (max)"),
  ];
}

export function KeyControls({ brief }: { brief: ZoningBrief }) {
  const items = keyControlItems(brief);
  return (
    <section aria-labelledby="key-controls" className="mt-8">
      <h3 id="key-controls" className="heading-wide text-[1.125rem]">Key controls</h3>
      <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 2xl:grid-cols-6">
        {items.map((it, i) => (
          <li key={it.label} className="min-w-0">
            <DimensionString
              label={it.label}
              value={it.text}
              delay={staggerDelay(i, 0.15)}
              muted={it.text === "Needs input" || it.text === "Manual" || it.text === "Not applicable"}
              href={it.rowLabel ? `#${rowId(it.rowLabel)}` : undefined}
            >
              <StatusPill kind={it.kind} />
            </DimensionString>
          </li>
        ))}
      </ul>
    </section>
  );
}
