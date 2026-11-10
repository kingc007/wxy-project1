"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Citation } from "@/lib/types";
import { formatLocalDate } from "@/lib/export/dates";

export interface Verification { name: string; date: string }

interface BriefUi {
  openCitation: (c: Citation) => void;
  /** current reviewer name, "" until entered */
  reviewer: string;
  setReviewer: (n: string) => void;
  verified: Record<string, Verification>;
  verify: (key: string, name: string) => void;
  unverify: (key: string) => void;
  assumptionOriginals: Record<string, string | boolean>;
}

const Ctx = createContext<BriefUi | null>(null);
export function useBriefUi(): BriefUi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBriefUi outside BriefUiProvider");
  return v;
}

const LS_NAME = "wxy.sitebrief.reviewer";
const LS_VERIFIED = "wxy.sitebrief.verified";

function readLs<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function readStoredReviewer(): string | undefined {
  const v = readLs<string>(LS_NAME, "");
  return v || undefined;
}
function writeLs(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable: state-only */ }
}

export function BriefUiProvider({
  children, bbl, onOpenCitation, assumptionOriginals,
}: { children: ReactNode; bbl: string | null; onOpenCitation: (c: Citation) => void; assumptionOriginals: Record<string, string | boolean> }) {
  const [reviewer, setReviewerState] = useState("");
  const [all, setAll] = useState<Record<string, Verification>>({});

  useEffect(() => {
    // Hydrate from localStorage after mount (client-only data).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReviewerState(readLs<string>(LS_NAME, ""));
    setAll(readLs<Record<string, Verification>>(LS_VERIFIED, {}));
  }, []);

  const setReviewer = useCallback((n: string) => { setReviewerState(n); writeLs(LS_NAME, n); }, []);
  const verify = useCallback((key: string, name: string) => {
    setAll((prev) => {
      const next = { ...prev, [`${bbl}:${key}`]: { name, date: formatLocalDate(new Date()) } };
      writeLs(LS_VERIFIED, next);
      return next;
    });
  }, [bbl]);
  const unverify = useCallback((key: string) => {
    setAll((prev) => {
      const next = { ...prev };
      delete next[`${bbl}:${key}`];
      writeLs(LS_VERIFIED, next);
      return next;
    });
  }, [bbl]);

  const verified = useMemo(() => {
    const out: Record<string, Verification> = {};
    const prefix = `${bbl}:`;
    for (const [k, v] of Object.entries(all)) if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
    return out;
  }, [all, bbl]);

  const value = useMemo<BriefUi>(
    () => ({ openCitation: onOpenCitation, reviewer, setReviewer, verified, verify, unverify, assumptionOriginals }),
    [onOpenCitation, reviewer, setReviewer, verified, verify, unverify, assumptionOriginals],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
