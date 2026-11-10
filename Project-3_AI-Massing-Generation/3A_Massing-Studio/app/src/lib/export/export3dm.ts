// .3dm export via rhino3dm 8.35.0 (APIs confirmed in node_modules/rhino3dm/rhino3dm.d.ts; see report).
// Model units: feet. Engine frame (x east, y north, z up) is written as-is (Rhino is Z-up).
import type rhino3dmFactory from "rhino3dm";
import type { RhinoModule, RhinoModuleOptions } from "rhino3dm";
import { prismToMesh } from "@wxy/massing";
import type { Assumptions, EnvelopeModel, MassingOption, MultiPolygon, Polygon, Program, Prism, Vec2 } from "@wxy/massing";
import {
  CONTEXT_HEX,
  DISCLAIMER,
  ENVELOPE_HEX,
  PROGRAM_HEX,
  PROGRAM_LABEL,
  PROGRAM_SHORT,
  assumptionEntries,
  citationEntries,
  floorsRange,
  hexToRgb,
  metricEntries,
  pad2,
  ruleValue,
} from "./shared";

export interface Export3dmInput {
  envelope: EnvelopeModel;
  envelopeSections: { z: number; polygons: MultiPolygon }[];
  options: { index: number; option: MassingOption; name: string; intent: string }[];
  context: { polygon: Polygon; height: number; bin?: string }[];
  assumptions: Assumptions;
  meta: { envelopeId: string; sample: boolean; generatedBy: string };
}

export interface Rhino3dmInitOptions {
  /** Browser: where rhino3dm.wasm is served from, e.g. (f) => `/wasm/${f}`. */
  locateFile?: RhinoModuleOptions["locateFile"];
  /** Or supply the wasm bytes directly. */
  wasmBinary?: RhinoModuleOptions["wasmBinary"];
}

let rhinoPromise: Promise<RhinoModule> | null = null;
let rhinoOpts: Rhino3dmInitOptions | undefined;

/** Configure wasm location. Must be called before the first export (no effect once loaded). */
export function configureRhino3dm(opts: Rhino3dmInitOptions): void {
  if (!rhinoPromise) rhinoOpts = opts;
}

/** Init rhino3dm once. Node: package main (CommonJS) finds the .wasm next to the .js. */
export function getRhino(): Promise<RhinoModule> {
  if (!rhinoPromise) {
    rhinoPromise = import("rhino3dm").then((mod) => {
      const factory = ((mod as { default?: unknown }).default ?? mod) as typeof rhino3dmFactory;
      return factory({ ...(rhinoOpts ?? {}) });
    });
    rhinoPromise.catch(() => {
      rhinoPromise = null; // allow retry after a failed load
    });
  }
  return rhinoPromise;
}

/** Emscripten objects expose delete() at runtime (not in rhino3dm.d.ts); free WASM memory when present. */
function free(o: unknown): void {
  (o as { delete?: () => void }).delete?.();
}

const PROGRAMS: Program[] = ["residential", "commercial", "community_facility"];

