// maplibre-gl with a worker that needs no network and no file URL. The app calls setWorkerUrl(new URL(...,
// import.meta.url)), which cannot work inside a single HTML file / sandboxed frame. Ignore that URL and start the
// (self-contained) worker from a blob: URL built from the bundled worker source instead.
// A *module* worker from a blob: URL is refused on opaque origins (file://, sandboxed iframes), so the worker is
// turned into a classic script (its single trailing `export{...}` removed) and the URL is tagged `.cjs`, which
// makes maplibre start it as a classic worker (its own rule for CommonJS worker bundles).
import workerSource from "maplibre-gl/dist/maplibre-gl-worker.mjs?raw";
import { setWorkerUrl as realSetWorkerUrl } from "maplibre-gl/dist/maplibre-gl.mjs";

export * from "maplibre-gl/dist/maplibre-gl.mjs";

let url: string | null = null;
export function setWorkerUrl(_ignored?: string): void {
  if (!url) {
    const classic = workerSource.replace(/export\{[^}]*\};?\s*(\/\/# sourceMappingURL=\S*)?\s*$/, "");
    if (/(^|[;}\s])export\s*\{/.test(classic.slice(-200))) throw new Error("maplibre worker: could not strip the ES export");
    url = URL.createObjectURL(new Blob([classic], { type: "text/javascript" })) + "#maplibre-worker.cjs";
  }
  realSetWorkerUrl(url);
}
