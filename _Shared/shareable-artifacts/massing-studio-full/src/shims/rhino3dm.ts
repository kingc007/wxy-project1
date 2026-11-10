// rhino3dm with the wasm inlined (loaded only when the first .3dm export runs, via the app's dynamic import).
// @ts-expect-error resolved by absolute path
import Real from "__RHINO_JS__";
import wasmB64 from "virtual:wasm-rhino";
import { inflateBase64Gzip } from "./wasm";

export default async function rhino3dm(opts?: Record<string, unknown>) {
  const wasmBinary = await inflateBase64Gzip(wasmB64);
  return (Real as (c: unknown) => Promise<unknown>)({ ...(opts ?? {}), wasmBinary });
}
