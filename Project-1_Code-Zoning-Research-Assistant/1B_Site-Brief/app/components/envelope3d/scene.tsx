"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { EnvelopeSolids } from "@/lib/geometry/envelope-solids";
import { bbox } from "@/lib/geometry/polygon";
import type { ThemeColors } from "@/components/map/use-theme-colors";

export interface SceneProps {
  solids: EnvelopeSolids;
  colors: ThemeColors;
  reducedMotion: boolean;
  hovered: string | null;
  selected: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  label: string;
}

const toShape = (pts: [number, number][]) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
const FACE_OPACITY = 0.08;

function useDisposed(...geoms: THREE.BufferGeometry[]) {
  useEffect(() => () => geoms.forEach((g) => g.dispose()), [geoms]);
}

interface SolidProps {
  id: string;
  fill: THREE.BufferGeometry;
  z: number;
  isActive: boolean;
  colors: ThemeColors;
  baseColor: string;
  faceOpacity?: number;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

function Solid({ id, fill, z, isActive, colors, baseColor, faceOpacity = FACE_OPACITY, onHover, onSelect }: SolidProps) {
  const edges = useMemo(() => new THREE.EdgesGeometry(fill), [fill]);
  useDisposed(fill, edges);
  return (
    <group position={[0, 0, z]}>
      <mesh
        geometry={fill}
        onPointerOver={(e) => { e.stopPropagation(); onHover(id); }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => { e.stopPropagation(); onSelect(id); }}
      >
        <meshBasicMaterial
          color={isActive ? colors.signal : baseColor}
          transparent opacity={isActive ? faceOpacity * 2 : faceOpacity}
          side={THREE.DoubleSide} depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={isActive ? colors.signal : baseColor} />
      </lineSegments>
    </group>
  );
}

function PrismSolid({ stage, ...rest }: { stage: EnvelopeSolids["stages"][number] } & Omit<SolidProps, "id" | "fill" | "z" | "baseColor" | "isActive"> & { active: string | null }) {
  const fill = useMemo(
    () => new THREE.ExtrudeGeometry(toShape(stage.footprint), { depth: stage.z1 - stage.z0, bevelEnabled: false }),
    [stage],
  );
  return <Solid id={stage.id} fill={fill} z={stage.z0} baseColor={rest.colors.ink} isActive={rest.active === stage.id} {...rest} />;
}

function SkySolid({ plane, ...rest }: { plane: EnvelopeSolids["skyPlanes"][number] } & Omit<SolidProps, "id" | "fill" | "z" | "baseColor" | "isActive"> & { active: string | null }) {
  const fill = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(plane.corners.flat(), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    return g;
  }, [plane]);
  return <Solid id={plane.id} fill={fill} z={0} baseColor={rest.colors.ink3} faceOpacity={0.14} isActive={rest.active === plane.id} {...rest} />;
}

/** Text label as a constant-screen-size sprite (canvas texture): no DOM overlay, no font download. */
function HeightTag({ pos, text, colors }: { pos: [number, number, number]; text: string; colors: ThemeColors }) {
  const viewH = useThree((st) => st.size.height);
  const { texture, aspect } = useMemo(() => {
    const px = 2; // texture pixel ratio for crisp text
    const font = `${11 * px}px ui-monospace, Menlo, Consolas, monospace`;
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d")!;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 10 * px;
    const h = 18 * px;
    c.width = w;
    c.height = h;
    ctx.font = font;
    ctx.fillStyle = colors.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = colors.ruleStrong;
    ctx.lineWidth = px;
    ctx.strokeRect(px / 2, px / 2, w - px, h - px);
    ctx.fillStyle = colors.ink;
    ctx.textBaseline = "middle";
    ctx.fillText(text, 5 * px, h / 2 + px / 2);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { texture: t, aspect: w / h };
  }, [text, colors.paper, colors.ruleStrong, colors.ink]);
  useEffect(() => () => texture.dispose(), [texture]);
  const k = 18 / Math.max(viewH, 1); // 18 css px tall, whatever the canvas height (sizeAttenuation off)
  return (
    <sprite position={pos} scale={[k * aspect, k, 1]} renderOrder={10}>
      <spriteMaterial map={texture} sizeAttenuation={false} depthTest={false} transparent />
    </sprite>
  );
}

/**
 * With frameloop="demand" nothing redraws unless something invalidates. The first frame can be drawn into a
 * canvas that is then resized/cleared by layout (0-size container at mount, fonts, sibling panels), leaving it
 * blank until the user interacts. Re-invalidate for a few frames after mount and on every container resize.
 */