export async function export3dm(input: Export3dmInput): Promise<Uint8Array> {
  const rhino = await getRhino();
  const doc = new rhino.File3dm();
  
  try {
    doc.settings().modelUnitSystem = rhino.UnitSystem.Feet;

    // ---- layers ----
    const layers = doc.layers();
    const addLayer = (name: string, hex: string, parentId?: string): { index: number; id: string } => {
      const l = new rhino.Layer();
      l.name = name;
      l.color = hexToRgb(hex);
      if (parentId) l.parentLayerId = parentId;
      const index = layers.add(l);
      return { index, id: layers.get(index).id };
    };
    const envLayer = addLayer("Envelope", ENVELOPE_HEX);
    const ctxLayer = addLayer("Context", CONTEXT_HEX);
    const optLayers = new Map<number, Record<Program, number>>();
    for (const o of input.options) {
      const parent = addLayer(`Option_${pad2(o.index)}`, "#22252A");
      const rec = {} as Record<Program, number>;
      for (const p of PROGRAMS) rec[p] = addLayer(PROGRAM_LABEL[p], PROGRAM_HEX[p], parent.id).index;
      optLayers.set(o.index, rec);
    }

    const addMesh = (prism: Prism, layerIndex: number, name: string, strings: [string, string][]) => {
      const pm = prismToMesh(prism);
      const mesh = new rhino.Mesh();
      for (let i = 0; i < pm.positions.length; i += 3) mesh.vertices().add(pm.positions[i], pm.positions[i + 1], pm.positions[i + 2]);
      for (let i = 0; i < pm.indices.length; i += 3) mesh.faces().addTriFace(pm.indices[i], pm.indices[i + 1], pm.indices[i + 2]);
      const attrs = new rhino.ObjectAttributes();
      attrs.layerIndex = layerIndex;
      attrs.name = name;
      for (const [k, v] of strings) attrs.setUserString(k, v);
      doc.objects().addMesh(mesh, attrs);
      free(attrs);
      free(mesh);
    };

    // ---- envelope curves ----
    const addRing = (ring: readonly Vec2[], z: number, name: string, strings: [string, string][]) => {
      if (ring.length < 3) return;
      const pts = ring.map(([x, y]) => [x, y, z]);
      pts.push([ring[0][0], ring[0][1], z]); // closed polyline
      const curve = new rhino.PolylineCurve(pts);
      const attrs = new rhino.ObjectAttributes();
      attrs.layerIndex = envLayer.index;
      attrs.name = name;
      for (const [k, v] of strings) attrs.setUserString(k, v);
      doc.objects().addCurve(curve, attrs);
      free(attrs);
      free(curve);
    };
    const addPoly = (poly: Polygon, z: number, name: string) => {
      addRing(poly.outer, z, name, [["wxy.z_ft", String(z)]]);
      for (const h of poly.holes) addRing(h, z, `${name} (hole)`, [["wxy.z_ft", String(z)]]);
    };
    addPoly(input.envelope.lot, 0, "Lot outline");
    for (const s of input.envelopeSections) {
      for (const poly of s.polygons) addPoly(poly, s.z, `Envelope section z=${s.z} ft`);
    }

    // ---- context ----
    input.context.forEach((b, i) => {
      const prism: Prism = { id: `ctx-${i}`, polygon: b.polygon, z0: 0, z1: b.height, program: "commercial", floors: [] };
      addMesh(prism, ctxLayer.index, `Context · ${b.bin ?? i + 1}`, [
        ["wxy.context", "true"],
        ["wxy.height_ft", String(b.height)],
        ...(b.bin ? ([["wxy.bin", b.bin]] as [string, string][]) : []),
      ]);
    });

    // ---- options ----
    const globalKv: [string, string][] = [
      ...assumptionEntries(input.assumptions).map(([k, v]): [string, string] => [`wxy.assumption.${k}`, v]),
      ...citationEntries(input.envelope).map(([k, v]): [string, string] => [`wxy.citation.${k}`, v]),
    ];
    const rawStrings = doc.strings();
    // Document strings are written twice: the dotted key as specified ("wxy.option_1.metric.gfa_sf") and the
    // Rhino "Section\Entry" form ("wxy\option_1.metric.gfa_sf"). rhino3dm's documentUserTextCount() counts
    // only the section form, which is what Rhino's Document User Text lists (see docs/rhino-verification.md).
    const strings = {
      set(key: string, value: string) {
        rawStrings.set(key, value);
        if (key.startsWith("wxy.")) rawStrings.set(`wxy\\${key.slice(4)}`, value);
      },
    };
    for (const o of input.options) {
      const n = o.index;
      const opt = o.option;
      const optKv: [string, string][] = [
        ["wxy.intent", o.intent],
        ...metricEntries(opt.metrics).map(([k, v]): [string, string] => [`wxy.metric.${k}`, v]),
        ...Object.entries(opt.params).map(([k, v]): [string, string] => [`wxy.param.${k}`, String(v)]),
        ...opt.compliance.map((r): [string, string] => [`wxy.rule.${r.id}`, ruleValue(r)]),
        ["wxy.overall", `${opt.overall.status} | ${opt.overall.label}`],
      ];
      for (const [k, v] of optKv) strings.set(`wxy.option_${n}.${k.slice(4)}`, v);
      strings.set(`wxy.option_${n}.name`, o.name);
      strings.set(`wxy.option_${n}.typology`, opt.typology);

      const layerRec = optLayers.get(n)!;
      opt.prisms.forEach((prism, i) => {
        const { a, b } = floorsRange(prism.floors.length ? prism.floors : [0]);
        const fl = prism.floors.length ? `floors ${a}–${b}` : "floors –";
        const base: [string, string][] = [
          ["wxy.option", String(n)],
          ["wxy.typology", opt.typology],
          ["wxy.program", prism.program],
          ["wxy.floors", prism.floors.length ? `${a}-${b}` : ""],
          ["wxy.z0_ft", String(prism.z0)],
          ["wxy.z1_ft", String(prism.z1)],
        ];
        const kv = i === 0 ? [...base, ...optKv, ...globalKv] : base;
        addMesh(prism, layerRec[prism.program], `Option ${n} · ${o.name} · ${fl}`, kv);
      });
    }

    // ---- document strings ----
    strings.set("wxy.envelopeId", input.meta.envelopeId);
    strings.set("wxy.sample", input.meta.sample ? "SAMPLE — not a real parcel" : "false");
    strings.set("wxy.units", "feet");
    strings.set("wxy.disclaimer", DISCLAIMER);
    strings.set("wxy.generatedBy", input.meta.generatedBy);
    strings.set("wxy.programKey", PROGRAMS.map((p) => `${PROGRAM_SHORT[p]}=${PROGRAM_LABEL[p]}`).join("; "));
    for (const [k, v] of globalKv) strings.set(k, v);

    return doc.toByteArray();
  } finally {
    free(doc);
  }
}
