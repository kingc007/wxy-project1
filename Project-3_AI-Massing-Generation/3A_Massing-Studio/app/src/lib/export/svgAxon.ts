// Orthographic axonometric SVG of prisms. Pure + deterministic (all numbers fixed to 2 decimals).
// Camera: azimuth is the compass bearing of the camera position seen from the scene (0 = north, 90 = east,
// 225 = from the south-west, looking north-east); elevation is the angle above the horizon.
//   h = (sin az, cos az)  horizontal unit vector scene -> camera;  r = (-cos az, sin az)  screen-right
//   screen x =  p·r ;  screen up = z·cos(el) - (p·h)·sin(el) ;  depth (bigger = nearer) = (p·h)·cos(el) + z·sin(el)
// Painter's algorithm: faces sorted by depth of the face centroid, far first. Nothing is split, so interlocking
// masses may show small ordering artifacts (acceptable for study boards). Bottoms are never drawn (el > 0).
import type { Polygon, Prism, Program } from "@wxy/massing";
import { CONTEXT_HEX, GRAPHITE, PROGRAM_HEX, PROGRAM_HEX_DARK, PROGRAM_SHORT, hexToRgb, xmlEscape } from "./shared";

export interface AxonOptions {
  size: [number, number];
  azimuthDeg?: number;
  elevationDeg?: number;
  context?: { polygon: Polygon; height: number }[];
  lot?: Polygon;
  style: "model" | "diagram";
  theme: "light" | "dark";
  padding?: number;
  /** Unique id prefix for <defs> when several axons share one document. */
  idPrefix?: string;
}

interface Face {
  pts: [number, number][]; // screen coords before fit
  depth: number;
  fill: string;
  stroke: number; // stroke width
  kind: "mass" | "context";
  program?: Program;
  top: boolean;
  area: number;
  rings?: [number, number][][]; // top caps: outer + holes in screen coords
}

const LIGHT: [number, number, number] = (() => {
  const v: [number, number, number] = [-0.45, -0.55, 0.7];
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n];
})();

const f2 = (n: number) => {
  const s = n.toFixed(2);
  return s === "-0.00" ? "0.00" : s;
};

