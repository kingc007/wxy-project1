"use client";
// Small generated hatch textures (client only). UVs are in feet; repeat = 1 / TILE_FT.
import * as THREE from "three";

export const HATCH_TILE_FT = 8;
const cache = new Map<string, THREE.CanvasTexture>();

/** angle: 45 for commercial, 135 for community facility. */
export function hatchTexture(base: string, line: string, angle: 45 | 135): THREE.CanvasTexture {
  const key = `${base}|${line}|${angle}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = line;
  ctx.lineWidth = 5;
  ctx.beginPath();
  // Canvas y is down, uv v is up, so 45deg in uv space = line from bottom-left to top-right = (0,S)->(S,0).
  const d = angle === 45 ? 1 : -1;
  for (const off of [-S, 0, S]) {
    if (d === 1) {
      ctx.moveTo(off, S);
      ctx.lineTo(off + S, 0);
    } else {
      ctx.moveTo(off, 0);
      ctx.lineTo(off + S, S);
    }
  }
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / HATCH_TILE_FT, 1 / HATCH_TILE_FT);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}
