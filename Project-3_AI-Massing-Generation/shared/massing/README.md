# @wxy/massing

The deterministic massing engine (geometry, envelope model, grammar, metrics, compliance, sun study, grounding check,
strategy schemas) shared by 3A Massing Studio and 3C Option Field. TypeScript source, no build step; consumers list it
in `transpilePackages`.

- `src/` engine + tests (`npm test`, `npm run typecheck`). Entry: `src/index.ts`. Await `initGeometry()` once, then everything is synchronous.
- `data/` canonical copy of `zoning-envelope.schema.json` (owned by Project 1; do not edit), SAMPLE envelopes (`data/samples/`) and the SAMPLE Fort Greene context. Import as `@wxy/massing/data/...`.
- `scripts/` `npm run samples` regenerates the samples from the verified research note and raw footprints (`3A_Massing-Studio/research/data`).

Consumers: `"@wxy/massing": "file:../../shared/massing"`.
