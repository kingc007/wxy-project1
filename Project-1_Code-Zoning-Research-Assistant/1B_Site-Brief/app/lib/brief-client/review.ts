import type { Assumption, PValue, ReviewFlag } from "@/lib/types";
import type { BulkRow } from "@/lib/zoning/model";

/** The status words the UI uses. `needs-input` and `computed` are derived from the value's status, not its confidence. */
export type Status =
  | "cited" | "inferred" | "unverified" | "conflicting" | "needs-input"
  | "computed" | "flag" | "accepted" | "rejected" | "edited";

export function markKind(pv: PValue): Status {
  if (pv.status === "needs_input") return "needs-input";
  if (pv.status === "computed") return "computed";
  return pv.confidence;
}

/** Assumptions the user set themselves (intended use, program). They have nothing to accept or reject. */
export const USER_SET = new Set(["intendedUse", "program"]);

/** What the memo's assumptions section lists. */
export function openAssumptions(assumptions: Assumption[]): Assumption[] {
  return assumptions.filter((a) => a.confidence !== "cited" || a.state !== "accepted" || !USER_SET.has(a.key));
}

export type Decision = "accepted" | "rejected" | "edited";
export type Decisions = Record<string, Decision>;

/** The decision shown for an assumption: what the reviewer did this session, else "edited" if the memo already carries an override. */
export function decisionOf(a: Assumption, decisions: Decisions): Decision | null {
  return decisions[a.id] ?? (a.state === "overridden" ? "edited" : null);
}

export interface ReviewSummary {
  cited: number;
  inferred: number;
  needsInput: number;
  /** unverified and conflicting values */
  unsettled: number;
  /** assumptions a reviewer can accept, reject or edit */
  assumptionsTotal: number;
  assumptionsReviewed: number;
  flags: number;
}

export function summarize(rows: BulkRow[], assumptions: Assumption[], flags: ReviewFlag[], decisions: Decisions): ReviewSummary {
  const out: ReviewSummary = { cited: 0, inferred: 0, needsInput: 0, unsettled: 0, assumptionsTotal: 0, assumptionsReviewed: 0, flags: flags.length };
  for (const r of rows) {
    if (r.value.status === "not_applicable") continue;
    const k = markKind(r.value);
    if (k === "cited") out.cited++;
    else if (k === "inferred") out.inferred++;
    else if (k === "needs-input") out.needsInput++;
    else if (k === "unverified" || k === "conflicting") out.unsettled++;
  }
  for (const a of openAssumptions(assumptions)) {
    if (USER_SET.has(a.key)) continue;
    out.assumptionsTotal++;
    if (decisionOf(a, decisions)) out.assumptionsReviewed++;
  }
  return out;
}
