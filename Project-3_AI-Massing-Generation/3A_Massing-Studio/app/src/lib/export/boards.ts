// Drawing-set sheet (one landscape SVG) with a 2x3 grid of axons, mini zoning tables and a title block.
import type { ComplianceRow, MassingOption, Polygon, RuleStatus } from "@wxy/massing";
import { fmtFar, fmtFt, fmtInt, fmtSf } from "@wxy/massing";
import { axonGroup } from "./svgAxon";
import { GRAPHITE, xmlEscape } from "./shared";

export interface BoardOption {
  index: number;
  name: string;
  intent: string;
  option: MassingOption; // metrics, overall, compliance, prisms
}

export interface BoardInput {
  envelopeId: string;
  options: BoardOption[]; // 1..6
  envelopeSummary: string; // e.g. "10,000 sf lot · R7A · max FAR 4.00"
  lot?: Polygon;
  context?: { polygon: Polygon; height: number }[];
  date: string; // passed in (keeps the function pure)
  sample: boolean;
  sheet?: string; // default "A-001"
  size?: [number, number]; // default 1600 x 1000
}

const SANS = "Archivo, 'Helvetica Neue', Arial, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace";
const GRAPHITE2 = "#5C6068";
const RULE = "#D5D3CC";
const FAIL = "#B3261E";
const REVIEW = "#8A5A00";
export const BOARD_FOOTER = "Metrics computed in code by the geometry engine, not the AI. Study-grade; verify with a zoning professional.";

/** Status as word + symbol (never colour only). */
export function statusMark(s: RuleStatus): { word: string; symbol: string } {
  switch (s) {
    case "pass":
      return { word: "Passes", symbol: "✓" };
    case "fail":
      return { word: "Fails", symbol: "✕" };
    case "review":
      return { word: "Review", symbol: "!" };
    default:
      return { word: "N/A", symbol: "–" };
  }
}

const ORDER: Record<RuleStatus, number> = { fail: 0, review: 1, pass: 2, na: 3 };

function trunc(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, Math.max(0, n - 1)).trimEnd() + "…";
}

const text = (x: number, y: number, s: string, o: { size?: number; weight?: number; fill?: string; mono?: boolean; anchor?: "start" | "end" | "middle" } = {}) =>
  `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-family="${o.mono ? MONO : SANS}" font-size="${o.size ?? 11}"${o.weight ? ` font-weight="${o.weight}"` : ""} fill="${o.fill ?? GRAPHITE}"${o.anchor ? ` text-anchor="${o.anchor}"` : ""}${o.mono ? ' font-variant-numeric="tabular-nums"' : ""}>${xmlEscape(s)}</text>`;

function statusFill(s: RuleStatus) {
  return s === "fail" ? FAIL : s === "review" ? REVIEW : GRAPHITE;
}

