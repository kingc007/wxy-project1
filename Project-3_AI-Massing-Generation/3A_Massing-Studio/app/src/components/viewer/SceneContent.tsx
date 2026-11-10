"use client";
// Everything that lives inside an R3F <Canvas> (or a drei <View>) for the massing viewer.
//
// Z-up approach: the camera and lights live in three's native Y-up world (north = -Z, east = +X).
// All engine geometry (x east, y north, z up, feet) sits in ONE <group> rotated -90deg about X and
// translated by (-cx, 0, +cy):   world = (x - cx, z, -(y - cy)).   Geometry is never rewritten.
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import {
  Billboard,
  CameraControls,
  type CameraControlsImpl,
  Edges,
  Grid,
  Line,
  PerspectiveCamera,
  Text,
} from "@react-three/drei";
import { EffectComposer, N8AO, SMAA } from "@react-three/postprocessing";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Prism } from "@wxy/massing";
import { bandPrisms, labelAnchor, sectionCutSegments } from "./mesh";
import { DEFAULT_FOV, engineDirToWorld, presetPose, type FitMode, type SceneFrame } from "./camera";
import { CHROME, CONTEXT_MASS, CONTEXT_MASS_DARK, MODEL_MASS, MODEL_MASS_DARK, PROGRAM_COLOR } from "./palette";
import { hatchTexture } from "./hatch";
import { useGeometries } from "./hooks";
import type { SharedCamera } from "./shared-camera";
import {
  PROGRAM_LABEL,
  type CameraPreset,
  type CameraSnapshot,
  type ContextBuilding,
  type EnvelopeSection,
  type ViewerOption,
  type ViewerStyle,
  type SunState,
} from "./types";
import type { MultiPolygon } from "@wxy/massing";

export interface SceneContentProps {
  id: string;
  option: ViewerOption | null;
  /** Heavy graphite outline (selection is graphite, never the cobalt accent). */
  selected?: boolean;
  frame: SceneFrame;
  /** "context" (default) frames the model plus surroundings; "object" frames lot + full height (grid tiles). */
  fit?: FitMode;
  envelopeSections?: EnvelopeSection[];
  lot?: MultiPolygon;
  context?: ContextBuilding[];
  style: ViewerStyle;
  dark?: boolean;
  sun?: SunState;
  sectionCutZ?: number | null;
  preset: CameraPreset;
  /** Bump to re-apply the same preset. */
  presetNonce?: number;
  /** Change to play the zoom arrival (camera eases in from a high, wide pose). Skipped under reduced motion. */
  arrivalKey?: string | number | null;
  ambientOcclusion?: boolean;
  reducedMotion: boolean;
  /** Element the camera controller listens on (a View tile); defaults to the canvas. */
  domElement?: HTMLElement | null;
  controlsRef: React.RefObject<CameraControlsImpl | null>;
  shared?: SharedCamera;
  onCameraChange?: (snap: CameraSnapshot) => void;
}

const FOV = DEFAULT_FOV;
const SMOOTH = 0.25;
const ARRIVAL_SMOOTH = 1.0;
function setSmooth(c: CameraControlsImpl, t: number) {
  c.smoothTime = t;
}
/** High, wide start pose for the zoom arrival: pulled back along the same view line and lifted. */
function arrivalPose(pose: { position: [number, number, number]; target: [number, number, number] }) {
  const [px, py, pz] = pose.position;
  const [tx, ty, tz] = pose.target;
  const k = 2.2;
  return [tx + (px - tx) * k, ty + (py - ty) * k + Math.abs(py - ty) * 0.6, tz + (pz - tz) * k] as [number, number, number];
}
// IBM Plex Mono 500 (latin), OFL, bundled from @fontsource/ibm-plex-mono so labels work offline.
// troika-three-text reads .ttf/.otf/.woff (not .woff2).
const LABEL_FONT_URL = new URL("./fonts/ibm-plex-mono-latin-500-normal.woff", import.meta.url).toString();

function mergeOrNull(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  const g = geoms.filter((x) => x.getAttribute("position").count > 0);
  if (g.length === 0) return null;
  return g.length === 1 ? g[0].clone() : mergeGeometries(g, false);
}

function setPlaneConstant(plane: THREE.Plane, z: number | null | undefined) {
  if (z != null) plane.constant = z;
}

