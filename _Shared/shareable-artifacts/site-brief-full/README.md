# site-brief-full

Single-file, browser-only build of the real Site Brief app (`Project-1_Code-Zoning-Research-Assistant/1B_Site-Brief/app`)
on the 10 preloaded evaluation lots, for publishing as a claude.ai Artifact. The app folder is imported read-only;
nothing in it is edited.

Outputs (in `dist/`): `index.html` (the artifact, everything inlined, no runtime network) and `envelopes.json`
(ZoningEnvelope per lot, default assumptions, validated against `_Shared/schemas/zoning-envelope.schema.json`).

## Regenerate
```
npm install
npm run build        # vite build -> dist/index.html, then tsx script -> dist/envelopes.json
CHROME=<path to a Chromium binary> npm run verify   # headless checks against dist/index.html (file://)
```
Rebuild after any change to the app, `app/fixtures/http`, `app/data/zr` or `app/evals/gold.json` (the lot list and the
"data recorded" date are derived from them at build time).

## How it works (see `vite.config.ts`, `src/`)
- `src/api.ts` wraps `window.fetch`; same-origin `/api/*` calls run the app's real route handlers in the page.
  `/api/geocode` is answered from the preloaded-lot list only.
- Overrides resolved by file (no app edits): `lib/sources/http.ts` -> recorded fixtures (offline mode),
  `lib/zr/corpus.ts` -> bundled gzip ZR corpus, `lib/brief-client/massing-handoff.ts` -> clipboard + download.
- Aliases: `next/dynamic`, `@react-pdf/renderer` (browser build + `renderToBuffer`), `maplibre-gl` (blob classic worker),
  `@anthropic-ai/sdk` (stub; no LLM can be called), `react`/`react-dom`/`sonner` (one instance from the app).
- `src/download.ts` routes blob downloads to the platform `downloads` capability (declare it when publishing), falling
  back to a normal `<a download>`.