function zoningTable(rows: readonly ComplianceRow[], x: number, y: number, w: number, maxRows: number): { svg: string; height: number } {
  const sorted = [...rows].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const shown = sorted.slice(0, maxRows);
  const rowH = 15;
  const cols = { rule: x, allowed: x + w * 0.58, proposed: x + w * 0.79, status: x + w };
  const out: string[] = [];
  out.push(text(cols.rule, y + 11, "Rule", { size: 9.5, weight: 600, fill: GRAPHITE2 }));
  out.push(text(cols.allowed, y + 11, "Allowed", { size: 9.5, weight: 600, fill: GRAPHITE2, anchor: "end" }));
  out.push(text(cols.proposed, y + 11, "Proposed", { size: 9.5, weight: 600, fill: GRAPHITE2, anchor: "end" }));
  out.push(text(cols.status, y + 11, "Status", { size: 9.5, weight: 600, fill: GRAPHITE2, anchor: "end" }));
  out.push(`<line x1="${x}" y1="${y + 16}" x2="${x + w}" y2="${y + 16}" stroke="${GRAPHITE}" stroke-width="1"/>`);
  shown.forEach((r, i) => {
    const ry = y + 16 + (i + 1) * rowH - 4;
    const m = statusMark(r.status);
    out.push(text(cols.rule, ry, trunc(r.shortRule || r.rule, 22), { size: 10 }));
    out.push(text(cols.allowed, ry, trunc(r.allowed, 16), { size: 10, mono: true, anchor: "end" }));
    out.push(text(cols.proposed, ry, trunc(r.proposed, 11), { size: 10, mono: true, anchor: "end" }));
    out.push(text(cols.status, ry, `${m.symbol} ${m.word}`, { size: 10, weight: r.status === "pass" ? 400 : 700, fill: statusFill(r.status), anchor: "end" }));
    out.push(`<line x1="${x}" y1="${y + 16 + (i + 1) * rowH}" x2="${x + w}" y2="${y + 16 + (i + 1) * rowH}" stroke="${RULE}" stroke-width="0.5"/>`);
  });
  let height = 16 + shown.length * rowH;
  if (sorted.length > shown.length) {
    out.push(text(x, y + height + 11, `+ ${sorted.length - shown.length} more rules in the app`, { size: 9.5, fill: GRAPHITE2 }));
    height += 14;
  }
  return { svg: out.join(""), height };
}

