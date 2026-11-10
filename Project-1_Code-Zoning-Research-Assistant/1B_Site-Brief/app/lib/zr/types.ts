// Contract for the ZR corpus layer in 1B (manager-owned). Implemented in lib/zr/*; consumed by the brief UI.
import type { Citation } from "../types";

export interface ZrParagraph { anchor: string; label?: string | null; text: string }
export interface ZrTable { caption?: string | null; headers: string[][]; rows: string[][]; footnotes: string[] }
export interface ZrSection {
  id: string; // "23-22"
  title: string;
  article: string;
  chapter: string;
  url: string;
  lastAmended: string | null;
  breadcrumbs: string[];
  paragraphs: ZrParagraph[];
  tables: ZrTable[];
  text: string;
  parent?: string | null;
  /** document order of paragraphs/tables, as ingested */
  blocks?: { type: "paragraph" | "table"; index: number }[];
}

/** Location of a quote inside a section, for highlighting in the Source pane. */
export interface QuoteLocation {
  sectionId: string;
  /** paragraph anchor or "t<n>" (table index) or "t<n>r<m>" (table row) where the quote was found; null if not found */
  where: string | null;
  found: boolean;
}

export type UseStatus = "as_of_right" | "limited" | "special_permit" | "not_permitted" | "mixed" | "unknown";

/** One Use Group summarised for one district column of the official use tables. */
export interface UseGroupSummary {
  useGroup: string; // "II"
  title: string; // "Residences"
  column: string; // table column used, e.g. "R6" or "C2" or "M1"
  status: UseStatus; // derived in code from the symbols (● ♦ ○ –) of all rows in that column
  counts: { asOfRight: number; limited: number; specialPermit: number; notPermitted: number };
  /** up to 3 example rows, each cited with the verbatim row text as quote */
  examples: { use: string; symbol: string; citation: Citation }[];
  citation: Citation; // the use-group section (e.g. 22-12) with its intro sentence as quote
  note?: string | null; // e.g. "No Use Group VI section in Article II Chapter 2"
}

export interface SourcePaneProps {
  open: boolean;
  citation: Citation | null; // section + quote to highlight
  onClose: () => void;
}
