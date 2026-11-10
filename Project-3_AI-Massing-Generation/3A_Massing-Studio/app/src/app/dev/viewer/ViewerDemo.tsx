"use client";
// DEV ONLY demo for the 3D viewer. All geometry below is TEST data (SAMPLE), not engine output.
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { Prism, Polygon } from "@wxy/massing";
import type {
  CameraPreset,
  ContextBuilding,
  EnvelopeSection,
  ViewerOption,
  ViewerStyle,
} from "@/components/viewer";
import { ViewerToolbar } from "@/components/viewer/ViewerToolbar";

const MassingScene = dynamic(() => import("@/components/viewer/MassingScene").then((m) => m.MassingScene), {
  ssr: false,
});
const OptionsGrid = dynamic(() => import("@/components/viewer/OptionsGrid").then((m) => m.OptionsGrid), {
  ssr: false,
});

const rect = (x0: number, y0: number, x1: number, y1: number): Polygon => ({
  outer: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
  holes: [],
});

const LOT = rect(0, 0, 100, 80);

function prism(id: string, polygon: Polygon, z0: number, z1: number, program: Prism["program"]): Prism {
  return { id, polygon, z0, z1, program, floors: [] };
}

function podiumTower(towerH: number, tag: string): Prism[] {
  return [
    prism(`${tag}-com`, LOT, 0, 15, "commercial"),
    prism(`${tag}-cf`, LOT, 15, 30, "community_facility"),
    prism(`${tag}-tower`, rect(35, 25, 65, 55), 30, 30 + towerH, "residential"),
  ];
}

function courtyardRing(h: number, tag: string): Prism[] {
  const ring: Polygon = {
    outer: LOT.outer,
    holes: [[[30, 20], [30, 60], [70, 60], [70, 20]]], // CW
  };
  return [prism(`${tag}-com`, ring, 0, 14, "commercial"), prism(`${tag}-res`, ring, 14, h, "residential")];
}

function slab(h: number, tag: string): Prism[] {
  return [
    prism(`${tag}-com`, rect(0, 0, 100, 30), 0, 14, "commercial"),
    prism(`${tag}-res`, rect(0, 0, 100, 30), 14, h, "residential"),
  ];
}

function stepped(tag: string): Prism[] {
  return [
    prism(`${tag}-a`, rect(0, 0, 100, 80), 0, 30, "residential"),
    prism(`${tag}-b`, rect(0, 10, 100, 70), 30, 60, "residential"),
    prism(`${tag}-c`, rect(0, 20, 100, 60), 60, 90, "residential"),
  ];
}

const OPTIONS: ViewerOption[] = [
  { id: "o1", label: "Podium and tower", prisms: podiumTower(90, "o1") },
  { id: "o2", label: "Perimeter courtyard", prisms: courtyardRing(92, "o2") },
  { id: "o3", label: "Slab bar", prisms: slab(85, "o3") },
  { id: "o4", label: "Stepped terraces", prisms: stepped("o4") },
  { id: "o5", label: "Podium and tall tower", prisms: podiumTower(140, "o5") },
  { id: "o6", label: "Low courtyard", prisms: courtyardRing(56, "o6") },
];

const CONTEXT: ContextBuilding[] = (() => {
  const out: ContextBuilding[] = [];
  let n = 0;
  for (let gx = -2; gx <= 2; gx++) {
    for (let gy = -2; gy <= 2; gy++) {
      const inLotBlock = gx === 0 && gy === 0;
      if (inLotBlock) continue;
      n++;
      if (n > 20) break;
      const x0 = gx * 140 - 10 + 20;
      const y0 = gy * 120 - 10 + 20;
      out.push({ polygon: rect(x0, y0, x0 + 90, y0 + 70), height: 25 + ((n * 37) % 70) });
    }
  }
  return out;
})();

// SAMPLE envelope: full lot to 60 ft, then 10 ft setback to 85 ft, nothing above.
const ENVELOPE: EnvelopeSection[] = [
  { z: 0, polygons: [LOT] },
  { z: 60, polygons: [rect(10, 10, 90, 70)] },
  { z: 85, polygons: [rect(10, 10, 90, 70)] },
];

const SUN_DIR: [number, number, number] = [-0.5, -0.6, 0.6];

export function ViewerDemo() {
  const [style, setStyle] = useState<ViewerStyle>("model");
  const [sunOn, setSunOn] = useState(false);
  const [cutZ, setCutZ] = useState<number | null>(null);
  const [preset, setPreset] = useState<CameraPreset>("axon-ne");
  const [nonce, setNonce] = useState(0);
  const [selected, setSelected] = useState("o2");
  const sun = useMemo(() => ({ dir: SUN_DIR, enabled: sunOn }), [sunOn]);
  const current = OPTIONS.find((o) => o.id === selected) ?? OPTIONS[0];
  const top = Math.max(...current.prisms.map((p) => p.z1));

  return (
    <main className="flex flex-col gap-6 bg-paper p-4 text-graphite">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Viewer demo (dev only)</h1>
        <p className="text-sm text-graphite-2">
          TEST prisms, not engine output. SAMPLE context and envelope. Focus the viewer, then use arrow keys, plus
          and minus, Home, P.
        </p>
      </header>

      <section aria-label="Single viewer" className="relative h-[70vh] min-h-96 border border-rule">
        <MassingScene
          options={OPTIONS}
          selectedId={selected}
          envelopeSections={ENVELOPE}
          lot={[LOT]}
          context={CONTEXT}
          style={style}
          sun={sun}
          sectionCutZ={cutZ}
          cameraPreset={preset}
          presetNonce={nonce}
          onPresetRequest={(p) => setPreset(p)}
          description={`${current.label}, ${top} ft, ${style} style`}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
          <ViewerToolbar
            preset={preset}
            onPreset={(p) => {
              setPreset(p);
              setNonce((n) => n + 1);
            }}
            sectionCutZ={cutZ}
            sectionMaxZ={top}
            onSectionCutZ={setCutZ}
            sunEnabled={sunOn}
            onSunEnabled={setSunOn}
            style={style}
            onStyle={setStyle}
          />
        </div>
      </section>

      <section aria-label="Options grid" className="h-[70vh] min-h-96">
        <OptionsGrid
          className="size-full"
          options={OPTIONS}
          selectedId={selected}
          onSelect={setSelected}
          envelopeSections={ENVELOPE}
          lot={[LOT]}
          context={CONTEXT}
          style={style}
          sun={sun}
          sectionCutZ={cutZ}
          cameraPreset={preset}
          presetNonce={nonce}
          renderLabel={(o, sel) => (
            <div className="flex items-center gap-2 bg-paper/80 px-2 py-1 text-xs">
              <span className="font-medium">{o.label}</span>
              {sel && <span className="text-graphite-2">selected</span>}
            </div>
          )}
        />
      </section>
    </main>
  );
}