function KeepDrawn() {
  const invalidate = useThree((st) => st.invalidate);
  const dom = useThree((st) => st.gl.domElement);
  useEffect(() => {
    let frames = 0;
    let raf = 0;
    const tick = () => {
      invalidate();
      if (++frames < 30) raf = requestAnimationFrame(tick);
    };
    tick();
    const ro = new ResizeObserver(() => invalidate());
    ro.observe(dom.parentElement ?? dom);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [invalidate, dom]);
  return null;
}

/** Place the camera so the whole envelope fits the canvas for its actual aspect ratio; refit on resize. */
const DIR: [number, number, number] = [-1.2, 1.3, 1.7];

function FitCamera({ target, radius }: { target: [number, number, number]; radius: number }) {
  const [tx, ty, tz] = target;
  const dir = DIR;
  const size = useThree((st) => st.size);
  const camera = useThree((st) => st.camera) as THREE.PerspectiveCamera;
  const controls = useThree((st) => st.controls) as { update?: () => void } | null;
  const invalidate = useThree((st) => st.invalidate);
  useEffect(() => {
    if (size.width < 1 || size.height < 1) return;
    const vf = (camera.fov * Math.PI) / 180;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * (size.width / size.height));
    const dist = radius / Math.sin(Math.min(vf, hf) / 2);
    const len = Math.hypot(...dir);
    camera.position.set(tx + (dir[0] / len) * dist, ty + (dir[1] / len) * dist, tz + (dir[2] / len) * dist);
    camera.lookAt(tx, ty, tz);
    camera.updateProjectionMatrix();
    controls?.update?.();
    invalidate();
  }, [size.width, size.height, camera, controls, invalidate, radius, tx, ty, tz, dir]);
  return null;
}

export function EnvelopeScene(p: SceneProps) {
  const { solids, colors } = p;
  const active = p.hovered ?? p.selected;
  const bb = useMemo(() => bbox(solids.lot), [solids.lot]);
  const W = bb.maxX - bb.minX;
  const D = bb.maxY - bb.minY;
  const H = solids.topHeight ?? 40;
  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;
  const span = Math.max(Math.hypot(W, D), H, 20);
  // The scene is built Z-up in local feet (x east, y north) and rotated into three's Y-up world.
  const target: [number, number, number] = [cx, H / 2, -cy];
  const camPos: [number, number, number] = [cx - span * 1.2, H / 2 + span * 1.3, -cy + span * 1.7];
  const radius = 0.55 * Math.sqrt(W * W + D * D + H * H);
  const axisLen = Math.max(8, span * 0.12);

  const lotShape = useMemo(() => toShape(solids.lot), [solids.lot]);
  const lotFill = useMemo(() => new THREE.ShapeGeometry(lotShape), [lotShape]);
  const lotEdges = useMemo(() => new THREE.EdgesGeometry(lotFill), [lotFill]);
  useDisposed(lotFill, lotEdges);

  const axes = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const o = [bb.minX - axisLen * 0.6, bb.minY - axisLen * 0.6, 0];
    g.setAttribute("position", new THREE.Float32BufferAttribute([
      ...o, o[0] + axisLen, o[1], o[2],
      ...o, o[0], o[1] + axisLen, o[2],
      ...o, o[0], o[1], o[2] + axisLen,
    ], 3));
    return g;
  }, [bb, axisLen]);
  useDisposed(axes);
  const ao: [number, number, number] = [bb.minX - axisLen * 0.6, bb.minY - axisLen * 0.6, 0];

  const gridSize = Math.ceil((span * 2.4) / 10) * 10;

  return (
    <Canvas
      key={`${cx}|${cy}|${W}|${D}|${H}`}
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ position: camPos, fov: 35, near: 1, far: 20000 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.domElement.tabIndex = 0;
        gl.domElement.setAttribute("role", "img");
        gl.domElement.setAttribute("aria-label", p.label);
      }}
    >
      <KeepDrawn />
      <FitCamera target={target} radius={radius} />
      <gridHelper
        args={[gridSize, gridSize / 10, colors.ruleStrong, colors.rule]}
        position={[Math.round(cx / 10) * 10, -0.05, -Math.round(cy / 10) * 10]}
      />
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh geometry={lotFill}>
          <meshBasicMaterial color={colors.paper} transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <lineSegments geometry={lotEdges}>
          <lineBasicMaterial color={colors.ink} />
        </lineSegments>
        {solids.stages.map((s) => (
          <PrismSolid key={s.id} stage={s} colors={colors} active={active} onHover={p.onHover} onSelect={p.onSelect} />
        ))}
        {solids.skyPlanes.map((s) => (
          <SkySolid key={s.id} plane={s} colors={colors} active={active} onHover={p.onHover} onSelect={p.onSelect} />
        ))}
        {solids.stages.map((s) => (
          <HeightTag key={`${s.id}-tag`} pos={[s.footprint[1][0], s.footprint[1][1], s.z1]} text={`${Math.round(s.z1 * 100) / 100} ft`} colors={colors} />
        ))}
        <lineSegments geometry={axes}>
          <lineBasicMaterial color={colors.ink2} />
        </lineSegments>
        <HeightTag pos={[ao[0] + axisLen + 3, ao[1], 0]} text="E" colors={colors} />
        <HeightTag pos={[ao[0], ao[1] + axisLen + 3, 0]} text="N" colors={colors} />
        <HeightTag pos={[ao[0], ao[1], axisLen + 3]} text="Z" colors={colors} />
      </group>
      <OrbitControls makeDefault target={target} enableDamping={!p.reducedMotion} keyEvents autoRotate={false} />
    </Canvas>
  );
}
