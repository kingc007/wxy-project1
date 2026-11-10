// Shared source-document types for the Source pane and the quote locator.
// Vendored into apps at lib/shared/zr/types.ts. GENERATED copy: edit in shared/ui.

export interface ZrParagraph { anchor: string; label?: string | null; text: string }
export interface ZrTable { caption?: string | null; headers: string[][]; rows: string[][]; footnotes: string[] }

/** What the locator needs: a section-shaped thing with paragraphs and tables. */
export interface Locatable {
  id: string;
  paragraphs: ZrParagraph[];
  tables: ZrTable[];
}

/** A ZR section as returned by 1B's /api/clause. */
export interface ZrSection extends Locatable {
  title: string;
  article: string;
  chapter: string;
  url: string;
  lastAmended: string | null;
  breadcrumbs: string[];
  text: string;
  parent?: string | null;
  /** document order of paragraphs/tables, as ingested */
  blocks?: { type: "paragraph" | "table"; index: number }[];
}

/** Location of a quote inside a document. `where` is a paragraph anchor, "t<n>" (table n) or "t<n>r<m>" (row m). */
export interface QuoteLocation {
  sectionId: string;
  where: string | null;
  found: boolean;
}

/** Generic block: a text paragraph with an anchor, or a table. Tables are indexed t0, t1... in order of appearance. */
export type SourceBlock =
  | { anchor: string; label?: string | null; text: string }
  | { table: ZrTable };

/** A generic chunk document (Zoning Resolution section, Building Code excerpt, SAMPLE memo...). */
export interface SourceDocument {
  id: string;
  title: string;
  breadcrumbs: string[];
  lastAmended?: string | null;
  /** e.g. "2022 NYC BC (LL 77 of 2023, eff. June 10, 2023)" or "SAMPLE" */
  versionLabel?: string | null;
  url?: string | null;
  /** true for synthetic documents: the pane labels them SAMPLE */
  sample?: boolean;
  blocks: SourceBlock[];
}

/** The citation the pane opens at. Structurally compatible with 1B's `Citation`. */
export interface SourceCitation {
  /** section id, e.g. "23-22" or "504.3" */
  section: string;
  quote: string;
  /** fallback anchor to highlight when the quote cannot be located */
  anchor?: string | null;
  /** shown above the title; defaults to `ZR ${section}` */
  refLabel?: string | null;
  title?: string | null;
  url?: string | null;
  lastAmended?: string | null;
  versionLabel?: string | null;
}

export interface SourceLoadResult {
  document: SourceDocument;
  /** if omitted the pane locates the quote itself */
  location?: QuoteLocation | null;
}

export interface SourcePaneProps {
  open: boolean;
  citation: SourceCitation | null;
  onClose: () => void;
  /**
   * Loads the document for a citation. Default: GET /api/clause?id=&quote= returning { section: ZrSection, location? }
   * (the 1B contract). Provide this to render chunk documents from another API.
   */
  loader?: (citation: SourceCitation, signal: AbortSignal) => Promise<SourceLoadResult>;
  /** Render a document you already have, skipping the loader. */
  document?: SourceDocument | null;
  /** accessible name of the breadcrumb nav, default "Location in the source document" */
  breadcrumbLabel?: string;
}