function shade(hex: string, darken: number): string {
  const { r, g, b } = hexToRgb(hex);
  const k = 1 - darken;
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function ringArea(r: readonly [number, number][]): number {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i];
    const [x2, y2] = r[(i + 1) % r.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

export function axonSvg(prisms: readonly Prism[], opts: AxonOptions): string {
  const [w, h] = opts.size;
  const idp = opts.idPrefix ?? "axon";
  const bg = opts.theme === "dark" ? "#16181B" : "#F6F5F1";
  const g = axonGroup(prisms, opts);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="${bg}"/>` +
    `<clipPath id="${idp}-clip"><rect width="${w}" height="${h}"/></clipPath>` +
    `<g clip-path="url(#${idp}-clip)">${g}</g></svg>`
  );
}

/** The drawing as an SVG fragment (no <svg> wrapper, no background), fitted to size. Used by boards. */
export function axonGroup(prisms: readonly Prism[], opts: AxonOptions): string {
  const [w, h] = opts.size;
  const pad = opts.padding ?? 16;
  const az = ((opts.azimuthDeg ?? 225) * Math.PI) / 180;
  const el = ((opts.elevationDeg ?? 30) * Math.PI) / 180;
  const dark = opts.theme === "dark";
  const idp = opts.idPrefix ?? "axon";
  const stroke = dark ? "#E9E7E1" : GRAPHITE;
  const hx = Math.sin(az);
  const hy = Math.cos(az);
  const rx = -Math.cos(az);
  const ry = Math.sin(az);
  const proj = (x: number, y: number, z: number): [number, number] => {
    const ph = x * hx + y * hy;
    return [x * rx + y * ry, -(z * Math.cos(el) - ph * Math.sin(el))];
  };
  const depthOf = (x: number, y: number, z: number) => (x * hx + y * hy) * Math.cos(el) + z * Math.sin(el);

  const faces: Face[] = [];
  const baseOf = (program: Program | null): string => {
    if (opts.style === "diagram" && program) return (dark ? PROGRAM_HEX_DARK : PROGRAM_HEX)[program];
    if (!program) return dark ? "#4a4c50" : CONTEXT_HEX;
    return dark ? "#d9d7d0" : "#f6f4ee";
  };
  const addSolid = (polygon: Polygon, z0: number, z1: number, program: Program | null) => {
    const kind: Face["kind"] = program ? "mass" : "context";
    const sw = program ? 1 : 0.5;
    const base = baseOf(program);
    const dk = (nz: number, nx: number, ny: number) => {
      const l = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      const d = 0.04 + 0.1 * (1 - l); // 4–14 % darker
      return program ? d : d * 0.6;
    };
    // top cap (one path, holes as extra subpaths with even-odd fill)
    const rings = [polygon.outer, ...polygon.holes];
    const cx = polygon.outer.reduce((s, p) => s + p[0], 0) / polygon.outer.length;
    const cy = polygon.outer.reduce((s, p) => s + p[1], 0) / polygon.outer.length;
    faces.push({
      pts: [],
      depth: depthOf(cx, cy, z1),
      fill: shade(base, dk(1, 0, 0)),
      stroke: sw,
      kind,
      program: program ?? undefined,
      top: true,
      area: ringArea(polygon.outer as [number, number][]),
    });
    faces[faces.length - 1].rings = rings.map((r) => r.map(([x, y]) => proj(x, y, z1)));
    // walls facing the camera
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const [ax, ay] = ring[i];
        const [bx, by] = ring[(i + 1) % ring.length];
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy);
        if (len < 1e-9) continue;
        const nx = dy / len; // outward normal (dy, -dx) for CCW outer / CW holes
        const ny = -dx / len;
        if (nx * hx + ny * hy <= 1e-9) continue; // back-facing or edge-on
        faces.push({
          pts: [proj(ax, ay, z0), proj(bx, by, z0), proj(bx, by, z1), proj(ax, ay, z1)],
          depth: depthOf((ax + bx) / 2, (ay + by) / 2, (z0 + z1) / 2),
          fill: shade(base, dk(0, nx, ny)),
          stroke: sw,
          kind,
          program: program ?? undefined,
          top: false,
          area: 0,
        });
      }
    }
  };
  for (const c of opts.context ?? []) addSolid(c.polygon, 0, c.height, null);
  for (const p of prisms) addSolid(p.polygon, p.z0, p.z1, p.program);

  // fit: massing + lot (context may overflow and is clipped by the caller's clip rect)
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const grow = ([x, y]: [number, number]) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  const lotRings = opts.lot ? [opts.lot.outer, ...opts.lot.holes].map((r) => r.map(([x, y]) => proj(x, y, 0))) : [];
  for (const r of lotRings) r.forEach(grow);
  for (const p of prisms)
    for (const ring of [p.polygon.outer, ...p.polygon.holes])
      for (const [x, y] of ring) {
        grow(proj(x, y, p.z0));
        grow(proj(x, y, p.z1));
      }
  if (!isFinite(minX)) {
    for (const f of faces) f.pts.forEach(grow);
  }
  if (!isFinite(minX)) return "";
  const bw = Math.max(maxX - minX, 1e-6);
  const bh = Math.max(maxY - minY, 1e-6);
  const s = Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh);
  const ox = (w - bw * s) / 2 - minX * s;
  const oy = (h - bh * s) / 2 - minY * s;
  const T = ([x, y]: [number, number]) => `${f2(x * s + ox)} ${f2(y * s + oy)}`;
  const pathOf = (rings: [number, number][][]) => rings.map((r) => "M" + r.map(T).join("L") + "Z").join("");

  const out: string[] = [];
  const defs = opts.style === "diagram" ? hatchDefs(idp, stroke) : "";
  if (defs) out.push(defs);
  for (const r of lotRings) {
    out.push(`<path d="${pathOf([r as [number, number][]])}" fill="none" stroke="${stroke}" stroke-width="0.75" stroke-dasharray="4 3"/>`);
  }
  faces.sort((a, b) => a.depth - b.depth);
  for (const f of faces) {
    const rings = f.rings ?? [f.pts];
    const d = pathOf(rings);
    const eo = f.top && rings.length > 1 ? ' fill-rule="evenodd"' : "";
    out.push(`<path d="${d}" fill="${f.fill}"${eo} stroke="${stroke}" stroke-width="${f.stroke}" stroke-linejoin="round"/>`);
    if (opts.style === "diagram" && f.program && f.program !== "residential") {
      const pat = f.program === "commercial" ? `${idp}-hatch45` : `${idp}-hatch135`;
      out.push(`<path d="${d}" fill="url(#${pat})"${eo} stroke="none"/>`);
    }
  }
  if (opts.style === "diagram") {
    // one label per program on its largest top face
    const best = new Map<Program, { f: Face; rings: [number, number][][] }>();
    for (const f of faces) {
      if (!f.top || !f.program) continue;
      const cur = best.get(f.program);
      if (!cur || f.area > cur.f.area) best.set(f.program, { f, rings: f.rings! });
    }
    for (const prog of ["residential", "commercial", "community_facility"] as Program[]) {
      const b = best.get(prog);
      if (!b) continue;
      const o = b.rings[0];
      const cx = o.reduce((a, p) => a + p[0], 0) / o.length;
      const cy = o.reduce((a, p) => a + p[1], 0) / o.length;
      const tx = cx * s + ox;
      const ty = cy * s + oy;
      out.push(
        `<text x="${f2(tx)}" y="${f2(ty)}" text-anchor="middle" dominant-baseline="central" font-family="'IBM Plex Mono', ui-monospace, Menlo, monospace" font-size="10" font-weight="600" fill="${GRAPHITE}" stroke="#ffffff" stroke-width="2.5" paint-order="stroke">${xmlEscape(PROGRAM_SHORT[prog])}</text>`,
      );
    }
  }
  return out.join("");
}

function hatchDefs(idp: string, stroke: string): string {
  return (
    `<defs>` +
    `<pattern id="${idp}-hatch45" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${stroke}" stroke-opacity="0.55" stroke-width="1"/></pattern>` +
    `<pattern id="${idp}-hatch135" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(135)"><line x1="0" y1="0" x2="0" y2="6" stroke="${stroke}" stroke-opacity="0.55" stroke-width="1"/></pattern>` +
    `</defs>`
  );
}
