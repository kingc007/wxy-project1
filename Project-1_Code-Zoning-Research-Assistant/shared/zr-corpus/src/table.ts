import type { CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";
import { textOf } from "./html-text.js";
import type { ZrTable } from "./types.js";

interface GridCell {
  text: string;
  bold: boolean;
  isTh: boolean;
  inThead: boolean;
}

/** True when every non-blank text node inside the cell sits inside <b>/<th> (or the cell is blank). */
function cellIsBold($: CheerioAPI, cell: Element): boolean {
  let sawText = false;
  let allBold = true;
  const walk = (n: AnyNode, bold: boolean) => {
    if (n.type === "text") {
      if (n.data.replace(/[\s ]+/g, "") !== "") {
        sawText = true;
        if (!bold) allBold = false;
      }
      return;
    }
    if (n.type !== "tag") return;
    const e = n as Element;
    const b = bold || e.name === "b" || e.name === "th" || /font-weight:\s*(bold|[6-9]00)/i.test($(e).attr("style") ?? "");
    for (const c of e.children) walk(c, b);
  };
  walk(cell, false);
  return sawText && allBold;
}

/** Expand a <table> into a rectangular grid, replicating spanned cells. */
export function expandTable($: CheerioAPI, table: Element): { grid: GridCell[][]; width: number; firstRowSpan: number } {
  let firstRowSpan = 1;
  const trs = $(table).find("tr").filter((_, tr) => $(tr).closest("table").get(0) === table).toArray();
  const grid: (GridCell | undefined)[][] = [];
  trs.forEach((tr, r) => {
    grid[r] ??= [];
    let c = 0;
    $(tr).children("td,th").each((_, cellNode) => {
      const cell = cellNode as Element;
      while (grid[r]![c]) c += 1;
      const colspan = Math.max(1, parseInt($(cell).attr("colspan") ?? "1", 10) || 1);
      const rowspan = Math.max(1, parseInt($(cell).attr("rowspan") ?? "1", 10) || 1);
      const gc: GridCell = {
        text: textOf($, cell),
        bold: cellIsBold($, cell),
        isTh: cell.name === "th",
        inThead: $(tr).parent().is("thead"),
      };
      if (r === 0) firstRowSpan = Math.max(firstRowSpan, rowspan);
      for (let dr = 0; dr < rowspan; dr++) {
        grid[r + dr] ??= [];
        for (let dc = 0; dc < colspan; dc++) grid[r + dr]![c + dc] = gc;
      }
      c += colspan;
    });
  });
  const width = Math.max(0, ...grid.map((row) => row.length));
  const full = grid
    .slice(0, trs.length)
    .map((row) => Array.from({ length: width }, (_, i) => row[i] ?? { text: "", bold: false, isTh: false, inThead: false }));
  return { grid: full, width, firstRowSpan };
}

/**
 * Split the grid into header rows and body rows. Header rows are rows in <thead>, or the leading
 * rows whose non-empty cells are all <th> or bold. At least one body row is always kept.
 */
export function parseTable($: CheerioAPI, table: Element, caption = ""): ZrTable {
  const { grid, firstRowSpan } = expandTable($, table);
  let h = 0;
  while (h < grid.length - 1) {
    const row = grid[h]!;
    const nonEmpty = row.filter((c) => c.text !== "");
    const headerish =
      row.every((c) => c.inThead) ||
      (nonEmpty.length > 0 && nonEmpty.every((c) => c.isTh || c.bold)) ||
      // Unstyled header: a leading row (max 3) with some text but no digits at all (superscripts ignored).
      (h < 3 && nonEmpty.length > 0 && nonEmpty.every((c) => !/\d/.test(c.text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ""))));
    if (!headerish) break;
    h += 1;
  }
  // Unstyled headers: a rowspan on the first row's cells marks the extent of the header block.
  if (firstRowSpan > 1) h = Math.max(h, Math.min(firstRowSpan, grid.length - 1));
  const strings = grid.map((row) => row.map((c) => c.text));
  return { caption, headers: strings.slice(0, h), rows: strings.slice(h), footnotes: [] };
}
