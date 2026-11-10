# Shareable artifacts (full apps)

As of 2026-10-30, both links run the **full app** in the browser as a single offline HTML file. They're private
claude.ai artifacts; share them from each page's Share menu. Both declare the `downloads` capability, so exports ask
the viewer to confirm.
- Site Brief: https://claude.ai/artifact/KyaKDC5K2ZsRLDkRvV89Aw (build: `site-brief-full/`)
- Massing Studio: https://claude.ai/artifact/USAjpXT4MA6MNXmkeYCCDG (build: `massing-studio-full/`)

Artifact pages can't reach any other origin (tested 2026-10-30: NYC GeoSearch, Socrata, ArcGIS and CDNs were all blocked;
WebAssembly, blob workers and `downloads` work). So:
- **Site Brief** replays the 209 recorded source responses (fetched 2026-10-26) for the 10 evaluation lots. Any other
  address won't resolve. No AI narrative. "Open in Massing" copies and downloads the envelope; load it in Massing Studio.
- **Massing Studio** runs in Built-in (no AI) mode with 3 SAMPLE lots plus the 10 Site Brief lots (from
  `site-brief-full/dist/envelopes.json`, keyed by BBL). .3dm and .glb are saved as `.zip` because the downloads
  allowlist doesn't include those extensions. rhino3dm is warmed up while the page is idle; a cold start takes 10+ s
  in the sandbox.

Neither app's source was edited. Each build aliases Next.js and the Node-only modules to browser shims (see each
README) and routes `/api/*` to the real route handlers running in the page.

## Regenerate after app or engine changes
1. `cd site-brief-full && npm run build` (writes `dist/index.html` and `dist/envelopes.json`), then
   `CHROME=<chromium binary> npm run verify` (53 checks).
2. `cd massing-studio-full && npm run build`. Then serve `dist/` and run `node scripts/verify.mjs http://localhost:8765/index.html <outdir>` (24 checks).
3. Republish each `dist/index.html` to the same artifact URL.

The older precomputed explorers (`site-brief/`, `massing-studio/`, `capture-1b.mjs`, `export-3a.ts`) are superseded.
