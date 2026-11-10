export interface ZrParagraph {
  /** Unique within the section: "<sectionId>-p<n>". */
  anchor: string;
  /** Leading paragraph label as printed, e.g. "(a)", if any. */
  label?: string;
  text: string;
}

export interface ZrTable {
  caption: string;
  /** Header rows, expanded across colspan/rowspan so every row has the same number of leaf columns. */
  headers: string[][];
  /** Body rows, expanded the same way. */
  rows: string[][];
  footnotes: string[];
}

export interface ZrBlockRef {
  type: "paragraph" | "table";
  index: number;
}

export interface ZrSection {
  id: string;
  title: string;
  article: string; // roman numeral, e.g. "II"
  chapter: string; // e.g. "3"
  url: string;
  lastAmended: string | null; // as printed, e.g. "12/5/2024"
  districtsIndicated: string[];
  parent: string | null;
  breadcrumbs: string[];
  text: string;
  paragraphs: ZrParagraph[];
  tables: ZrTable[];
  /** Document order of paragraphs and tables. */
  blocks: ZrBlockRef[];
}

export interface ZrDefinition {
  term: string;
  text: string;
  lastAmended?: string;
  anchor: string;
  /** e.g. "General Definition" or "Applicable to Article I - Chapter 3" */
  applicability?: string;
}

export interface ZrChunk {
  chunkId: string;
  sectionId: string;
  anchor: string;
  text: string;
  parentSectionText?: string;
  breadcrumbs: string[];
  lastAmended: string | null;
  url: string;
}
