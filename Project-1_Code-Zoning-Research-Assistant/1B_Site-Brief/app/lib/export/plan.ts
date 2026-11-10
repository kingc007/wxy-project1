// Lot-plan geometry for the PDF sheet. Pure functions (unit tested): EPSG:2263 feet -> page units, north-up,
// graphic scale bar, edge labels. Neighbours arrive as lon/lat only, so they are mapped into 2263 feet with an
// affine fit against the lot's own two rings (same vertices in both CRSs) instead of a hard-coded projection.
import type { LotEdge, Ring, SiteData } from "@/lib/types";

type Pair = [number, number];

function openRing(r: Ring): Pair[] {
  const out = r.map((p) => [p[0], p[1]] as Pair);
  if (out.length > 1) {
    const a = out[0], b = out[out.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) out.pop();
  }
  return out;
}

/** Solve a 3x3 linear system by Gaussian elimination with partial pivoting. Returns null when singular. */
function solve3(m: number[][], v: number[]): number[] | null {
  const a = m.map((r, i) => [...r, v[i]]);
  for (let c = 0; c < 3; c++) {
    let piv = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(a[r][c]) > Math.abs(a[piv][c])) piv = r;
    if (Math.abs(a[piv][c]) < 1e-12) return null;
    [a[c], a[piv]] = [a[piv], a[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = a[r][c] / a[c][c];
      for (let k = c; k < 4; k++) a[r][k] -= f * a[c][k];
    }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
}

/** Least-squares affine map src -> dst (needs >= 3 non-collinear points, equal counts). */
export function fitAffine(srcRing: Ring, dstRing: Ring): ((p: Pair) => Pair) | null {
  const src = openRing(srcRing), dst = openRing(dstRing);
  if (src.length < 3 || src.length !== dst.length) return null;
  const n = src.length;
  const cx = src.reduce((s, p) => s + p[0], 0) / n, cy = src.reduce((s, p) => s + p[1], 0) / n;
  // centre and scale the source so the normal equations are well conditioned
  const k = Math.max(...src.map((p) => Math.max(Math.abs(p[0] - cx), Math.abs(p[1] - cy)))) || 1;
  const rows = src.map((p) => [(p[0] - cx) / k, (p[1] - cy) / k, 1]);
  const ata = [0, 1, 2].map((i) => [0, 1, 2].map((j) => rows.reduce((s, r) => s + r[i] * r[j], 0)));
  const atx = [0, 1, 2].map((i) => rows.reduce((s, r, idx) => s + r[i] * dst[idx][0], 0));
  const aty = [0, 1, 2].map((i) => rows.reduce((s, r, idx) => s + r[i] * dst[idx][1], 0));
  const cxs = solve3(ata, atx), cys = solve3(ata, aty);
  if (!cxs || !cys) return null;
  return (p) => {
    const u = (p[0] - cx) / k, w = (p[1] - cy) / k;
    return [cxs[0] * u + cxs[1] * w + cxs[2], cys[0] * u + cys[1] * w + cys[2]];
  };
}

export const SCALE_BAR_CHOICES_FT = [5, 10, 20, 25, 50, 100, 200, 500, 1000, 2000];

/** Largest round length whose bar is at most maxPx long; null when even the smallest does not fit. */
export function chooseScaleBar(pxPerFt: number, maxPx: number, minPx = 30): { ft: number; px: number } | null {
  let best: number | null = null;
  for (const ft of SCALE_BAR_CHOICES_FT) if (ft * pxPerFt <= maxPx) best = ft;
  return best === null || best * pxPerFt < minPx ? null : { ft: best, px: best * pxPerFt };
}

export interface PlanLabel { x: number; y: number; text: string; angle: number; size: number; bold?: boolean }
export interface PlanModel {
  width: number;
  height: number;
  pxPerFt: number;
  lot: string; // svg points
  neighbors: string[];
  labels: PlanLabel[];
  lotCentre: { x: number; y: number };
  scaleBar: { ft: number; px: number; x: number; y: number } | null;
  north: { x: number; y: number };
  lotWidthPx: number;
}

const f1 = (n: number) => (Math.round(n * 10) / 10).toString();

function streetLabel(e: LotEdge): string | null {
  const s = e.street;
  if (!s?.name) return null;
  return s.widthFt !== null ? `${s.name} (${s.widthFt} ft)` : `${s.name} (width unknown)`;
}

/** Normalise a screen-space angle in degrees to (-90, 90] so text never reads upside down. */
export function readableAngle(deg: number): number {
  let a = ((deg % 360) + 360) % 360;
  if (a > 180) a -= 360;
  if (a > 90) a -= 180;
  if (a <= -90) a += 180;
  return a;
}

export function buildPlan(site: SiteData, width: number, height: number): PlanModel | null {
  const g = site.geometry;
  if (!g || g.ring2263.length < 3) return null;
  const lot = openRing(g.ring2263);

  // neighbours -> 2263 feet
  const toFeet = fitAffine(g.ring4326, g.ring2263);
  const nbRings: Pair[][] = toFeet ? site.neighbors4326.map((r) => openRing(r).map((p) => toFeet(p))) : [];

  const xs = lot.map((p) => p[0]), ys = lot.map((p) => p[1]);
  const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  const wFt = Math.max(xmax - xmin, 1), hFt = Math.max(ymax - ymin, 1);
  // Margins in page units: room for edge labels (top/sides) and the scale bar (bottom).
  const mx = 46, mTop = 46, mBottom = 64;
  const availW = width - 2 * mx, availH = height - mTop - mBottom;
  // Keep the lot at most ~55% of the frame so neighbours show context.
  const pxPerFt = Math.min(availW / (wFt * 1.8), availH / (hFt * 1.35));
  const cxFt = (xmin + xmax) / 2, cyFt = (ymin + ymax) / 2;
  const ox = width / 2, oy = mTop + availH / 2;
  const X = (x: number) => ox + (x - cxFt) * pxPerFt;
  const Y = (y: number) => oy - (y - cyFt) * pxPerFt; // north-up: 2263 y grows north
  const pts = (r: Pair[]) => r.map((p) => `${f1(X(p[0]))},${f1(Y(p[1]))}`).join(" ");

  // keep neighbours that come within the drawing frame (clipped by the caller)
  const viewMinX = cxFt - ox / pxPerFt, viewMaxX = cxFt + (width - ox) / pxPerFt;
  const viewMinY = cyFt - (height - oy) / pxPerFt, viewMaxY = cyFt + oy / pxPerFt;
  const neighbors = nbRings
    .filter((r) => {
      const nx = r.map((p) => p[0]), ny = r.map((p) => p[1]);
      return Math.max(...nx) >= viewMinX && Math.min(...nx) <= viewMaxX && Math.max(...ny) >= viewMinY && Math.min(...ny) <= viewMaxY;
    })
    .map(pts);

  const labels: PlanLabel[] = [];
  const edges = site.edges.length ? site.edges : lot.map((p, i) => ({
    index: i, from: p, to: lot[(i + 1) % lot.length], lengthFt: Math.hypot(lot[(i + 1) % lot.length][0] - p[0], lot[(i + 1) % lot.length][1] - p[1]),
    kind: "unknown" as const,
  } satisfies LotEdge));
  const cx = X(cxFt), cy = Y(cyFt);
  for (const e of edges) {
    const x1 = X(e.from[0]), y1 = Y(e.from[1]), x2 = X(e.to[0]), y2 = Y(e.to[1]);
    const mxp = (x1 + x2) / 2, myp = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    let nx = -dy / len, ny = dx / len;
    if ((mxp + nx - cx) ** 2 + (myp + ny - cy) ** 2 < (mxp - cx) ** 2 + (myp - cy) ** 2) { nx = -nx; ny = -ny; }
    const angle = readableAngle((Math.atan2(dy, dx) * 180) / Math.PI);
    const street = e.kind === "front" ? streetLabel(e) : null;
    // dimension string: lengths of at least 8 ft and 20 page units, so tiny jogs do not clutter the plan
    if (e.lengthFt >= 8 && len >= 20) {
      labels.push({ x: mxp + nx * 9, y: myp + ny * 9, text: `${e.lengthFt.toFixed(2)} ft`, angle, size: 7.5 });
    }
    if (street) labels.push({ x: mxp + nx * 26, y: myp + ny * 26, text: street, angle, size: 9, bold: true });
  }

  const bar = chooseScaleBar(pxPerFt, Math.min(180, width * 0.4));
  return {
    width, height, pxPerFt,
    lot: pts(lot), neighbors, labels,
    lotCentre: { x: cx, y: cy },
    scaleBar: bar ? { ...bar, x: mx, y: height - 28 } : null,
    north: { x: width - 40, y: 40 },
    lotWidthPx: wFt * pxPerFt,
  };
}
