# Massing Studio (full, offline) — single-file build

One self-contained `dist/index.html` that runs the real Massing Studio app (`../../../Project-3_AI-Massing-Generation/3A_Massing-Studio/app`,
engine `../../../Project-3_AI-Massing-Generation/shared/massing`) entirely in the browser, in Built-in (no AI) mode.
No runtime network: JS, CSS, fonts and both wasm binaries (manifold-3d, rhino3dm) are inlined.

## Regenerate
```
npm install        # build tools only (vite, tailwind, single-file plugin, archivo font); app deps come from the app's node_modules
npm run build      # -> dist/index.html
```
Requires the app and `shared/massing` to have their own `npm install` done (their `node_modules` are read, never modified).
Then publish `dist/index.html` as the artifact.

Real lots = every `_Shared/schemas/examples/*.json` plus, if present at build time,
`_Shared/shareable-artifacts/site-brief-full/dist/envelopes.json` (array of ZoningEnvelope objects; de-duplicated by `envelopeId`;
each is re-validated in the browser with the app's `validateEnvelope`, invalid ones are hidden). The build works without that file.

## How it works (nothing under app/ or shared/ is edited)
- `vite.config.ts`: aliases `@/` to the app's `src`, `@wxy/massing` to the shared engine, `react`/`react-dom` to the app's copy.
- `src/fetch-router.ts`: `window.fetch` wrapper; same-origin `/api/*` calls run the app's real route handlers in the page
  (NDJSON stream included). `ANTHROPIC_API_KEY` is compiled to `undefined`, so `/api/status` reports no AI.
- Shims (`src/shims`): `next/dynamic`, `next/server`, `@anthropic-ai/sdk` (+ `/helpers/zod`) stubs, `manifold-3d` and `rhino3dm`
  wrappers that pass the inlined (gzip+base64) wasm as `wasmBinary`, and `download.ts` (artifact `downloads` capability, blob fallback;
  `.3dm`/`.glb` are not on the capability's extension allowlist so they are saved inside a stored `.zip`).
- `src/real-lots.tsx`: "Real lots" list and "Paste envelope JSON" box, spliced into the app's SiteStep / SiteChooser in memory by `patchApp()`
  (the build fails loudly if an anchor string changes).
- `scripts/verify.mjs`: Playwright end-to-end check (`node scripts/verify.mjs http://localhost:8765/index.html outdir`, serve `dist/` first).