export function boardSvg(input: BoardInput): string {
  const [W, H] = input.size ?? [1600, 1000];
  const M = 40;
  const sideW = 280;
  const gridX = M;
  const gridY = M + 8;
  const gridW = W - 2 * M - sideW - 24;
  const footerH = 24;
  const gridH = H - gridY - M - footerH;
  const cols = 3;
  const rows = 2;
  const gap = 20;
  const cellW = (gridW - gap * (cols - 1)) / cols;
  const cellH = (gridH - gap * (rows - 1)) / rows;
  const sheet = input.sheet ?? "A-001";
  const title = `Massing Studio — ${input.envelopeId}`;
  const o: string[] = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${xmlEscape(title)}">`);
  o.push(`<title>${xmlEscape(title)}</title>`);
  o.push(`<rect width="${W}" height="${H}" fill="#F6F5F1"/>`);
  o.push(`<rect x="${M / 2}" y="${M / 2}" width="${W - M}" height="${H - M}" fill="#FFFFFF" stroke="${GRAPHITE}" stroke-width="1.5"/>`);

  input.options.slice(0, 6).forEach((b, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = gridX + c * (cellW + gap);
    const y = gridY + r * (cellH + gap);
    const m = b.option.metrics;
    const mk = statusMark(b.option.overall.status);
    o.push(`<g>`);
    o.push(`<line x1="${x}" y1="${y}" x2="${x + cellW}" y2="${y}" stroke="${GRAPHITE}" stroke-width="1"/>`);
    o.push(text(x, y + 18, `Option ${b.index} · ${trunc(b.name, 34)}`, { size: 14, weight: 600 }));
    o.push(text(x + cellW, y + 18, `${mk.symbol} ${mk.word}`, { size: 11, weight: 700, fill: statusFill(b.option.overall.status), anchor: "end" }));
    const axonH = cellH * 0.5;
    o.push(`<g transform="translate(${x.toFixed(2)} ${(y + 26).toFixed(2)})"><clipPath id="clip-${b.index}"><rect width="${cellW.toFixed(2)}" height="${axonH.toFixed(2)}"/></clipPath><g clip-path="url(#clip-${b.index})">${axonGroup(b.option.prisms, {
      size: [cellW, axonH],
      style: "model",
      theme: "light",
      lot: input.lot,
      context: input.context,
      padding: 14,
      idPrefix: `b${b.index}`,
    })}</g></g>`);
    let ty = y + 26 + axonH + 14;
    o.push(text(x, ty, trunc(b.intent, 76), { size: 10.5, fill: GRAPHITE2 }));
    ty += 15;
    o.push(
      text(x, ty, `GFA ${fmtSf(m.gfa)} · FAR ${fmtFar(m.far)} · ${fmtFt(m.height)} · ${fmtInt(m.floors)} floors · ${fmtInt(m.unitsEst)} units`, {
        size: 10,
        mono: true,
      }),
    );
    ty += 8;
    const maxRows = Math.max(3, Math.floor((y + cellH - ty - 30) / 15));
    o.push(zoningTable(b.option.compliance, x, ty, cellW, Math.min(maxRows, 6)).svg);
    o.push(`</g>`);
  });

  // right column: envelope summary, legend, title block
  const sx = W - M - sideW;
  o.push(`<line x1="${sx - 12}" y1="${gridY}" x2="${sx - 12}" y2="${H - M - footerH}" stroke="${RULE}" stroke-width="1"/>`);
  o.push(text(sx, gridY + 18, "Site and envelope", { size: 14, weight: 600 }));
  wrapLines(input.envelopeSummary, 38).forEach((l, i) => o.push(text(sx, gridY + 38 + i * 15, l, { size: 11, fill: GRAPHITE2 })));
  const tbH = input.sample ? 188 : 150;
  const tbY = H - M - footerH - tbH;
  o.push(`<rect x="${sx}" y="${tbY}" width="${sideW}" height="${tbH}" fill="none" stroke="${GRAPHITE}" stroke-width="1.5"/>`);
  o.push(`<line x1="${sx}" y1="${tbY + 52}" x2="${sx + sideW}" y2="${tbY + 52}" stroke="${GRAPHITE}" stroke-width="1"/>`);
  o.push(`<line x1="${sx}" y1="${tbY + 100}" x2="${sx + sideW}" y2="${tbY + 100}" stroke="${GRAPHITE}" stroke-width="1"/>`);
  o.push(text(sx + 10, tbY + 20, "Project", { size: 9.5, fill: GRAPHITE2 }));
  o.push(text(sx + 10, tbY + 40, trunc(title, 42), { size: 11.5, weight: 600 }));
  o.push(text(sx + 10, tbY + 70, "Sheet", { size: 9.5, fill: GRAPHITE2 }));
  o.push(text(sx + 10, tbY + 90, sheet, { size: 14, weight: 600, mono: true }));
  o.push(text(sx + sideW / 2, tbY + 70, "Date", { size: 9.5, fill: GRAPHITE2 }));
  o.push(text(sx + sideW / 2, tbY + 90, input.date, { size: 12, mono: true }));
  o.push(`<rect x="${sx + 10}" y="${tbY + 108}" width="260" height="30" fill="none" stroke="${GRAPHITE}" stroke-width="1.5"/>`);
  o.push(text(sx + 20, tbY + 128, "DRAFT — for professional review", { size: 10.5, weight: 700 }));
  if (input.sample) {
    o.push(`<rect x="${sx + 10}" y="${tbY + 146}" width="260" height="30" fill="none" stroke="${GRAPHITE}" stroke-width="1.5" stroke-dasharray="4 3"/>`);
    o.push(text(sx + 20, tbY + 166, "SAMPLE site — not a real parcel", { size: 10.5, weight: 700 }));
  }
  o.push(text(M, H - M - 6, BOARD_FOOTER, { size: 10, fill: GRAPHITE2 }));
  o.push(`</svg>`);
  return o.join("\n");
}

function wrapLines(s: string, n: number): string[] {
  const words = s.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > n) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Browser only: rasterise an SVG string to a PNG Blob at the given scale. */
export function svgToPng(svg: string, scale = 2): Promise<Blob> {
  if (typeof document === "undefined" || typeof Image === "undefined") {
    return Promise.reject(new Error("svgToPng is browser-only"));
  }
  return new Promise((resolve, reject) => {
    const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
    const w = m ? Number(m[1]) : 1600;
    const h = m ? Number(m[2]) : 1000;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("2D canvas is not available"));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))), "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not rasterise the board SVG"));
    };
    img.src = url;
  });
}
