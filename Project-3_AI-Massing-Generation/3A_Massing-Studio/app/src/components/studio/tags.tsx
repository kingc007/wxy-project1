import { Calculator, CircleAlert, CircleCheck, CircleHelp, Minus, Pencil, TriangleAlert } from "lucide-react";
import type { OverallKind } from "@/lib/studio/format";
import type { RuleStatus, ValueSource } from "@wxy/massing";
import { cn } from "cn";

/** Status vocabulary (Readability Pass): 6px pill = wash background + coloured text + icon + words. */
export function SampleTag() {
  return <span className="pill pill-calc font-medium">Sample data</span>;
}
export function SimplifiedTag() {
  return (
    <span className="pill pill-warn">
      <CircleAlert className="size-3.5" aria-hidden />
      Simplified rules
    </span>
  );
}

const SOURCE: Record<ValueSource, { label: string; cls: string; Icon: typeof CircleCheck }> = {
  brief: { label: "From brief", cls: "pill-ok", Icon: CircleCheck },
  inferred: { label: "Inferred", cls: "pill-warn", Icon: CircleAlert },
  default: { label: "Default", cls: "pill-warn", Icon: CircleHelp },
  user: { label: "Edited", cls: "pill-calc", Icon: Pencil },
};
export function SourceTag({ source }: { source: ValueSource }) {
  const { label, cls, Icon } = SOURCE[source];
  return (
    <span className={cn("pill", cls)}>
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

const KIND: Record<OverallKind, { cls: string; Icon: typeof CircleCheck }> = {
  pass: { cls: "pill-ok", Icon: CircleCheck },
  fail: { cls: "pill-flag", Icon: TriangleAlert },
  review: { cls: "pill-warn", Icon: CircleHelp },
};
/** Overall status: icon + words, never colour alone. */
export function StatusBadge({ kind, label, className }: { kind: OverallKind; label: string; className?: string }) {
  const { cls, Icon } = KIND[kind];
  return (
    <span className={cn("pill", cls, className)}>
      <Icon className="size-4" aria-hidden />
      {label}
    </span>
  );
}

/** Computed values (metrics from the geometry engine). */
export function ComputedTag({ children = "Computed" }: { children?: React.ReactNode }) {
  return (
    <span className="pill pill-calc font-medium">
      <Calculator className="size-3.5" aria-hidden />
      {children}
    </span>
  );
}

/** Row status in the zoning table: icon + word. "na" is plain muted text. */
export function RowStatus({ status }: { status: RuleStatus }) {
  if (status === "na")
    return (
      <span className="inline-flex items-center gap-1 text-ink-3">
        <Minus className="size-4" aria-hidden />
        Not applicable
      </span>
    );
  const cls = status === "pass" ? "pill-ok" : status === "fail" ? "pill-flag" : "pill-warn";
  const Icon = status === "pass" ? CircleCheck : status === "fail" ? TriangleAlert : CircleHelp;
  const word = status === "pass" ? "Pass" : status === "fail" ? "Fails" : "Needs input";
  return (
    <span className={cn("pill", cls)}>
      <Icon className="size-4" aria-hidden />
      {word}
    </span>
  );
}
