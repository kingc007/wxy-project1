"use client";
import { useState } from "react";
import { Undo2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PARAM_SPEC_BY_KEY } from "@wxy/massing";
import { nowLabel, previewProposal, proposeChanges } from "@/lib/studio/actions";
import { deltaRows, paramValueLabel } from "@/lib/studio/format";
import { useStudio } from "@/lib/store/studio";
import type { OptionSlot } from "@/lib/store/logic";

export function IteratePanel({ slot }: { slot: OptionSlot }) {
  const [text, setText] = useState("");
  const proposal = useStudio((s) => (s.proposal?.index === slot.index ? s.proposal : null));
  const status = useStudio((s) => s.proposalStatus);
  const error = useStudio((s) => s.proposalError);
  const apply = useStudio((s) => s.applyProposal);
  const set = useStudio((s) => s.set);
  const loading = status === "loading";
  const after = proposal ? previewProposal(slot) : null;
  const deltas = after ? deltaRows(slot.option, after) : [];
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="iterate-text" className="sr-only">Tell this option what to change</label>
      <Textarea
        id="iterate-text"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Tell this option what to change, e.g. pull the tower east, more light in the courtyard."
        className="min-h-14 rounded-sm bg-paper text-[13px]"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) void proposeChanges(slot.index, text.trim());
        }}
      />
      <Button size="sm" className="w-fit" disabled={!text.trim() || loading} onClick={() => void proposeChanges(slot.index, text.trim())}>
        {loading && <Spinner data-icon="inline-start" />}
        Propose changes
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {proposal && (
        <section aria-label="Proposed changes" className="flex flex-col gap-2 border border-rule bg-paper p-2.5">
          <h4 className="font-medium">Proposed changes ({proposal.changes.length})</h4>
          {proposal.source === "builtin" && <p className="text-ink-3">Built-in keyword rules (no AI).</p>}
          <ul className="flex flex-col gap-1.5">
            {proposal.changes.map((c) => {
              const spec = PARAM_SPEC_BY_KEY[c.key];
              return (
                <li key={c.key}>
                  <span>{spec?.label ?? c.key}: </span>
                  <span className="num">
                    {c.from === undefined ? "?" : paramValueLabel(c.from, spec?.unit ?? "")} → {paramValueLabel(c.to, spec?.unit ?? "")}
                  </span>
                  {c.reason && <div className="text-ink-3">{c.reason}</div>}
                </li>
              );
            })}
          </ul>
          {deltas.length > 0 && (
            <Table className="text-xs">
              <caption className="sr-only">Metrics before and after the proposed changes, computed by the geometry engine.</caption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="h-7 px-1">Metric</TableHead>
                  <TableHead scope="col" className="h-7 px-1 text-right">Before</TableHead>
                  <TableHead scope="col" className="h-7 px-1 text-right">After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deltas.map((d) => (
                  <TableRow key={d.label}>
                    <TableHead scope="row" className="h-auto px-1 py-1 font-normal">{d.label}</TableHead>
                    <TableCell className="num px-1 py-1 text-right">{d.before}</TableCell>
                    <TableCell className={"num px-1 py-1 text-right " + (d.changed ? "font-medium" : "")}>{d.after}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                const err = apply(nowLabel());
                if (err) set({ proposalError: err, proposalStatus: "error" });
                else setText("");
              }}
            >
              Apply changes
            </Button>
            <Button size="sm" variant="outline" onClick={() => set({ proposal: null })}>Discard</Button>
          </div>
        </section>
      )}
    </div>
  );
}

export function HistoryList({ slot }: { slot: OptionSlot }) {
  const undo = useStudio((s) => s.undo);
  const items = [...slot.history].reverse();
  return (
    <div className="flex flex-col gap-2">
      <Button size="sm" variant="outline" className="w-fit" disabled={items.length === 0} onClick={() => undo(slot.index)}>
        <Undo2 data-icon="inline-start" />
        Undo
        <kbd className="num ml-1 text-ink-3">⌘Z</kbd>
      </Button>
      {items.length === 0 ? (
        <p className="text-ink-3">No changes yet.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {items.map((h) => (
            <li key={h.id} className="text-ink-3">
              <span className="num">{h.at}</span> · {h.instruction}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
