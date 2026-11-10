"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { SPRING } from "@/lib/motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Suggestion { label: string; bbl: string }

export interface AddressInputProps {
  /** Called with the text to look up: the typed text, or the BBL of a chosen suggestion. */
  onSubmit: (query: string, label?: string) => void;
  busy?: boolean;
  /** Controlled text, so example chips can fill the field. */
  value: string;
  onValueChange: (v: string) => void;
  /** "hero": the large first-screen field. "bar": the header-bar field. The field frame morphs between them (layoutId). */
  variant?: "hero" | "bar";
}

/** Single address/BBL field with a debounced (200 ms) autocomplete listbox. A raw 10-digit BBL is accepted as is. */
export function AddressInput({ onSubmit, busy = false, value, onValueChange, variant = "bar" }: AddressInputProps) {
  const hero = variant === "hero";
  const listId = useId();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const shown = open && value.trim().length >= 3;
  const [announce, setAnnounce] = useState("");
  const skipNext = useRef(false);
  // Suggestions are only fetched for text the user typed; submit, selection and example chips clear it.
  const typed = useRef(false);
  const acRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    if (!typed.current) return;
    const q = value.trim();
    if (q.length < 3) return; // list is hidden below 3 chars via `shown`
    const t = setTimeout(async () => {
      acRef.current?.abort();
      const ac = (acRef.current = new AbortController());
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: ac.signal });
        const json = (await res.json()) as { results?: Suggestion[] };
        if (!typed.current) return;
        const list = (json.results ?? []).map((r) => ({ label: r.label, bbl: r.bbl }));
        setItems(list);
        setActive(-1);
        setOpen(list.length > 0);
        setAnnounce(list.length ? `${list.length} suggestions available. Use the up and down arrow keys.` : "");
      } catch {
        if (!ac.signal.aborted) { setItems([]); setOpen(false); }
      }
    }, 200);
    return () => clearTimeout(t);
  }, [value]);

  function close() {
    typed.current = false;
    acRef.current?.abort();
    setOpen(false);
    setItems([]);
    setActive(-1);
  }

  function choose(s: Suggestion) {
    skipNext.current = true;
    close();
    onValueChange(s.label);
    onSubmit(s.bbl, s.label);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && items.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp" && items.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Enter" && open && active >= 0) {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      close();
    }
  }

  return (
    <form
      role="search"
      className="relative flex w-full flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        close();
        onSubmit(value.trim());
      }}
    >
      <label htmlFor="address" className="sr-only">NYC address or 10-digit BBL</label>
      <div className="relative flex-1">
        {/* The frame is the shared element: it carries the border and fill, so only an empty box is scaled while it morphs. */}
        <motion.div
          layoutId="address-frame"
          transition={SPRING}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-md border border-rule-strong bg-sheet"
        />
        <Input
          id="address"
          name="address"
          role="combobox"
          aria-expanded={shown}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => { typed.current = true; onValueChange(e.target.value); }}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(close, 120)}
          placeholder="Enter an NYC address or 10-digit BBL"
          className={cn(
            "relative z-10 w-full rounded-md border-0 bg-transparent font-sans shadow-none dark:bg-transparent",
            hero ? "h-16 px-4 text-[17px] leading-none sm:px-5 sm:text-[22px] md:text-[22px]" : "h-12 px-4 text-base md:text-base",
          )}
        />
        <ul
          id={listId}
          role="listbox"
          aria-label="Address suggestions"
          hidden={!shown}
          className="material absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-auto [--material-alpha:92%]"
        >
          {items.map((s, i) => (
            <li
              key={s.bbl + s.label}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); choose(s); }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-between gap-3 border-b border-rule px-3 py-2 text-[0.875rem] last:border-b-0",
                i === active && "bg-accent-wash outline outline-2 -outline-offset-2 outline-signal",
              )}
            >
              <span>{s.label}</span>
              <span className="tabular font-mono text-[0.8125rem] text-ink-3">BBL {s.bbl}</span>
            </li>
          ))}
        </ul>
        <span className="sr-only" role="status" aria-live="polite">{announce}</span>
      </div>
      <Button type="submit" className={cn("font-medium", hero ? "h-16 px-8 text-base" : "h-12 px-6 text-base")} disabled={value.trim() === "" || busy}>
        {busy && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        Draft brief
      </Button>
    </form>
  );
}
