# SAMPLE ZoningEnvelopes (3A)

All files here are **SAMPLE** (hypothetical lots, not real parcels; `flags.sample = true`) and **SIMPLIFIED**
(`flags.simplified = true`, details in each envelope's `flags.simplifications`). Drafts only.
Spec: `Project-3_AI-Massing-Generation/_manager/sample-envelopes-spec.md`.

| File | What | Lot |
|---|---|---|
| `sample-a-r7a-interior.json` | R7A, interior lot | 100 x 100 ft = 10,000 sf |
| `sample-b-r8a-corner.json` | R8A, corner lot (wide south + narrow east street) | 100 x 100 ft = 10,000 sf |
| `sample-c-r10-through-sep.json` | R10, through lot, optional sky exposure plane (ZR 23-73) | 200 x 200 ft = 40,000 sf |

Each has a `<id>.site.json` sidecar (lat/lng, grid angle, park polygon in local feet, context file, BINs removed
because their footprints intersect the lot). The envelope schema has no lat/lng, so the sun module reads the sidecar.

## Sources
- Zoning values: `_Shared/research/nyc-zoning-sample-envelope-values.md` (verified). Each citation's `quote` is
  copied verbatim from the claim row named in `researchNote` (`#<row>`); the build asserts the quote occurs in that row.
- Context: NYC OTI Building Footprints (dataset 5zhs-2jue), NYC Open Data; park: NYC Parks Properties (enfh-gkve).
  Raw files in `3A_Massing-Studio/research/data/`. Conversion EPSG:4326 -> EPSG:2263 with proj4 2.22.0 and the
  epsg.io definition; local feet = EPSG:2263 minus the origin (EPSG:2263 of lat 40.6890, lng -73.9755).
- Street widths, lot types and the Sample C rear-yard-equivalent split are accepted ASSUMPTIONS (`assumptions[]`).

## Regenerate
`npx tsx scripts/build-samples.ts` (or `npm run samples`). Deterministic (fixed `generatedAt`); validates every
envelope with Ajv 2020 + ajv-formats against the canonical schema and exits non-zero on error.
Placement: grid angle = argmax of a length-weighted histogram of footprint edge directions mod 90 deg (1 deg bins,
+-2 deg smoothing; bin centre); front edge faces closest to south (park is north).

## Simplifications
- A/B: setback at the max base height; depth measured from the street line; street wall rule checked by a simplified test; qualifying affordable/senior variants not modelled.
- B: corner rear-yard exemption applied to the whole lot; street wall rule on the wide street only.
- C: optional SEP used, tower penetration (23-737) not modelled; SEP evaluated per floor top; rear yard equivalent split equally on both street lines; SEP street-wall rules not researched; base-height minimum not researched (`needs_input`).
- Skipped by design: no use regulations, no commercial overlays; no stories limit found (`maxStories` not_applicable).
