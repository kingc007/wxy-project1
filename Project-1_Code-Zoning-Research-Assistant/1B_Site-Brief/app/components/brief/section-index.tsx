"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type MetaTone = "ok" | "warn" | "flag" | "neutral";

export interface IndexItem {
  /** element id of the section to scroll to */
  id: string;
  label: string;
  /** short count shown under (wide) or beside (narrow) the label, e.g. "2 of 5 reviewed" */
  meta?: { text: string; tone: MetaTone };
}

const META_TONE: Record<MetaTone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  flag: "text-flag",
  neutral: "text-ink-2",
};

/** The section currently in the upper part of the viewport. Observed, never timed. */
export function useActiveSection(ids: string[]): [string, (id: string) => void] {
  const [active, setActive] = useState(ids[0] ?? "");
  const key = ids.join("|");
  useEffect(() => {
    const list = key.split("|").filter(Boolean);
    const els = list.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<string>();
    const pick = () => {
      // Pinned to the bottom of the page the last sections can never reach the reading line, so the last one wins.
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
      const hit = atBottom ? list[list.length - 1] : [...list].reverse().find((id) => visible.has(id));
      if (hit) setActive(hit);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id); else visible.delete(e.target.id);
        }
        pick();
      },
      // A thin line a fifth of the way down the viewport: the section crossing it is "current".
      { rootMargin: "-20% 0px -79% 0px" },
    );
    els.forEach((el) => io.observe(el));
    window.addEventListener("scroll", pick, { passive: true });
    return () => { io.disconnect(); window.removeEventListener("scroll", pick); };
  }, [key]);
  return [active, setActive];
}

/**
 * In-page section index. Below 1280px it is a horizontally scrollable bar pinned to the top of the memo; from 1280px up it
 * is a slim list pinned beside the memo. Same markup either way, only the layout changes.
 */
export function SectionIndex({ items }: { items: IndexItem[] }) {
  const [active, setActive] = useActiveSection(items.map((i) => i.id));
  const listRef = useRef<HTMLOListElement>(null);
  // In the narrow bar, keep the current item in view (horizontal only; the page itself is never scrolled from here).
  useEffect(() => {
    const ol = listRef.current;
    const a = ol?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!ol || !a || ol.scrollWidth <= ol.clientWidth) return;
    ol.scrollTo({ left: a.offsetLeft - ol.clientWidth / 2 + a.offsetWidth / 2, behavior: "auto" });
  }, [active]);
  return (
    <nav
      aria-label="Brief sections"
      className="sticky top-0 z-20 -mx-5 -mt-5 border-b border-rule bg-sheet px-5 md:-mx-8 md:-mt-8 md:px-8 xl:top-6 xl:z-auto xl:mx-0 xl:mt-0 xl:self-start xl:border-0 xl:bg-transparent xl:px-0"
    >
      <ol ref={listRef} className="relative flex gap-1 overflow-x-auto py-1 xl:flex-col xl:gap-0.5 xl:overflow-visible xl:py-0">
        {items.map((it, i) => {
          const current = it.id === active;
          return (
            <li key={it.id} className="shrink-0">
              <a
                href={`#${it.id}`}
                aria-current={current ? "location" : undefined}
                onClick={() => setActive(it.id)}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-md px-3 py-1 text-[0.875rem] leading-tight xl:min-h-10 xl:flex-col xl:items-start xl:justify-center xl:gap-0 xl:px-3",
                  current ? "bg-paper-2 font-semibold text-ink" : "text-ink-2 hover:bg-paper-2 hover:text-ink",
                )}
              >
                <span className="whitespace-nowrap xl:whitespace-normal">
                  <span aria-hidden="true" className="tabular mr-1.5 text-ink-3">{i + 1}</span>
                  {it.label}
                </span>
                {it.meta && (
                  <span className={cn("tabular whitespace-nowrap text-[0.8125rem] font-medium xl:pl-[1.05rem]", META_TONE[it.meta.tone])}>
                    {it.meta.text}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
