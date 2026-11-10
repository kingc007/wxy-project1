"use client";
// 2x3 synchronised mini-viewports.
// Approach: ONE <Canvas>; each tile is a DOM element and a TileViewport scissor-renders its own camera
// into that element's rect. (drei <View> was dropped: its offscreen test compares viewport-space tile
// coordinates with the canvas size, which hides tiles when the canvas is offset or narrow.)
// Cameras are mirrored through a SharedCamera (end values copied between camera-controls instances).
// Ambient occlusion is disabled in tiles (EffectComposer renders full-canvas, not per-View).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import type { CameraControlsImpl } from "@react-three/drei";
import { TileViewport } from "./TileViewport";
import * as THREE from "three";
import type { MultiPolygon } from "@wxy/massing";
import { SceneContent } from "./SceneContent";
import { computeFrame } from "./frame";
import { useViewerKeys, usePrefersReducedMotion, useIsDark, useFirstFrame } from "./hooks";
import { createSharedCamera, type SharedCamera } from "./shared-camera";
import type {
  CameraPreset,
  ContextBuilding,
  EnvelopeSection,
  SunState,
  ViewerOption,
  ViewerStyle,
} from "./types";

export interface OptionsGridProps {
  options: ViewerOption[]; // up to 6 are shown
  selectedId?: string;
  onSelect?: (id: string) => void;
  /** Label slot: name, metrics, status markup supplied by the parent. Rendered over the tile bottom. */
  renderLabel?: (option: ViewerOption, selected: boolean) => React.ReactNode;
  /** Decoration drawn over the whole tile (e.g. a shared-layout frame). Must not take pointer events. */
  renderOverlay?: (option: ViewerOption, selected: boolean) => React.ReactNode;
  /** Accessible name per tile; defaults to the option label. */
  tileAriaLabel?: (option: ViewerOption) => string;
  envelopeSections?: EnvelopeSection[];
  lot?: MultiPolygon;
  context?: ContextBuilding[];
  style: ViewerStyle;
  sun?: SunState;
  sectionCutZ?: number | null;
  cameraPreset?: CameraPreset;
  presetNonce?: number;
  dark?: boolean;
  /** Fired once, after every tile has drawn its first frame. */
  onReady?: () => void;
  className?: string;
}

function InvalidateOnLayout() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const f = () => invalidate();
    window.addEventListener("scroll", f, true);
    window.addEventListener("resize", f);
    const ro = new ResizeObserver(f);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("scroll", f, true);
      window.removeEventListener("resize", f);
      ro.disconnect();
    };
  }, [invalidate]);
  return null;
}

/** Stable per-tile controller refs without reading refs during render. */
class ControlsRegistry {
  private map = new Map<string, React.RefObject<CameraControlsImpl | null>>();
  refFor(id: string): React.RefObject<CameraControlsImpl | null> {
    let r = this.map.get(id);
    if (!r) {
      r = { current: null };
      this.map.set(id, r);
    }
    return r;
  }
}

interface TileProps {
  option: ViewerOption;
  selected: boolean;
  registry: ControlsRegistry;
  shared: SharedCamera;
  onPreset: (p: CameraPreset) => void;
  onSelect?: (id: string) => void;
  onEl: (id: string, el: HTMLElement | null) => void;
  label: React.ReactNode;
  overlay?: React.ReactNode;
  ariaLabel: string;
  reducedMotion: boolean;
}

/** DOM only: the tile's focus target, label slot and the element the scene is rendered over. */
function Tile(p: TileProps) {
  const { onEl, option } = p;
  const elRef = useCallback((n: HTMLDivElement | null) => onEl(option.id, n), [onEl, option.id]);
  const down = useRef<[number, number] | null>(null);
  const onKey = useViewerKeys({
    controls: p.registry.refFor(p.option.id),
    onPreset: p.onPreset,
    shared: p.shared,
    id: p.option.id,
    reducedMotion: p.reducedMotion,
  });
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={p.selected}
      aria-label={p.ariaLabel}
      onPointerDown={(e) => (down.current = [e.clientX, e.clientY])}
      onClick={(e) => {
        const d = down.current;
        if (!d || Math.hypot(e.clientX - d[0], e.clientY - d[1]) < 5) p.onSelect?.(p.option.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          p.onSelect?.(p.option.id);
          return;
        }
        onKey(e);
      }}
      className={
        "relative min-h-40 touch-none overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring " +
        (p.selected ? "outline-[3px] -outline-offset-[3px] outline-signal" : "")
      }
    >
      <div ref={elRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">{p.label}</div>
      {p.overlay && <div className="pointer-events-none absolute inset-0 z-20">{p.overlay}</div>}
    </div>
  );
}

