"use client";
// Scissor-rendered viewport for one grid tile, used instead of drei <View> (see viewport.ts for why).
// Children render into a virtual scene with their own camera; the tile's DOM element defines the rect.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { tileScissor } from "./viewport";

function TileRenderer({
  el,
  onRendered,
  children,
}: {
  el: HTMLElement;
  onRendered?: () => void;
  children: React.ReactNode;
}) {
  const reported = useRef(false);
  useFrame((state) => {
    const sc = tileScissor(el.getBoundingClientRect(), state.gl.domElement.getBoundingClientRect());
    if (sc.offscreen) return;
    const cam = state.camera as THREE.PerspectiveCamera;
    if (cam.isPerspectiveCamera) {
      const aspect = sc.width / sc.height;
      if (cam.aspect !== aspect) {
        cam.aspect = aspect;
        cam.updateProjectionMatrix();
      }
    }
    const { gl } = state;
    const autoClear = gl.autoClear;
    gl.autoClear = false;
    gl.setViewport(sc.left, sc.bottom, sc.width, sc.height);
    gl.setScissor(sc.left, sc.bottom, sc.width, sc.height);
    gl.setScissorTest(true);
    gl.render(state.scene, state.camera);
    gl.setScissorTest(false);
    gl.autoClear = autoClear;
    if (!reported.current) {
      reported.current = true;
      requestAnimationFrame(() => onRendered?.());
    }
  }, 1);
  return <>{children}</>;
}

export function TileViewport({
  el,
  onRendered,
  children,
}: {
  el: HTMLElement | null;
  /** Called once after this tile has drawn its first frame. */
  onRendered?: () => void;
  children: React.ReactNode;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const [scene] = useState(() => new THREE.Scene());
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((prev) => (prev && prev.width === r.width && prev.height === r.height ? prev : { width: r.width, height: r.height }));
      invalidate();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, invalidate]);

  if (!el || !size || size.width <= 0 || size.height <= 0) return null;
  return createPortal(<TileRenderer el={el} onRendered={onRendered}>{children}</TileRenderer>, scene, {
    size: { width: size.width, height: size.height, top: 0, left: 0 },
  });
}
