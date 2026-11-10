import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const VAULT = path.resolve(here, "../../..");
const APP = path.join(VAULT, "Project-3_AI-Massing-Generation/3A_Massing-Studio/app");
const MASSING = path.join(VAULT, "Project-3_AI-Massing-Generation/shared/massing");
const EXAMPLES = path.join(VAULT, "_Shared/schemas/examples");
const SITE_BRIEF_ENVELOPES = path.join(VAULT, "_Shared/shareable-artifacts/site-brief-full/dist/envelopes.json");
const appNm = (p: string) => path.join(APP, "node_modules", p);

const gzB64 = (file: string) => gzipSync(readFileSync(file), { level: 9 }).toString("base64");

/** Virtual modules: gzip+base64 wasm, the label font as a blob URL, and the real-lot envelopes. */
function virtuals(): Plugin {
  const ids: Record<string, () => string> = {
    "virtual:wasm-manifold": () => `export default ${JSON.stringify(gzB64(path.join(MASSING, "node_modules/manifold-3d/manifold.wasm")))};`,
    "virtual:wasm-rhino": () => `export default ${JSON.stringify(gzB64(appNm("rhino3dm/rhino3dm.wasm")))};`,
    "virtual:label-font": () => {
      const b64 = readFileSync(path.join(APP, "src/components/viewer/fonts/ibm-plex-mono-latin-500-normal.woff")).toString("base64");
      // blob: URL (same-origin, allowed in the sandbox) so troika-three-text never needs a data:/network fetch.
      return `const b=atob(${JSON.stringify(b64)});const u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);export default URL.createObjectURL(new Blob([u],{type:"font/woff"}));`;
    },
    "virtual:real-lots": () => {
      const byId = new Map<string, unknown>();
      const add = (e: unknown, from: string) => {
        // One entry per lot: key by BBL; later sources (Site Brief's envelopes.json) replace the examples.
        const id = (e as { site?: { bbl?: string } })?.site?.bbl ?? (e as { envelopeId?: string })?.envelopeId;
        if (typeof id !== "string") return console.warn(`[real-lots] skipped an entry without bbl/envelopeId (${from})`);
        byId.set(id, e);
      };
      for (const f of readdirSync(EXAMPLES).filter((f) => f.endsWith(".json")).sort()) add(JSON.parse(readFileSync(path.join(EXAMPLES, f), "utf8")), f);
      if (existsSync(SITE_BRIEF_ENVELOPES)) {
        try {
          const arr = JSON.parse(readFileSync(SITE_BRIEF_ENVELOPES, "utf8"));
          if (Array.isArray(arr)) for (const e of arr) add(e, "site-brief-full/envelopes.json");
          else console.warn("[real-lots] envelopes.json is not an array; ignored");
        } catch (e) {
          console.warn("[real-lots] envelopes.json unreadable; ignored:", (e as Error).message);
        }
      }
      console.log(`[real-lots] ${byId.size} real envelopes embedded (validated again at runtime)`);
      return `export default ${JSON.stringify([...byId.values()])};`;
    },
  };
  return {
    name: "virtuals",
    resolveId: (id) => (id in ids ? "\0" + id : null),
    load: (id) => (id.startsWith("\0") && ids[id.slice(1)] ? ids[id.slice(1)]() : null),
  };
}

/** In-memory source patches (the app folder on disk is never touched). Each anchor must match or the build fails. */
function patchApp(): Plugin {
  const patches: { file: string; from: string; to: string }[] = [
    {
      file: "src/components/studio/SiteStep.tsx",
      from: `      <div className="flex flex-col gap-1.5">\n        <input\n          ref={file}`,
      to: `      <RealLots variant="rail" />\n      <div className="flex flex-col gap-1.5">\n        <input\n          ref={file}`,
    },
    {
      file: "src/components/studio/SiteChooser.tsx",
      from: `      </ul>\n    </div>\n  );\n}`,
      to: `      </ul>\n      <RealLots variant="chooser" />\n    </div>\n  );\n}`,
    },
    {
      file: "src/components/viewer/SceneContent.tsx",
      from: `new URL("./fonts/ibm-plex-mono-latin-500-normal.woff", import.meta.url).toString()`,
      to: `__labelFontUrl`,
    },
  ];
  return {
    name: "patch-app",
    enforce: "pre",
    transform(code, id) {
      const clean = id.split("?")[0];
      const hits = patches.filter((p) => clean === path.join(APP, p.file));
      if (!hits.length) return null;
      let out = code;
      for (const p of hits) {
        if (!out.includes(p.from)) throw new Error(`patch-app: anchor not found in ${p.file}; the app changed, update vite.config.ts`);
        out = out.replace(p.from, () => p.to);
      }
      const head =
        (hits.some((p) => p.to.includes("RealLots")) ? `import { RealLots } from "/src/real-lots";\n` : "") +
        (hits.some((p) => p.to.includes("__labelFontUrl")) ? `import __labelFontUrl from "virtual:label-font";\n` : "");
      // keep "use client" first
      return { code: out.startsWith('"use client";') ? out.replace('"use client";', `"use client";\n${head}`) : head + out, map: null };
    },
  };
}

