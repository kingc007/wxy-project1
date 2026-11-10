// manifold-3d with the wasm inlined. The engine calls Module({locateFile}); we add wasmBinary (emscripten honours it
// before locateFile) so nothing is fetched.
// @ts-expect-error resolved by absolute path (the alias for "manifold-3d" points here, so this path avoids recursion)
import Real from "__MANIFOLD_JS__";
import wasmB64 from "virtual:wasm-manifold";
import { inflateBase64Gzip } from "./wasm";

export default async function Module(cfg?: Record<string, unknown>) {
  const wasmBinary = await inflateBase64Gzip(wasmB64);
  return (Real as (c: unknown) => Promise<unknown>)({ ...(cfg ?? {}), wasmBinary });
}
