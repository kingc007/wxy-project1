"use client";
import { useId, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type RootState } from "@react-three/fiber";
import type { CameraControlsImpl } from "@react-three/drei";
import type { MultiPolygon } from "@wxy/massing";
import { SceneContent } from "./SceneContent";
import { computeFrame } from "./frame";
import { useViewerKeys, usePrefersReducedMotion, useMediaQuery, useIsDark, useFirstFrame as useReadyRef } from "./hooks";
import type { SharedCamera } from "./shared-camera";
import type {
  CameraPreset,
  CameraSnapshot,
  ContextBuilding,
  EnvelopeSection,
  SunState,
  ViewerOption,
  ViewerStyle,
} from "./types";

export interface MassingSceneHandle {
  /** Renders the current view and returns it as a PNG blob (for boards). */
  captureImage(): Promise<Blob>;
}

export interface MassingSceneProps {
  ref?: React.Ref<MassingSceneHandle>;
  /** One or more options. The selected one (else the first) is drawn; framing uses all of them. */
  options: ViewerOption[];
  selectedId?: string;
  envelopeSections?: EnvelopeSection[];
  lot?: MultiPolygon;
  context?: ContextBuilding[];
  style: ViewerStyle;
  sun?: SunState;
  sectionCutZ?: number | null;
  cameraPreset?: CameraPreset;
  /** Bump to re-apply the same preset (e.g. clicking "Plan" twice). */
  presetNonce?: number;
  /** Change to play the zoom arrival (e.g. the site id). */
  arrivalKey?: string | number | null;
  onCameraChange?: (snap: CameraSnapshot) => void;
  /** Mirror this camera with other viewports. */
  sharedCamera?: SharedCamera;
  /** Short on-screen summary for assistive tech, e.g. "Option 3, Perimeter courtyard, 9 floors, 92 ft". */
  description?: string;
  /** Night-model palette. */
  dark?: boolean;
  /** N8AO ambient occlusion (model style only). Default on; turn off on low-power devices. */
  ambientOcclusion?: boolean;
  /** Called when the keyboard asks for a preset (Home, P), if the parent owns preset state. */
  onPresetRequest?: (p: CameraPreset) => void;
  /** Fired once, after the first frame has rendered. */
  onReady?: () => void;
  className?: string;
}

function FirstFrame({ onReady }: { onReady: React.RefObject<(() => void) | undefined> }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    // Priority-0 callbacks run before the render in the same tick; the next animation frame is after it.
    requestAnimationFrame(() => onReady.current?.());
  });
  return null;
}

export function MassingScene({ ref: handleRef, ...props }: MassingSceneProps) {
  const { options, selectedId, style, className } = props;
  const uid = useId();
  const helpId = `${uid}-help`;
  const reducedMotion = usePrefersReducedMotion();
  const dark = useIsDark(props.dark);
  const readyRef = useReadyRef(props.onReady);
  const lowPower = useMediaQuery("(prefers-reduced-data: reduce)");
  const controlsRef = useRef<CameraControlsImpl | null>(null);
  const getState = useRef<(() => RootState) | null>(null);

  useImperativeHandle(handleRef, () => ({
    captureImage: () =>
      new Promise<Blob>((resolve, reject) => {
        const st = getState.current?.();
        if (!st) return reject(new Error("Viewer is not ready"));
        // Render synchronously, then read the canvas in the same task (also backed by preserveDrawingBuffer).
        st.advance(performance.now() / 1000, true);
        st.gl.domElement.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas capture failed"))), "image/png");
      }),
  }));

  const [internal, setInternal] = useState<{ preset: CameraPreset; nonce: number }>({
    preset: props.cameraPreset ?? "axon-ne",
    nonce: 0,
  });
  // Adopt a new preset prop during render (no effect needed).
  const propKey = `${props.cameraPreset ?? ""}|${props.presetNonce ?? 0}`;
  const [seenKey, setSeenKey] = useState(propKey);
  if (seenKey !== propKey) {
    setSeenKey(propKey);
    if (props.cameraPreset) setInternal((s) => ({ preset: props.cameraPreset!, nonce: s.nonce + 1 }));
  }
  const requestPreset = (p: CameraPreset) => {
    setInternal((s) => ({ preset: p, nonce: s.nonce + 1 }));
    props.onPresetRequest?.(p);
  };

  const option = useMemo(
    () => options.find((o) => o.id === selectedId) ?? options[0] ?? null,
    [options, selectedId],
  );
  const frame = useMemo(
    () => computeFrame(options, props.lot, props.envelopeSections),
    [options, props.lot, props.envelopeSections],
  );

  const onKeyDown = useViewerKeys({
    controls: controlsRef,
    onPreset: requestPreset,
    shared: props.sharedCamera,
    id: "main",
    reducedMotion,
  });

  return (
    <div
      role="application"
      aria-label="3D massing viewer"
      aria-describedby={helpId}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={
        "relative size-full touch-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring " +
        (className ?? "")
      }
    >
      <span id={helpId} className="sr-only">
        Drag to orbit, scroll to zoom. Arrow keys orbit 15 degrees, plus and minus zoom, Home returns to the axon
        view, P shows plan.
      </span>
      <span aria-live="polite" className="sr-only">
        {props.description ?? ""}
      </span>
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        flat
        shadows="percentage"
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onCreated={(state) => {
          getState.current = state.get;
          state.gl.localClippingEnabled = true;
        }}
        style={{ position: "absolute", inset: 0 }}
        aria-hidden
      >
        <FirstFrame onReady={readyRef} />
        <SceneContent
          id="main"
          option={option}
          selected={false}
          frame={frame}
          envelopeSections={props.envelopeSections}
          lot={props.lot}
          context={props.context}
          style={style}
          dark={dark}
          sun={props.sun}
          sectionCutZ={props.sectionCutZ}
          preset={internal.preset}
          presetNonce={internal.nonce}
          arrivalKey={props.arrivalKey}
          ambientOcclusion={(props.ambientOcclusion ?? true) && !lowPower}
          reducedMotion={reducedMotion}
          controlsRef={controlsRef}
          shared={props.sharedCamera}
          onCameraChange={props.onCameraChange}
        />
      </Canvas>
    </div>
  );
}
