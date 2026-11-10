# Massing Studio (WXY prototype 3A)

Load a NYC zoning envelope, describe a brief in plain language, and get six diverse massing options with
deterministic metrics, a drawing-set zoning table, sun study, and export to Rhino. **The AI proposes parameters;
the geometry engine computes every number.**

## Setup (≤ 5 commands)
```bash
npm install                      # also copies manifold/rhino3dm wasm into public/wasm
cp .env.example .env.local       # optional: add ANTHROPIC_API_KEY for AI mode
npm run dev                      # http://localhost:3000
npm test                         # engine, AI-boundary, export, UI-state tests
npm run eval                     # 3 samples × 3 briefs → eval/report.html
```
Without a key everything runs in **Built-in (no AI)** mode: a deterministic offline brief parser and a preset fitter
that searches the parametric grammar. Every output says which mode produced it.

## Architecture
```
 brief text ──► /api/parse-brief ──(haiku / offline regex)──► Program schedule + Assumptions ──► user confirms
                                                                                                    │
 ZoningEnvelope JSON ──ajv (schema v1.0.0, Project 1)──► EnvelopeModel ──┐                         ▼
                                                                          │   /api/generate (6 slots in parallel)
                                                                          │   sonnet tool loop: listTypologies →
                                                                          │   generateMassing(params) → checkCompliance
                                                                          │   → submitOption   (or offline fitPreset)
                                                                          ▼              │ params only (zod-checked)
   @wxy/massing (shared/massing; pure TS, manifold-3d 2D ops) ◄────────────────────────────────────────┘
   envelope sections · grammar → floor plates → prisms · metrics · compliance (independent re-measure)
   · sun/shadow (analytic rays) · grounding check (every number in AI prose must be a computed value)
                  │
                  ├─► browser: R3F chipboard viewer, compare grid, zoning table, sliders (live, ~1 ms per regen)
                  └─► exports: .3dm (rhino3dm, feet, layers + user text) · glTF · Grasshopper param JSON · PNG boards
```
- `@wxy/massing` — the deterministic engine, in `../../shared/massing` (linked package, also used by 3C; its tests run there).
- `src/lib/ai` — prompts, tools, strategy loop, cost guard, offline fitter, brief parser, iterate, intent.
- `src/app/api/*` — server routes (the key never reaches the browser).
- `src/components/{viewer,studio}` — 3D viewer and the studio UI.
- `src/lib/export` — .3dm / glTF / JSON / SVG boards.
- `schemas/` — generated copy of the canonical ZoningEnvelope schema (`npm run copy-schema`). The SAMPLE envelopes and context
  ship in `@wxy/massing/data/*` (`npm run samples` runs in `../../shared/massing`).

## Models and cost per run
Routing: `claude-haiku-5-5` (brief parse), `claude-sonnet-5-5` (strategy, iterate, intent; effort low),
`claude-opus-5-5` only on "Think harder". Prices used by the cost guard (from the claude-api skill, cached 2026-10-06):
haiku $0.10 / $0.50, sonnet $2 / $10, opus $4 / $20 per million input/output tokens; sonnet cache reads $0.20.
The system prompt + typology library is cached (`cache_control`), so slots 2–6 read it from cache.
- **Built-in mode: $0.00 per run** (measured: 6 options in ~0.3–1.2 s offline; see `eval/report.html`).
- **AI mode: not measured** — no API key was available when this was built. Upper bound per generation is enforced by
  `MASSING_COST_LIMIT_USD` (default $0.50); actual tokens/cost per run show in the in-app Usage drawer and in
  `npm run eval` once a key is set. Haiku cache-read price is UNVERIFIED (the guard uses the input rate).

## Limitations (read before trusting a number)
- **SAMPLE envelopes**: three hypothetical lots (R7A interior, R8A corner, R10 through-lot with the optional sky
  exposure plane) placed near Fort Greene Park. Zoning values are from the NYC Zoning Resolution (verified, sections
  last amended 12/5/2024); the lots and street widths are assumptions.
- **SIMPLIFIED rules** (marked † in the zoning table): ZFA = GFA (no deductions); yards apply at all heights; setbacks
  taken at the max base height and measured from the street line; sky exposure plane evaluated per floor; street-wall
  test = plate within 8 ft (wide) / 10 ft (narrow) of the street line; lot coverage = plan union of all floors; mixed-
  use FAR total checked against the highest FAR of the uses present; towers (ZR 23-435/23-737) not modelled; use
  regulations not modelled (a use with no FAR in the envelope is flagged for review).
- **Sun study** is study-grade (analytic shadow rays against prisms + context, 15-min steps, one NYC reference point,
  grid north = true north) — not a certified daylight analysis.
- **Rhino**: the .3dm round-trips through rhino3dm in tests (units feet, layers, user text). It has **not** been opened
  in Rhino 8 here (Rhino isn't installed on the build machine) — see `docs/rhino-verification.md` for the manual steps.
- **AI mode** is tested only against a scripted fake client; live API behaviour (strict tool schemas, cache hit rate)
  is unverified until a key is provided.
- Desktop-first (1440 px), functional at 1024 px; below 768 px it is view-only.

## Data credits
Context buildings: NYC OTI Building Footprints (NYC Open Data dataset `5zhs-2jue`), fetched 2026-10-25, converted to
EPSG:2263 with proj4. Park outline: NYC Parks Properties (`enfh-gkve`).
