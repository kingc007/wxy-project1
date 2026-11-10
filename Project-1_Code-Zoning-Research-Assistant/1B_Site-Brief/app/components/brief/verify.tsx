"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useBriefUi } from "./context";

/** "Mark verified" -> "Verified by {name} · {date}". Asks for a name once ("Your name or initials"). */
export function VerifyButton({ claimKey, subject, compact = false }: { claimKey: string; subject: string; compact?: boolean }) {
  const { reviewer, setReviewer, verified, verify, unverify } = useBriefUi();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const v = verified[claimKey];
  const size = compact ? "h-8 px-2 text-[0.8125rem]" : "h-10 px-3 text-[0.875rem]";

  if (v) {
    return (
      <Button
        type="button"
        variant="ghost"
        aria-pressed="true"
        title="Click to clear this verification"
        onClick={() => unverify(claimKey)}
        className={`${size} rounded-md font-normal text-ink`}
      >
        <Check className="size-3.5" aria-hidden="true" />
        <span>Verified by {v.name} on <span className="tabular">{v.date}</span></span>
        <span className="sr-only">: {subject}. Activate to clear.</span>
      </Button>
    );
  }
  const quiet = `${compact ? "h-8 px-2" : "h-10 px-3"} rounded-md border-0 bg-transparent text-[0.8125rem] font-medium text-ink-2 underline decoration-ink-3 underline-offset-4 hover:bg-transparent hover:text-ink`;
  if (reviewer) {
    return (
      <Button type="button" variant="ghost" onClick={() => verify(claimKey, reviewer)} className={quiet}>
        Mark verified<span className="sr-only">: {subject}</span>
      </Button>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" className={quiet}>
          Mark verified<span className="sr-only">: {subject}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 rounded-md border border-rule-strong bg-paper p-3 shadow-none ring-0">
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = draft.trim();
            if (!name) return;
            setReviewer(name);
            verify(claimKey, name);
            setOpen(false);
          }}
        >
          <label htmlFor={`rv-${claimKey}`} className="text-[0.8125rem] text-ink">Your name or initials</label>
          <Input id={`rv-${claimKey}`} value={draft} onChange={(e) => setDraft(e.target.value)} className="h-10 rounded-md" autoFocus />
          <Button type="submit" disabled={!draft.trim()} >Mark verified</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
