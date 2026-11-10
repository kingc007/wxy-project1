// Browser-only, single-file build of the Site Brief app. The app source (../../../Project-1_.../1B_Site-Brief/app)
// is imported read-only; everything Node- or Next-specific is replaced here via resolve hooks, never by editing it.
import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { createHash } from "node:crypto";
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, "../../../Project-1_Code-Zoning-Research-Assistant/1B_Site-Brief/app");
const SHIMS = path.join(HERE, "src/shims");

/** Absolute app file -> replacement module. Matched on the *resolved* id, so relative and "@/" imports are both caught. */
const FILE_OVERRIDES: Record<string, string> = {
  [path.join(APP, "lib/sources/http.ts")]: path.join(SHIMS, "http.ts"),
  [path.join(APP, "lib/zr/corpus.ts")]: path.join(SHIMS, "corpus.ts"),
  [path.join(APP, "lib/brief-client/massing-handoff.ts")]: path.join(SHIMS, "massing-handoff.ts"),
};

function overrides(): Plugin {
  return {
    name: "site-brief-overrides",
    enforce: "pre",
    async resolveId(source, importer, opts) {
      if (!importer || source.startsWith("\0") || source.startsWith("virtual:")) return null;
      if (!/^(\.|\/|@\/)/.test(source)) return null;
      const r = await this.resolve(source, importer, { ...opts, skipSelf: true });
      if (!r) return null;
      const hit = FILE_OVERRIDES[r.id.split("?")[0]];
      return hit ?? null;
    },
  };
}

/** virtual:fixtures (recorded HTTP responses keyed by URL) and virtual:lots (the preloaded-lot list). */
function fixtures(): Plugin {
  const FX = "virtual:fixtures";
  const LOTS = "virtual:lots";
  const ZR = "virtual:zr-gz";
  return {
    name: "site-brief-fixtures",
    resolveId(id) {
      if (id === FX || id === LOTS || id === ZR) return "\0" + id;
      return null;
    },
    load(id) {
      if (id === "\0" + ZR) {
        // ZR corpus (sections + definitions + manifest) as one gzip+base64 blob; inflated at startup in src/shims/corpus.ts.
        const rd = (f: string) => JSON.parse(fs.readFileSync(path.join(APP, "data/zr", f), "utf8"));
        const gz = zlib.gzipSync(JSON.stringify({ sections: rd("zr-sections.json"), definitions: rd("definitions.json"), manifest: rd("manifest.json") }), { level: 9 });
        return `export default ${JSON.stringify(gz.toString("base64"))};`;
      }
      if (id !== "\0" + FX && id !== "\0" + LOTS) return null;
      const dir = path.join(APP, "fixtures/http");
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
      const byUrl: Record<string, { fetchedAt: string; body: unknown; file: string }> = {};
      const labels = new Map<string, string>(); // bbl -> GeoSearch label
      let min = "9999", max = "0000";
      const hosts = new Set<string>();
      for (const f of files) {
        const e = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as { url: string; fetchedAt: string; body: any };
        if (createHash("sha1").update(e.url).digest("hex") + ".json" !== f) throw new Error(`fixture name/url mismatch: ${f}`);
        byUrl[e.url] = { fetchedAt: e.fetchedAt, body: e.body, file: f };
        if (e.fetchedAt < min) min = e.fetchedAt;
        if (e.fetchedAt > max) max = e.fetchedAt;
        hosts.add(new URL(e.url).host);
        if (new URL(e.url).host === "geosearch.planninglabs.nyc") {
          for (const ft of e.body?.features ?? []) {
            const bbl = ft?.properties?.addendum?.pad?.bbl;
            if (bbl && ft.properties.label && !labels.has(bbl)) labels.set(bbl, ft.properties.label);
          }
        }
      }
      if (id === "\0" + FX) {
        return `export const fixtures = ${JSON.stringify(byUrl)};\nexport const fixtureMeta = ${JSON.stringify({ count: files.length, firstFetchedAt: min, lastFetchedAt: max, hosts: [...hosts].sort() })};`;
      }
      if (id === "\0" + LOTS) {
        const gold = JSON.parse(fs.readFileSync(path.join(APP, "evals/gold.json"), "utf8")) as { parcels: any[] };
        const lots = gold.parcels.map((p) => ({
          bbl: p.bbl as string, address: p.address as string, query: p.query as string, category: p.category as string,
          label: labels.get(p.bbl) ?? p.query,
        }));
        return `export const lots = ${JSON.stringify(lots)};`;
      }
      return null;
    },
  };
}

export default defineConfig({
  root: HERE,
  base: "./",
  plugins: [overrides(), fixtures(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: [
      { find: /^@\//, replacement: APP + "/" },
      // One React / sonner instance shared by the app and the shims.
      { find: /^(react|react-dom|sonner)(\/.*)?$/, replacement: APP + "/node_modules/$1$2" },
      { find: /^next\/dynamic$/, replacement: path.join(SHIMS, "next-dynamic.tsx") },
      { find: /^@react-pdf\/renderer$/, replacement: path.join(SHIMS, "react-pdf.ts") },
      { find: /^maplibre-gl$/, replacement: path.join(SHIMS, "maplibre.ts") },
      // Deep imports made from the shims resolve against the app's node_modules.
      { find: /^(@react-pdf\/renderer\/|maplibre-gl\/)/, replacement: APP + "/node_modules/$1" },
      // No Anthropic client ships in this build.
      { find: /^@anthropic-ai\/sdk\/helpers\/beta\/zod$/, replacement: path.join(SHIMS, "anthropic-zod.ts") },
      { find: /^@anthropic-ai\/sdk$/, replacement: path.join(SHIMS, "anthropic.ts") },
    ],
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env.ANTHROPIC_API_KEY": JSON.stringify(""),
    "process.env.NEXT_PUBLIC_MASSING_URL": "undefined",
    "process.env.SOURCE_MODE": JSON.stringify("offline"),
  },
  oxc: { jsx: { runtime: "automatic" } },
  build: {
    outDir: path.join(HERE, "dist"),
    emptyOutDir: false,
    target: "es2022",
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 100_000,
    cssCodeSplit: false,
    sourcemap: false,
  },
  logLevel: "info",
});