/**
 * rhino3dm.module.js / manifold.js contain `new URL("x.wasm", import.meta.url)`, which Vite would inline as a second
 * (base64) copy of each wasm. The wasm is supplied via wasmBinary (src/shims), so the URL is replaced by a dummy name.
 */
function noWasmUrl(): Plugin {
  const targets: Record<string, string> = {
    [appNm("rhino3dm/rhino3dm.module.js")]: `new URL("rhino3dm.wasm",import.meta.url).href`,
    [path.join(MASSING, "node_modules/manifold-3d/manifold.js")]: `new URL("manifold.wasm",import.meta.url).href`,
  };
  return {
    name: "no-wasm-url",
    enforce: "pre",
    transform(code, id) {
      const from = targets[id.split("?")[0]];
      if (!from) return null;
      if (!code.includes(from)) throw new Error(`no-wasm-url: anchor not found in ${id}`);
      return { code: code.replace(from, () => JSON.stringify("inlined.wasm")), map: null };
    },
  };
}

/** ANALYZE=1 prints the largest packages in the bundle. */
function analyze(): Plugin {
  return {
    name: "analyze",
    generateBundle(_o, bundle) {
      if (!process.env.ANALYZE) return;
      const by = new Map<string, number>();
      for (const c of Object.values(bundle)) {
        if (c.type !== "chunk") continue;
        for (const [id, m] of Object.entries(c.modules)) {
          const mm = id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
          const key = mm ? mm[1] : id.includes("/app/src/") ? "app/src" : id.includes("shared/massing") ? "shared/massing" : "other";
          by.set(key, (by.get(key) ?? 0) + m.renderedLength);
        }
      }
      console.log([...by].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${(v / 1024).toFixed(0).padStart(7)} KB  ${k}`).join("\n"));
    },
  };
}

export default defineConfig({
  root: here,
  plugins: [virtuals(), patchApp(), noWasmUrl(), analyze(), tailwindcss(), react(), viteSingleFile()],
  define: {
    "process.env.ANTHROPIC_API_KEY": "undefined",
    "process.env.MASSING_COST_LIMIT_USD": "undefined",
    "process.env.NEXT_PUBLIC_SITE_BRIEF_URL": "undefined",
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      { find: /^@wxy\/massing$/, replacement: path.join(MASSING, "src/index.ts") },
      { find: /^@wxy\/massing\/(.*)$/, replacement: MASSING + "/$1" },
      { find: /^@\/lib\/export\/download$/, replacement: path.join(here, "src/shims/download.ts") },
      { find: /^@\/(.*)$/, replacement: path.join(APP, "src") + "/$1" },
      { find: /^next\/dynamic$/, replacement: path.join(here, "src/shims/next-dynamic.tsx") },
      { find: /^next\/server$/, replacement: path.join(here, "src/shims/next-server.ts") },
      { find: /^@anthropic-ai\/sdk\/helpers\/zod$/, replacement: path.join(here, "src/shims/anthropic-zod.ts") },
      { find: /^@anthropic-ai\/sdk$/, replacement: path.join(here, "src/shims/anthropic-sdk.ts") },
      { find: /^manifold-3d$/, replacement: path.join(here, "src/shims/manifold-3d.ts") },
      { find: /^__MANIFOLD_JS__$/, replacement: path.join(MASSING, "node_modules/manifold-3d/manifold.js") },
      { find: /^rhino3dm$/, replacement: path.join(here, "src/shims/rhino3dm.ts") },
      { find: /^__RHINO_JS__$/, replacement: appNm("rhino3dm/rhino3dm.module.js") },
      { find: /^ws$/, replacement: path.join(APP, "src/lib/studio/empty-module.ts") },
      { find: /^react$/, replacement: appNm("react") },
      { find: /^react\/(.*)$/, replacement: appNm("react") + "/$1" },
      { find: /^react-dom$/, replacement: appNm("react-dom") },
      { find: /^react-dom\/(.*)$/, replacement: appNm("react-dom") + "/$1" },
    ],
  },
  build: {
    target: "es2022",
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 100_000,
    reportCompressedSize: false,
  },
});