export function OptionsGrid(props: OptionsGridProps) {
  const options = props.options.slice(0, 6);
  const reducedMotion = usePrefersReducedMotion();
  const dark = useIsDark(props.dark);
  const readyRef = useFirstFrame(props.onReady);
  const rendered = useRef(new Set<string>());
  const fired = useRef(false);
  const tileRendered = (id: string) => {
    rendered.current.add(id);
    if (!fired.current && rendered.current.size >= options.length) {
      fired.current = true;
      readyRef.current?.();
    }
  };
  const shared = useMemo(() => createSharedCamera(() => new THREE.Spherical(), () => new THREE.Vector3()), []);
  const [registry] = useState(() => new ControlsRegistry());
  const [els, setEls] = useState<Record<string, HTMLElement | null>>({});
  const onEl = useCallback(
    (id: string, el: HTMLElement | null) => setEls((prev) => (prev[id] === el ? prev : { ...prev, [id]: el })),
    [],
  );
  // Each tile frames the lot + 30 ft margin and the full height of the envelope / options.
  const frame = useMemo(
    () => computeFrame(props.options.slice(0, 6), props.lot, props.envelopeSections, 30),
    [props.options, props.lot, props.envelopeSections],
  );
  const [internal, setInternal] = useState({ preset: props.cameraPreset ?? ("axon-ne" as CameraPreset), nonce: 0 });
  const propKey = `${props.cameraPreset ?? ""}|${props.presetNonce ?? 0}`;
  const [seenKey, setSeenKey] = useState(propKey);
  if (seenKey !== propKey) {
    setSeenKey(propKey);
    if (props.cameraPreset) setInternal((s) => ({ preset: props.cameraPreset!, nonce: s.nonce + 1 }));
  }
  const onPreset = useCallback((p: CameraPreset) => setInternal((s) => ({ preset: p, nonce: s.nonce + 1 })), []);

  return (
    <div className={"relative grid grid-cols-2 grid-rows-3 gap-px bg-rule sm:grid-cols-3 sm:grid-rows-2 " + (props.className ?? "")}>
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        flat
        shadows="percentage"
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
        }}
        style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}
        aria-hidden
      >
        <InvalidateOnLayout />
        {options.map((o) => (
          <TileViewport key={o.id} el={els[o.id] ?? null} onRendered={() => tileRendered(o.id)}>
            <SceneContent
              id={o.id}
              option={o}
              selected={props.selectedId === o.id}
              frame={frame}
              fit="object"
              envelopeSections={props.envelopeSections}
              lot={props.lot}
              context={props.context}
              style={props.style}
              dark={dark}
              sun={props.sun}
              sectionCutZ={props.sectionCutZ}
              preset={internal.preset}
              presetNonce={internal.nonce}
              ambientOcclusion={false}
              reducedMotion={reducedMotion}
              domElement={els[o.id] ?? null}
              controlsRef={registry.refFor(o.id)}
              shared={shared}
            />
          </TileViewport>
        ))}
      </Canvas>
      {options.map((o) => {
        const selected = props.selectedId === o.id;
        return (
          <Tile
            key={o.id}
            option={o}
            selected={selected}
            registry={registry}
            shared={shared}
            onPreset={onPreset}
            onSelect={props.onSelect}
            onEl={onEl}
            reducedMotion={reducedMotion}
            label={props.renderLabel?.(o, selected)}
            overlay={props.renderOverlay?.(o, selected)}
            ariaLabel={props.tileAriaLabel?.(o) ?? o.label}
          />
        );
      })}
    </div>
  );
}
