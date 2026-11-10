// glTF/.glb export. Engine frame is Z-up (x east, y north, z up); glTF is Y-up, +X right, -Z forward.
// Mapping baked into the vertices (no node transform):  gltf = (x, z, -y)
//   engine +z (up)    -> glTF +Y
//   engine +y (north) -> glTF -Z
//   engine +x (east)  -> glTF +X
// This is a proper rotation (det = +1), so triangle winding is preserved. Units stay feet (glTF has no unit field).
// APIs: three/examples/jsm/exporters/GLTFExporter.js (parseAsync, options.binary) — @types/three 0.186.0.
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { prismToMesh } from "@wxy/massing";
import type { MassingOption, Prism } from "@wxy/massing";
import { metricEntries, PROGRAM_HEX, PROGRAM_LABEL, floorsRange, ruleValue } from "./shared";

export interface GltfOptionInput {
  index: number;
  name: string;
  intent?: string;
  option: MassingOption;
}

/** Engine (x,y,z) -> glTF (x, z, -y). Exported for tests. */
export function toGltfAxes(x: number, y: number, z: number): [number, number, number] {
  return [x, z, -y];
}

function prismGeometry(prism: Prism): THREE.BufferGeometry {
  const pm = prismToMesh(prism);
  const pos = new Float32Array(pm.positions.length);
  for (let i = 0; i < pm.positions.length; i += 3) {
    const [x, y, z] = toGltfAxes(pm.positions[i], pm.positions[i + 1], pm.positions[i + 2]);
    pos[i] = x;
    pos[i + 1] = y;
    pos[i + 2] = z;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  if (pm.normals) {
    const nor = new Float32Array(pm.normals.length);
    for (let i = 0; i < pm.normals.length; i += 3) {
      const [x, y, z] = toGltfAxes(pm.normals[i], pm.normals[i + 1], pm.normals[i + 2]);
      nor[i] = x;
      nor[i + 1] = y;
      nor[i + 2] = z;
    }
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  }
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(pm.indices), 1));
  if (!pm.normals) g.computeVertexNormals();
  return g;
}

export function buildGltfScene(options: GltfOptionInput[], meta?: { envelopeId?: string; sample?: boolean }): THREE.Scene {
  const scene = new THREE.Scene();
  scene.name = "WXY Massing Studio";
  scene.userData = {
    generator: "WXY Massing Studio",
    units: "feet",
    axes: "engine z-up -> glTF +Y; engine north (+y) -> glTF -Z; engine east (+x) -> glTF +X",
    envelopeId: meta?.envelopeId ?? null,
    sample: meta?.sample ?? null,
  };
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (p: Prism["program"]) => {
    let m = materials.get(p);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: PROGRAM_HEX[p], roughness: 0.9, metalness: 0 });
      m.name = PROGRAM_LABEL[p];
      materials.set(p, m);
    }
    return m;
  };
  for (const o of options) {
    const group = new THREE.Group();
    group.name = `Option ${o.index} · ${o.name}`;
    group.userData = {
      option: o.index,
      name: o.name,
      intent: o.intent ?? "",
      typology: o.option.typology,
      metrics: Object.fromEntries(metricEntries(o.option.metrics).map(([k, v]) => [k, v === "unavailable" ? null : Number(v)])),
      params: { ...o.option.params },
      compliance: o.option.compliance.map((r) => ({ id: r.id, value: ruleValue(r) })),
    };
    o.option.prisms.forEach((prism) => {
      const mesh = new THREE.Mesh(prismGeometry(prism), mat(prism.program));
      const fl = prism.floors.length ? floorsRange(prism.floors) : null;
      mesh.name = `Option ${o.index} · ${o.name} · ${fl ? `floors ${fl.a}–${fl.b}` : "floors –"}`;
      mesh.userData = { option: o.index, program: prism.program, z0_ft: prism.z0, z1_ft: prism.z1, floors: prism.floors.map((f) => f + 1) };
      group.add(mesh);
    });
    scene.add(group);
  }
  return scene;
}

/** Binary .glb bytes. In Node, GLTFExporter needs FileReader (not in Node) — see tests for the minimal polyfill. */
export async function exportGltf(options: GltfOptionInput[], meta?: { envelopeId?: string; sample?: boolean }): Promise<Uint8Array> {
  const scene = buildGltfScene(options, meta);
  const result = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: false });
  if (!(result instanceof ArrayBuffer)) throw new Error("GLTFExporter did not return a binary glb");
  return new Uint8Array(result);
}
