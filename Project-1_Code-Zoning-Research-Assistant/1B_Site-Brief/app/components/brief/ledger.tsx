"use client";

import { useState } from "react";
import type { Assumption } from "@/lib/types";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { showOption } from "@/lib/brief-client/format";
import { USER_SET, decisionOf, openAssumptions, type Decision, type Decisions } from "@/lib/brief-client/review";
import { cn } from "@/lib/utils";
import { CiteList, ProvList } from "./cite";
import { useBriefUi } from "./context";

export interface LedgerProps {
  assumptions: Assumption[];
  /** key = assumption.key; value = new value, or null to clear the override */
  onOverride: (key: string, value: string | boolean | null) => void;
  /** what the reviewer decided this session, by assumption id */
  decisions: Decisions;
  onDecide: (id: string, d: Decision | null) => void;
  disabled?: boolean;
}

const KEY_LABEL: Record<string, string> = {
  lotType: "Lot type", street: "Street width", within100ftWideStreet: "Within 100 ft of a wide street",
  buildingType: "Building type", siteCategory: "Site category", program: "Program", intendedUse: "Intended use",
};

const ROW_TINT: Record<Decision, string> = {
  accepted: "bg-ok-wash",
  rejected: "bg-flag-wash",
  edited: "bg-accent-wash",
};

interface ItemProps { a: Assumption; onOverride: LedgerProps["onOverride"]; decision: Decision | null; onDecide: LedgerProps["onDecide"]; disabled?: boolean }

function AssumptionItem({ a, onOverride, decision, onDecide, disabled }: ItemProps) {
  const { assumptionOriginals } = useBriefUi();
  const [editing, setEditing] = useState(false);
  const original = assumptionOriginals[a.id] ?? a.value;
  const [draft, setDraft] = useState<string>(String(a.value));
  const userSet = USER_SET.has(a.key);
  const overridden = a.state === "overridden";

  function reject() {
    // Rejecting an assumption means "not this value". With two options that is unambiguous; otherwise ask.
    const others = a.options.filter((o) => o !== a.value);
    if (others.length === 1) { onDecide(a.id, "rejected"); onOverride(a.key, others[0]); }
    else { setDraft(String(others[0] ?? a.value)); setEditing(true); }
  }
  function applyEdit() {
    const opt = a.options.find((o) => String(o) === draft);
    if (opt === undefined) return;
    setEditing(false);
    onDecide(a.id, opt === original ? null : "edited");
    onOverride(a.key, opt === original ? null : opt);
  }
  function undo() {
    onDecide(a.id, null);
    if (overridden) onOverride(a.key, null);
  }

  const selectId = `edit-${a.id}`;
  return (
    <li className={cn("px-3 py-4 transition-colors duration-150 motion-reduce:transition-none", decision && ROW_TINT[decision])}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-64">
          <div className="flex flex-wrap items-center gap-2">
            {userSet ? <StatusPill kind="accepted" label="Set by you" /> : decision ? <StatusPill kind={decision} /> : <StatusPill kind={a.confidence} />}
            {overridden && <span className="text-[0.8125rem] text-ink-2">Source value was {showOption(original)}</span>}
          </div>
          <p className="mt-2 text-[0.9375rem] font-medium text-ink">{a.statement}</p>
          <p className="mt-1 text-[0.875rem] leading-[1.5] text-ink-2">{a.reason}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ProvList provenance={a.provenance} />
            <CiteList citations={a.citations} />
          </div>
        </div>
        {!userSet && (
          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor={selectId} className="sr-only">{KEY_LABEL[a.key] ?? a.key}</label>
                <select
                  id={selectId}
                  aria-label={KEY_LABEL[a.key] ?? a.key}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="h-10 rounded-md border border-input bg-sheet px-2 text-[0.875rem] text-ink"
                >
                  {a.options.map((o) => <option key={String(o)} value={String(o)}>{showOption(o)}</option>)}
                </select>
                <Button type="button" onClick={applyEdit}>Apply</Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            ) : decision ? (
              <>
                <Button type="button" variant="outline" disabled={disabled} aria-label={`Undo: ${a.statement}`} onClick={undo}>Undo</Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" disabled={disabled}
                  aria-label={`Accept: ${a.statement}`} onClick={() => onDecide(a.id, "accepted")}>
                  Accept
                </Button>
                <Button type="button" variant="outline" disabled={disabled} aria-label={`Reject: ${a.statement}`} onClick={reject}>
                  Reject
                </Button>
                <Button type="button" variant="outline" disabled={disabled} aria-label={`Edit: ${a.statement}`}
                  onClick={() => { setDraft(String(a.value)); setEditing(true); }}>
                  Edit
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function Ledger({ assumptions, onOverride, decisions, onDecide, disabled }: LedgerProps) {
  const open = openAssumptions(assumptions);
  return (
    <ul className="divide-y divide-rule border-y border-rule">
      {open.map((a) => (
        <AssumptionItem key={a.id} a={a} onOverride={onOverride} decision={decisionOf(a, decisions)} onDecide={onDecide} disabled={disabled} />
      ))}
    </ul>
  );
}