function applyClip(mats: THREE.Material[], plane: THREE.Plane | null) {
  for (const m of mats) {
    m.clippingPlanes = plane ? [plane] : null;
    m.clipShadows = true;
    m.side = plane ? THREE.DoubleSide : THREE.FrontSide;
    m.needsUpdate = true;
  }
}

function useMerged(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  const merged = useMemo(() => mergeOrNull(geoms), [geoms]);
  useEffect(() => () => merged?.dispose(), [merged]);
  return merged;
}

export function SceneContent(p: SceneContentProps) {
  const { frame, style, option, selected = false, reducedMotion, controlsRef, shared, id } = p;
  const dark = !!p.dark;
  const chrome = dark ? CHROME.dark : CHROME.light;
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 1;
  const aspectRef = useRef(aspect);
  useEffect(() => {
    aspectRef.current = aspect;
  });
  const [cam, setCam] = useState<THREE.PerspectiveCamera | null>(null);
  const [ctl, setCtl] = useState<CameraControlsImpl | null>(null);
  const el = p.domElement ?? gl.domElement;

  // ---- geometry (memoised by prism id, disposed on unmount)
  const prisms = useMemo<Prism[]>(() => option?.prisms ?? [], [option]);
  const massGeoms = useGeometries(prisms);

  const ctxPrisms = useMemo<Prism[]>(
    () =>
      (p.context ?? []).map((c, i) => ({
        id: `ctx-${i}`,
        polygon: c.polygon,
        z0: 0,
        z1: c.height,
        program: "residential" as const,
        floors: [],
      })),
    [p.context],
  );
  const ctxGeoms = useGeometries(ctxPrisms);
  const ctxMerged = useMerged(ctxGeoms);

  const envPrisms = useMemo<Prism[]>(() => {
    const s = [...(p.envelopeSections ?? [])].sort((a, b) => a.z - b.z);
    // SIMPLIFIED: section i is drawn as a band from its z up to the next section's z.
    return s.slice(0, -1).flatMap((sec, i) => bandPrisms(`env-${i}`, sec.polygons, sec.z, s[i + 1].z));
  }, [p.envelopeSections]);
  const envGeoms = useGeometries(envPrisms);
  const envMerged = useMerged(envGeoms);

  // ---- section cut
  const cutEnabled = p.sectionCutZ != null;
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), []);
  // world y == engine z (group has no y offset)
  useEffect(() => {
    setPlaneConstant(plane, p.sectionCutZ);
    invalidate();
  }, [plane, p.sectionCutZ, invalidate]);
  const clipPlanes = cutEnabled ? [plane] : undefined;
  const cutPoints = useMemo(() => {
    if (p.sectionCutZ == null) return [];
    const seg = sectionCutSegments(prisms, p.sectionCutZ);
    const pts: [number, number, number][] = [];
    for (let i = 0; i < seg.length; i += 3) pts.push([seg[i], seg[i + 1], seg[i + 2] + 0.05]);
    return pts;
  }, [prisms, p.sectionCutZ]);

  // ---- materials
  const materials = useMemo(() => {
    const model = new THREE.MeshStandardMaterial({ color: dark ? MODEL_MASS_DARK : MODEL_MASS, roughness: 1, metalness: 0 });
    const context = new THREE.MeshStandardMaterial({ color: dark ? CONTEXT_MASS_DARK : CONTEXT_MASS, roughness: 1, metalness: 0 });
    const pc = dark ? PROGRAM_COLOR.dark : PROGRAM_COLOR.light;
    const line = chrome.graphite;
    const diagram = {
      residential: new THREE.MeshBasicMaterial({ color: pc.residential }),
      commercial: new THREE.MeshBasicMaterial({ color: "#ffffff", map: hatchTexture(pc.commercial, line, 45) }),
      community_facility: new THREE.MeshBasicMaterial({
        color: "#ffffff",
        map: hatchTexture(pc.community_facility, line, 135),
      }),
    };
    return { model, context, diagram };
  }, [dark, chrome.graphite]);
  useEffect(() => {
    applyClip([materials.model, materials.context, ...Object.values(materials.diagram)], cutEnabled ? plane : null);
    invalidate();
  }, [materials, cutEnabled, plane, invalidate]);
  useEffect(
    () => () => {
      [materials.model, materials.context, ...Object.values(materials.diagram)].forEach((m) => m.dispose());
    },
    [materials],
  );

  // ---- camera
  const frameKey = `${frame.cx.toFixed(1)}|${frame.cy.toFixed(1)}|${frame.radius.toFixed(1)}|${frame.height.toFixed(1)}`;
  const first = useRef(true);
  const arrivedFor = useRef<string | number | null | undefined>(undefined);
  useEffect(() => {
    if (!ctl || !cam) return;
    const pose = presetPose(p.preset, frame, { fovDeg: FOV, fit: p.fit, aspect: aspectRef.current });
    const arriving = p.arrivalKey != null && arrivedFor.current !== p.arrivalKey;
    if (arriving) arrivedFor.current = p.arrivalKey;
    if (arriving && !reducedMotion) {
      // Zoom arrival: jump to a high wide pose, then ease in. Any user input stops it (onControlStart / wheel).
      first.current = false;
      const [wx, wy, wz] = arrivalPose(pose);
      void ctl.setLookAt(wx, wy, wz, ...pose.target, false);
      setSmooth(ctl, ARRIVAL_SMOOTH);
      void ctl.setLookAt(...pose.position, ...pose.target, true);
      return;
    }
    const animate = !reducedMotion && !first.current;
    first.current = false;
    void ctl.setLookAt(...pose.position, ...pose.target, animate); // from the CURRENT camera, not a logical target
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctl, cam, p.preset, p.presetNonce, p.arrivalKey, frameKey, reducedMotion]);

  useEffect(() => {
    if (!ctl || !shared) return;
    return shared.register(id, ctl);
  }, [ctl, shared, id]);

  // Wheel does not emit controlstart in camera-controls, so interrupt tweens ourselves.
  useEffect(() => {
    if (!ctl) return;
    const stop = () => {
      setSmooth(ctl, SMOOTH);
      ctl.stop();
    };
    el.addEventListener("wheel", stop, { passive: true });
    return () => el.removeEventListener("wheel", stop);
  }, [ctl, el]);

  const snapshot = (): CameraSnapshot | null => {
    if (!ctl) return null;
    const s = ctl.getSpherical(new THREE.Spherical());
    const t = ctl.getTarget(new THREE.Vector3());
    return { azimuth: s.theta, polar: s.phi, distance: s.radius, target: [t.x, t.y, t.z] };
  };

  // ---- lights
  const sun = p.sun;
  const sunDir = useMemo(() => {
    const d = engineDirToWorld(sun?.dir ?? [0, 0, 1]);
    const v = new THREE.Vector3(...d).normalize();
    return v;
  }, [sun?.dir]);
  const sunUp = !!sun?.enabled && sunDir.y > 0.02;
  const R = frame.radius;
  const keyPos = useMemo(() => {
    const v = new THREE.Vector3(...engineDirToWorld([-0.5, -0.6, 0.8])).normalize();
    return v.multiplyScalar(R * 4).toArray() as [number, number, number];
  }, [R]);
  const sunPos = sunDir.clone().multiplyScalar(R * 4).toArray() as [number, number, number];

  const gridSize = R * 10;
  const labelPrisms = style === "diagram" ? prisms : [];
  const lineW = selected ? 2.5 : 1;

  return (
    <>
      <color attach="background" args={[chrome.paper]} />
      <PerspectiveCamera ref={setCam} makeDefault fov={FOV} near={1} far={R * 80} />
      {cam && (
        <CameraControls
          ref={(c) => {
            controlsRef.current = c;
            setCtl(c);
          }}
          camera={cam}
          domElement={p.domElement ?? undefined}
          smoothTime={SMOOTH}
          draggingSmoothTime={0.08}
          minDistance={Math.min(20, R * 0.3)}
          maxDistance={R * 12}
          maxPolarAngle={Math.PI / 2 - 0.005}
          onControlStart={() => {
            if (ctl) setSmooth(ctl, SMOOTH);
            ctl?.stop();
          }}
          onControl={() => {
            if (shared && !shared.isSyncing()) shared.sync(id, true);
          }}
          onControlEnd={() => {
            const s = snapshot();
            if (s) p.onCameraChange?.(s);
          }}
          onRest={() => {
            if (ctl) setSmooth(ctl, SMOOTH);
            const s = snapshot();
            if (s) p.onCameraChange?.(s);
          }}
        />
      )}

      {/* lights (world frame) */}
      <ambientLight intensity={sunUp ? 1.3 : 1.55} />
      <hemisphereLight args={["#ffffff", "#e6e2d8", sunUp ? 0.8 : 0.9]} />
      {sunUp ? (
        <directionalLight
          position={sunPos}
          intensity={2.0}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.3}
          shadow-radius={3}
          shadow-camera-left={-R * 1.8}
          shadow-camera-right={R * 1.8}
          shadow-camera-top={R * 1.8}
          shadow-camera-bottom={-R * 1.8}
          shadow-camera-near={1}
          shadow-camera-far={R * 10}
        />
      ) : (
        !sun?.enabled && <directionalLight position={keyPos} intensity={1.3} />
      )}

      {/* ground: faint plan grid (10 ft minor / 50 ft major, aligned to engine coordinates) + shadow catcher */}
      <Grid
        position={[-frame.cx, -0.1, frame.cy]}
        args={[gridSize, gridSize]}
        cellSize={10}
        sectionSize={50}
        cellThickness={0.5}
        sectionThickness={0.9}
        cellColor={chrome.rule}
        sectionColor={chrome.rule}
        fadeDistance={R * 5}
        fadeStrength={1.5}
        side={THREE.DoubleSide}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[R * 8, R * 8]} />
        <shadowMaterial opacity={dark ? 0.35 : 0.18} transparent />
      </mesh>

      {/* engine frame */}
      <group rotation={[-Math.PI / 2, 0, 0]} position={[-frame.cx, 0, frame.cy]}>
        {ctxMerged && (
          <mesh geometry={ctxMerged} material={materials.context} castShadow receiveShadow>
            <Edges threshold={25} color={dark ? "#55585d" : "#b9b6ae"} lineWidth={1} clippingPlanes={clipPlanes} />
          </mesh>
        )}

        {option &&
          prisms.map((pr, i) => (
            <mesh
              key={pr.id}
              geometry={massGeoms[i]}
              material={style === "model" ? materials.model : materials.diagram[pr.program]}
              castShadow
              receiveShadow
            >
              <Edges
                threshold={25}
                color={chrome.graphite}
                lineWidth={lineW}
                clippingPlanes={clipPlanes}
                transparent={dark}
                opacity={dark ? 0.6 : 1}
              />
            </mesh>
          ))}

        {envMerged && (
          <mesh geometry={envMerged} renderOrder={2}>
            <meshBasicMaterial
              color={chrome.graphite2}
              transparent
              opacity={0.06}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
            <Edges threshold={1} color={chrome.graphite2} lineWidth={1} transparent opacity={0.6} depthWrite={false} />
          </mesh>
        )}

        {p.lot?.map((poly, i) => (
          <Line
            key={`lot-${i}`}
            points={[...poly.outer, poly.outer[0]].map(([x, y]) => [x, y, 0.1] as [number, number, number])}
            color={chrome.graphite}
            lineWidth={1.5}
            dashed
            dashSize={4}
            gapSize={3}
          />
        ))}

        {cutPoints.length > 0 && (
          <Line points={cutPoints} segments color={chrome.graphite} lineWidth={2.5} />
        )}

        <Suspense fallback={null}>
          {labelPrisms.map((pr) => {
            const a = labelAnchor(pr.polygon);
            if (a.clearance < 6) return null;
            if (cutEnabled && p.sectionCutZ != null && pr.z1 > p.sectionCutZ) return null;
            const size = Math.max(3, Math.min(12, a.clearance * 0.7));
            return (
              <Billboard key={`lbl-${pr.id}`} position={[a.x, a.y, pr.z1 + 2]}>
                <Text
                  font={LABEL_FONT_URL}
                  fontSize={size}
                  color={chrome.graphite}
                  anchorX="center"
                  anchorY="middle"
                  outlineWidth={size * 0.12}
                  outlineColor={chrome.paper}
                >
                  {PROGRAM_LABEL[pr.program]}
                </Text>
              </Billboard>
            );
          })}
        </Suspense>
      </group>

      {p.ambientOcclusion && style === "model" && (
        <EffectComposer enableNormalPass={false} multisampling={0}>
          <N8AO aoRadius={Math.min(24, Math.max(8, R * 0.08))} distanceFalloff={1} intensity={1.0} quality="medium" halfRes />
          <SMAA />
        </EffectComposer>
      )}
    </>
  );
}
