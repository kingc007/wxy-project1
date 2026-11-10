"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ExternalLink, Info, X } from "lucide-react";
import { documentToLocatable, zrToDocument } from "@/lib/shared/zr/source-doc";
import { findSpan, locateQuote, splitFragments } from "@/lib/shared/zr/locate";
import type {
  QuoteLocation,
  SourceCitation,
  SourceDocument,
  SourceLoadResult,
  SourcePaneProps,
  ZrParagraph,
  ZrTable,
} from "@/lib/shared/zr/types";

// GENERATED copy: edit in shared/ui. Renders either a ZR section from an API (default loader, 1B's /api/clause
// contract) or any generic chunk document via `loader` / `document`.

type Loaded =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; doc: SourceDocument; location: QuoteLocation | null };

const HIGHLIGHT_FADE_S = 0.18;

/** Default loader: the ZR section API. */
async function zrLoader(citation: SourceCitation, signal: AbortSignal): Promise<SourceLoadResult> {
  const qs = new URLSearchParams({ id: citation.section });
  if (citation.quote) qs.set("quote", citation.quote);
  const res = await fetch(`/api/clause?${qs}`, { signal });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
  return { document: zrToDocument(body.section), location: body.location ?? null };
}

/** Merge runs of identical adjacent cells (colspan expanded by the ingester) back into spans. */
function mergeRuns(cells: string[]): { text: string; span: number }[] {
  const out: { text: string; span: number }[] = [];
  for (const c of cells) {
    const last = out[out.length - 1];
    if (last && last.text === c) last.span++;
    else out.push({ text: c, span: 1 });
  }
  return out;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "the source page";
  }
}

