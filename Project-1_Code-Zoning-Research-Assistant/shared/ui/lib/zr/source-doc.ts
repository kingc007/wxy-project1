// Adapters between ZR sections and the generic SourceDocument. GENERATED copy: edit in shared/ui.
import type { Locatable, SourceDocument, ZrSection } from "./types";

/** Convert a ZR section (paragraphs + tables + optional block order) into a generic document. */
export function zrToDocument(section: ZrSection): SourceDocument {
  const order =
    section.blocks ?? [
      ...section.paragraphs.map((_, index) => ({ type: "paragraph" as const, index })),
      ...section.tables.map((_, index) => ({ type: "table" as const, index })),
    ];
  const blocks: SourceDocument["blocks"] = [];
  for (const b of order) {
    if (b.type === "paragraph") {
      const p = section.paragraphs[b.index];
      if (p) blocks.push({ anchor: p.anchor, label: p.label, text: p.text });
    } else {
      const t = section.tables[b.index];
      if (t) blocks.push({ table: t });
    }
  }
  return {
    id: section.id,
    title: section.title,
    breadcrumbs: section.breadcrumbs,
    lastAmended: section.lastAmended,
    url: section.url,
    blocks,
  };
}

/** View a document as something the quote locator can search. Table index = order of table blocks. */
export function documentToLocatable(doc: SourceDocument): Locatable {
  const paragraphs: Locatable["paragraphs"] = [];
  const tables: Locatable["tables"] = [];
  for (const b of doc.blocks) {
    if ("table" in b) tables.push(b.table);
    else paragraphs.push({ anchor: b.anchor, label: b.label, text: b.text });
  }
  return { id: doc.id, paragraphs, tables };
}
