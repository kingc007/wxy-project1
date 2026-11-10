import type { AnyNode, Element } from "domhandler";
import type { CheerioAPI } from "cheerio";

/** Private-use sentinels marking where a table was lifted out of running text. */
export const TABLE_OPEN = "\uE000";
export const TABLE_CLOSE = "\uE001";

const SUP_DIGITS: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};

const toSupDigits = (d: string) => [...d].map((c) => SUP_DIGITS[c] ?? c).join("");

/**
 * Render the content of a <sup>. Marker-like content ("1", "1,2", "*") becomes superscript glyphs;
 * a short alphanumeric marker becomes "[x]"; if the author put a whole footnote inside <sup>
 * ("1 For lots ..."), the leading number becomes glyphs and the sentence is kept as normal text.
 */
export function superscript(raw: string): string {
  const t = raw.replace(/[\s\u00a0]+/g, " ").trim();
  if (!t) return "";
  if (/^[\d,;.*\s-]+$/.test(t)) return toSupDigits(t.replace(/\s+/g, ""));
  if (t.length <= 3 && /^[A-Za-z0-9]+$/.test(t)) return `[${t}]`;
  const m = /^(\d+)\s*(.+)$/.exec(t);
  if (m) return `${toSupDigits(m[1]!)} ${m[2]}`;
  return t;
}

const BLOCK_TAGS = new Set(["p", "div", "li", "ol", "ul", "tr", "table", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"]);

/** Counter label for an <ol> item, replicating the ZR site stylesheet counters. */
function olLabel(depth: number, index: number): string {
  const alpha = (n: number) => {
    let s = "";
    let k = n;
    while (k > 0) {
      k -= 1;
      s = String.fromCharCode(97 + (k % 26)) + s;
      k = Math.floor(k / 26);
    }
    return s;
  };
  const roman = (n: number) => {
    const map: [number, string][] = [[10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
    let s = "";
    let k = n;
    for (const [v, r] of map) while (k >= v) { s += r; k -= v; }
    return s;
  };
  // Stylesheet: depth1 alpha, depth2 numbers, depth3 romans, depth4 alpha, depth5 romans.
  const kind = [0, "a", "n", "r", "a", "r"][Math.min(depth, 5)];
  const v = kind === "a" ? alpha(index) : kind === "n" ? String(index) : roman(index);
  return `(${v})`;
}

/**
 * Convert a node to plain text with line breaks at block boundaries, <sup> mapped to glyphs,
 * and <ol> items prefixed with the label the site stylesheet would draw.
 */
export function nodeToText($: CheerioAPI, node: AnyNode, olDepth = 0, sink?: Element[]): string {
  if (node.type === "text") return node.data;
  if (node.type !== "tag") return "";
  const el = node as Element;
  const tag = el.name.toLowerCase();
  if (tag === "table" && sink) {
    sink.push(el);
    return `\n${TABLE_OPEN}${sink.length - 1}${TABLE_CLOSE}\n`;
  }
  if (tag === "script" || tag === "style") return "";
  if (tag === "br") return "\n";
  if (tag === "sup") return superscript($(el).text());
  if (tag === "ol") {
    const style = $(el).attr("style") ?? "";
    const m = /counter-reset:\s*alpha\s+(\d+)/.exec(style);
    let n = m ? Number(m[1]) : 0;
    const depth = olDepth + 1;
    let out = "\n";
    for (const child of el.children) {
      if (child.type === "tag" && (child as Element).name === "li") {
        n += 1;
        const inner = (child as Element).children.map((c) => nodeToText($, c, depth, sink)).join("");
        out += `\n${olLabel(depth, n)} ${inner}\n`;
      } else {
        out += nodeToText($, child, depth, sink);
      }
    }
    return out + "\n";
  }
  if (tag === "ul") {
    let out = "\n";
    for (const child of el.children) {
      if (child.type === "tag" && (child as Element).name === "li") {
        const inner = (child as Element).children.map((c) => nodeToText($, c, olDepth, sink)).join("");
        out += `\n• ${inner}\n`;
      } else out += nodeToText($, child, olDepth, sink);
    }
    return out + "\n";
  }
  const inner = el.children.map((c) => nodeToText($, c, olDepth, sink)).join("");
  return BLOCK_TAGS.has(tag) ? `\n${inner}\n` : inner;
}

/** Normalise whitespace: nbsp -> space, collapse runs inside lines, drop empty lines. */
export function cleanText(s: string): string {
  return s
    .replace(/[   ]/g, " ")
    .split("\n")
    .map((l) => l.replace(/[ \t\r\f\v]+/g, " ").trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

export function textOf($: CheerioAPI, el: AnyNode): string {
  return cleanText(nodeToText($, el));
}
