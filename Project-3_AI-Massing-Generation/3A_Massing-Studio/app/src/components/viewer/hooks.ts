"use client";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import * as THREE from "three";
import type { Prism } from "@wxy/massing";
import { prismToGeometry } from "./mesh";
import { KEY_ORBIT_STEP } from "./camera";
import type { CameraPreset } from "./types";
import type { CameraControlsImpl } from "@react-three/drei";
import type { SharedCamera } from "./shared-camera";

function subscribeMq(query: string) {
  return (cb: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  };
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    useMemo(() => subscribeMq(query), [query]),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const usePrefersReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");

function prismKey(p: Prism): string {
  return `${p.id}|${p.z0}|${p.z1}|${p.polygon.outer.join(";")}|${p.polygon.holes.map((h) => h.join(";")).join("/")}`;
}

// Module-level geometry cache keyed by prism id + shape, reference counted by mounted users.
const geomCache = new Map<string, { geometry: THREE.BufferGeometry; users: number }>();

function acquire(p: Prism, key: string): THREE.BufferGeometry {
  let e = geomCache.get(key);
  if (!e) {
    e = { geometry: prismToGeometry(p), users: 0 };
    geomCache.set(key, e);
  }
  return e.geometry;
}

/** Geometries memoised by prism id + shape; disposed when no mounted viewer uses them any more. */
export function useGeometries(prisms: Prism[]): THREE.BufferGeometry[] {
  const keys = useMemo(() => prisms.map(prismKey), [prisms]);
  const list = useMemo(() => prisms.map((p, i) => acquire(p, keys[i])), [prisms, keys]);
  useEffect(() => {
    keys.forEach((k) => {
      const e = geomCache.get(k);
      if (e) e.users++;
    });
    return () => {
      keys.forEach((k) => {
        const e = geomCache.get(k);
        if (e && --e.users <= 0) {
          e.geometry.dispose();
          geomCache.delete(k);
        }
      });
    };
  }, [keys]);
  return list;
}

interface KeyOpts {
  controls: React.RefObject<CameraControlsImpl | null>;
  onPreset?: (p: CameraPreset) => void;
  shared?: SharedCamera;
  id?: string;
  reducedMotion: boolean;
}

/** Keyboard camera control for a focused viewer: arrows orbit 15 deg, +/- dolly, Home axon, P plan. */
export function useViewerKeys({ controls, onPreset, shared, id, reducedMotion }: KeyOpts) {
  return (e: React.KeyboardEvent) => {
    const c = controls.current;
    if (!c || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = !reducedMotion;
    let handled = true;
    c.stop(); // any key input interrupts a running preset tween
    switch (e.key) {
      case "ArrowLeft": void c.rotate(KEY_ORBIT_STEP, 0, t); break;
      case "ArrowRight": void c.rotate(-KEY_ORBIT_STEP, 0, t); break;
      case "ArrowUp": void c.rotate(0, -KEY_ORBIT_STEP, t); break;
      case "ArrowDown": void c.rotate(0, KEY_ORBIT_STEP, t); break;
      case "+": case "=": void c.dolly(c.distance * 0.15, t); break;
      case "-": case "_": void c.dolly(-c.distance * 0.18, t); break;
      case "Home": onPreset?.("axon-ne"); break;
      case "p": case "P": onPreset?.("plan"); break;
      default: handled = false;
    }
    if (!handled) return;
    e.preventDefault();
    if (shared && id) shared.sync(id, t);
  };
}

function subscribeDark(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => {
    mq.removeEventListener("change", cb);
    mo.disconnect();
  };
}

function darkSnapshot(): boolean {
  const cl = document.documentElement.classList;
  if (cl.contains("dark")) return true;
  if (cl.contains("light")) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Night-model detection: `.dark` on <html> wins, else `.light`, else prefers-color-scheme. */
export function useIsDark(explicit?: boolean): boolean {
  const auto = useSyncExternalStore(subscribeDark, darkSnapshot, () => false);
  return explicit ?? auto;
}

/** Calls onReady once, after the first frame has rendered (place inside a Canvas). */
export function useFirstFrame(onReady: (() => void) | undefined) {
  const cb = useRef(onReady);
  useEffect(() => {
    cb.current = onReady;
  });
  return cb;
}