export function SourcePane({ open, citation, onClose, loader, document: preloaded, breadcrumbLabel }: SourcePaneProps) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Focus management: remember the trigger, move focus into the pane, restore on close.
  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      const t = triggerRef.current;
      if (t && t.isConnected) t.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const panelMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
    : {
        initial: { x: "100%" },
        animate: { x: 0 },
        exit: { x: "100%" },
        transition: { type: "spring" as const, bounce: 0, duration: 0.4 },
      };

  const refLabel = citation?.refLabel ?? (citation ? `ZR ${citation.section}` : "");
  return (
    <AnimatePresence>
      {open && citation && (
        <>
          {/* Scrim only where the pane is an overlay sheet (<1024px). */}
          <motion.div
            key="scrim"
            aria-hidden="true"
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/30 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
          <motion.aside
            key="pane"
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="false"
            aria-label={`Source: ${refLabel}`}
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-rule-strong bg-paper text-ink outline-none sm:w-[480px] sm:max-w-full"
            style={{ boxShadow: "-1px 0 0 var(--rule)" }}
            {...panelMotion}
          >
            <PaneBody
              key={`${citation.section}\u0000${citation.quote}`}
              citation={citation}
              refLabel={refLabel}
              loader={loader ?? zrLoader}
              preloaded={preloaded ?? null}
              breadcrumbLabel={breadcrumbLabel ?? "Location in the source document"}
              onClose={onClose}
              reduce={!!reduce}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function locate(doc: SourceDocument, citation: SourceCitation, given?: QuoteLocation | null): QuoteLocation | null {
  if (given) return given;
  if (!citation.quote) return null;
  const found = locateQuote(documentToLocatable(doc), citation.quote);
  if (found.found) return found;
  // Fall back to a caller-supplied anchor when the quote text cannot be matched.
  const hit = citation.anchor && doc.blocks.some((b) => "anchor" in b && b.anchor === citation.anchor);
  return hit ? { sectionId: doc.id, where: citation.anchor ?? null, found: true } : found;
}

function PaneBody({
  citation,
  refLabel,
  loader,
  preloaded,
  breadcrumbLabel,
  onClose,
  reduce,
}: {
  citation: SourceCitation;
  refLabel: string;
  loader: NonNullable<SourcePaneProps["loader"]>;
  preloaded: SourceDocument | null;
  breadcrumbLabel: string;
  onClose: () => void;
  reduce: boolean;
}) {
  const [state, setState] = useState<Loaded>(
    preloaded ? { status: "ready", doc: preloaded, location: locate(preloaded, citation) } : { status: "loading" },
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Latest props via refs so a re-render with a new object identity does not refetch.
  const loaderRef = useRef(loader);
  const citationRef = useRef(citation);
  useEffect(() => {
    loaderRef.current = loader;
    citationRef.current = citation;
  });

  useEffect(() => {
    if (preloaded) return;
    const ctl = new AbortController();
    const c = citationRef.current;
    loaderRef.current(c, ctl.signal)
      .then((r) => setState({ status: "ready", doc: r.document, location: locate(r.document, c, r.location) }))
      .catch((err: unknown) => {
        if (ctl.signal.aborted) return;
        setState({ status: "error", message: err instanceof Error ? err.message : "Request failed" });
      });
    return () => ctl.abort();
  }, [citation.section, citation.quote, preloaded]);

  const doc = state.status === "ready" ? state.doc : undefined;
  const location = state.status === "ready" ? state.location : null;
  const url = doc?.url ?? citation.url ?? null;
  const lastAmended = doc?.lastAmended ?? citation.lastAmended;
  const versionLabel = doc?.versionLabel ?? citation.versionLabel;
  const sample = !!doc?.sample;

  // Scroll the highlighted span into view once the body has rendered.
  const targetRef = useCallback(
    (el: HTMLElement | null) => {
      if (el) el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    },
    [reduce],
  );

  const crumbs = doc?.breadcrumbs ?? [];
  return (
    <>
      <header className="shrink-0 border-b border-rule-strong px-5 pb-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <nav aria-label={breadcrumbLabel} className="min-w-0 pt-2.5">
            <ol className="flex flex-wrap items-center gap-x-1.5 text-xs leading-5 text-ink-3">
              {crumbs.length === 0 && <li>Source</li>}
              {crumbs.map((c, i) => (
                <li key={`${c}-${i}`} className="flex items-center gap-1.5">
                  {i > 0 && <span aria-hidden="true">›</span>}
                  <span>{c}</span>
                </li>
              ))}
            </ol>
          </nav>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close source pane"
            className="-mr-2 grid size-11 shrink-0 place-items-center rounded-[2px] text-ink-2 transition-transform duration-100 hover:bg-accent-wash hover:text-ink active:scale-[0.98] motion-reduce:active:scale-100 lg:size-9"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 font-mono text-xs tabular text-signal">{refLabel}</p>
        <h2 className="mt-0.5 text-xl font-medium leading-tight tracking-[-0.01em]">
          {doc?.title ?? citation.title ?? "Loading…"}
        </h2>
        <p className="mt-2 text-[0.8125rem] text-ink-2">
          {sample
            ? "SAMPLE document, not an official source"
            : versionLabel
              ? versionLabel
              : lastAmended
                ? `Last amended ${lastAmended}`
                : "Last amended date not shown on the source page"}
        </p>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex min-h-6 items-center gap-1 text-[0.8125rem] text-signal underline underline-offset-2"
          >
            Open on {hostOf(url)}
            <ExternalLink className="size-3.5" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-5" aria-live="polite" aria-busy={state.status === "loading"}>
        {state.status === "loading" && <p className="text-sm text-ink-3">Loading the source text…</p>}

        {state.status === "error" && (
          <Notice>
            Couldn’t load this source from the ingested text ({state.message}). Open the official page to check.
          </Notice>
        )}

        {state.status === "ready" && (
          <>
            {location && !location.found && (
              <div className="mb-5">
                <Notice>Quote not located in the ingested text. Open the official page to check.</Notice>
                <blockquote className="mt-3 border-l-2 border-rule-strong pl-3 text-[0.8125rem] leading-relaxed text-ink-2">
                  <span className="title-block-label block">Cited text</span>
                  {citation.quote}
                </blockquote>
              </div>
            )}
            <DocumentBody
              doc={state.doc}
              where={location?.found ? location.where : null}
              quote={citation.quote}
              reduce={reduce}
              targetRef={targetRef}
            />
          </>
        )}
      </div>
    </>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="note" className="flex items-start gap-2 border border-rule-strong bg-paper-2 px-3 py-2.5 text-[0.8125rem] leading-relaxed text-ink-2">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

function DocumentBody({
  doc,
  where,
  quote,
  reduce,
  targetRef,
}: {
  doc: SourceDocument;
  where: string | null;
  quote: string;
  reduce: boolean;
  targetRef: (el: HTMLElement | null) => void;
}) {
  let tableIndex = -1;
  return (
    <div className="space-y-4">
      {doc.blocks.map((b, i) => {
        if ("table" in b) {
          tableIndex++;
          return <Table key={`t${tableIndex}`} table={b.table} index={tableIndex} where={where} reduce={reduce} targetRef={targetRef} />;
        }
        return <Paragraph key={`${b.anchor}-${i}`} p={b} hit={where === b.anchor} quote={quote} reduce={reduce} targetRef={targetRef} />;
      })}
    </div>
  );
}

function highlightMotion(reduce: boolean) {
  return {
    initial: { backgroundColor: "rgba(0, 0, 0, 0)" },
    animate: { backgroundColor: "var(--accent-wash)" },
    transition: { duration: reduce ? 0 : HIGHLIGHT_FADE_S, ease: "easeOut" as const },
  };
}

function Paragraph({
  p,
  hit,
  quote,
  reduce,
  targetRef,
}: {
  p: ZrParagraph;
  hit: boolean;
  quote: string;
  reduce: boolean;
  targetRef: (el: HTMLElement | null) => void;
}) {
  const span = hit ? splitFragments(quote).map((f) => findSpan(p.text, f)).find(Boolean) ?? null : null;
  const text = p.text;
  return (
    <p id={p.anchor} className="max-w-[72ch] whitespace-pre-line text-base leading-[1.55]">
      {p.label && <span className="mr-2 font-mono text-[0.8125rem] text-ink-3">{p.label}</span>}
      {hit && span ? (
        <>
          {text.slice(0, span.start)}
          <motion.mark
            ref={targetRef}
            data-source-highlight=""
            className="text-ink"
            {...highlightMotion(reduce)}
          >
            {text.slice(span.start, span.end)}
          </motion.mark>
          {text.slice(span.end)}
        </>
      ) : hit ? (
        <motion.mark ref={targetRef} data-source-highlight="" className="text-ink" {...highlightMotion(reduce)}>
          {text}
        </motion.mark>
      ) : (
        text
      )}
    </p>
  );
}

function Table({
  table,
  index,
  where,
  reduce,
  targetRef,
}: {
  table: ZrTable;
  index: number;
  where: string | null;
  reduce: boolean;
  targetRef: (el: HTMLElement | null) => void;
}) {
  const tableHit = where === `t${index}`;
  const label = table.caption || `Table ${index + 1}`;
  return (
    <div
      role="region"
      aria-label={`${label}, scrolls sideways`}
      tabIndex={0}
      className={`overflow-x-auto border border-rule ${tableHit ? "bg-accent-wash" : ""}`}
      data-source-highlight={tableHit ? "" : undefined}
      ref={tableHit ? targetRef : undefined}
    >
      <table className="w-full min-w-max border-collapse text-left text-[0.8125rem] leading-[1.3] tabular">
        {table.caption && <caption className="border-b border-rule bg-paper-2 px-3 py-2 text-left font-medium">{table.caption}</caption>}
        <thead className="bg-paper-2">
          {table.headers.map((row, ri) => (
            <tr key={ri} className="border-b border-rule">
              {mergeRuns(row).map((c, ci) => (
                <th
                  key={ci}
                  scope={c.span > 1 ? "colgroup" : "col"}
                  colSpan={c.span}
                  className={`whitespace-pre-line px-3 py-2 align-bottom font-medium ${c.span > 1 ? "text-ink-2" : ""}`}
                >
                  {c.text}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.rows.map((row, ri) => {
            const hit = where === `t${index}r${ri}`;
            const banner = row.length > 1 && row.every((c) => c === row[0]);
            const cls = "border-b border-rule last:border-b-0";
            const cells = banner ? (
              <th scope="colgroup" colSpan={row.length} className="bg-paper-2 px-3 py-2 text-left font-medium">
                {row[0]}
              </th>
            ) : (
              row.map((c, ci) =>
                ci === 0 ? (
                  <th key={ci} scope="row" className="min-w-40 px-3 py-2.5 align-top font-normal">
                    {c}
                  </th>
                ) : (
                  <td key={ci} className="whitespace-pre-line px-3 py-2.5 align-top font-mono">
                    {c}
                  </td>
                ),
              )
            );
            return hit ? (
              <motion.tr
                key={ri}
                ref={targetRef}
                data-source-highlight=""
                className={cls}
                {...highlightMotion(reduce)}
              >
                {cells}
              </motion.tr>
            ) : (
              <tr key={ri} className={cls}>
                {cells}
              </tr>
            );
          })}
        </tbody>
      </table>
      {table.footnotes.length > 0 && (
        <ul className="space-y-1 border-t border-rule px-3 py-2 text-xs leading-snug text-ink-2">
          {table.footnotes.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
