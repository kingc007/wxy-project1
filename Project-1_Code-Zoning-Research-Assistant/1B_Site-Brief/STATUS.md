---
type: status
prototype: 1B
status: done-with-documented-gaps
tags: [wxy, status, 1B]
---

# 1B — Site Brief — Cited Zoning Analysis from an Address · Status Log

Spec: [[1B_Site-Brief/PROMPT|PROMPT]] · Project: [[Project 1 Overview]]

> [!note] Maintained by the Opus manager. One dated entry per milestone. Keep it factual: what was built, what was verified (and how), what is unverified, open questions.

## Milestones
- [x] Skills read (claude-api, frontend-design, shadcn, apple-design, dataviz, ux-copy) → distilled into `../shared/LLM-GUIDE.md` and `../shared/DESIGN-GUIDE.md`
- [x] Research complete & verified (see `research/`)
- [x] Scaffold + data/ingestion
- [x] Core flows working
- [x] Tests + eval harness passing
- [x] a11y audit fixed
- [x] Design critique iteration done
- [x] Verified end-to-end with `run`

## Log

### 2026-10-25 — Plan & kickoff (manager)
**Environment facts:** no Docker/Homebrew/Postgres on this machine → Postgres+pgvector replaced by **PGlite** (embedded Postgres/WASM) with Drizzle; decision logged here. No ANTHROPIC_API_KEY in env → app must run fully in "no-key mode" (deterministic rule resolution + template memo); LLM narrative/agent activates when a key is present.

**Architecture (manager decision):**
1. `geocode` (NYC Planning Labs GeoSearch v2) → BBL; `getPluto` (Socrata 64uk-42ks) → lot facts with per-field provenance; lot polygon + DCP zoning layers (endpoints pending verified note).
2. **Rules table** `lib/zoning/rules/nyc-zr.json` built by the manager ONLY from verifier-PASS claims (section, verbatim quote, Last Amended date, research note + claim #). The LLM can *select* rule IDs but never supply numbers; a validator rejects any value not traceable to the rules table or a dataset field.
3. Deterministic calculators in `lib/zoning/calc` (ZFA, coverage, yards, setbacks, SEP) with formulas rendered inline.
4. Assumptions ledger (street width wide/narrow, lot type, program toggles) → overrides recompute.
5. Envelope builder → validated with Ajv against `schemas/zoning-envelope.schema.json` (canonical copy).
6. Split lots, landmarks, historic & special districts → review flags, controls left `manual`.

**Schema:** canonical ZoningEnvelope v1.0.0 published to `_Shared/schemas/zoning-envelope.schema.json` and logged in the contract note; Project 3 session notified.

**Research:** 6 notes commissioned (endpoints, ZR source/versions, residence bulk, commercial/uses, test parcels, ZR definitions + street width).
- test-parcels.md — verified: 27 PASS / 1 FAIL (row 3: a SoQL quoting claim; not used for any value).
- residence-bulk-rules.md — verification running. Manager checked §23-22 raw HTML: the R6 row footnote 1 (`R6<sup>1</sup>`) = "For zoning lots, or portions thereof, located within 100 feet of a wide street" → R6 within 100 ft of a wide street uses the 3.00/3.90 row; otherwise 2.20/3.90. Manager read §23-736 table (CORRECTED after verifier review of raw colspans): R6/R7 initial setback 20 ft narrow / 15 ft wide; front-wall max "60 feet or six stories, whichever is less" (one value); SEP height above street line 60 ft (one value); slope 2.7:1 narrow / 5.6:1 wide. See research/manager-checks.md M2.
- residence-bulk-rules.md — verified: 29 PASS / 2 FAIL (row 24 absence-claim wording; row 26 front-wall narrow/wide split — corrected in manager-checks M2). Rows 24/26 are NOT used; M2 replaces 26.
- nyc-data-endpoints.md — research done (GeoSearch keyless; PLUTO 64uk-42ks 26v2; DCP MAPPLUTO FeatureServer for polygons/zoning layers); verification running. Manager probe: `outSR=2263` returns EPSG:2263 feet geometry (manager-checks M3).
- zr-definitions-and-street-width.md — wide street = "any street 75 feet or more in width" (ZR 12-10, Last Amended 3/26/2026 — note: ZR amended after City of Yes; per-section dates are recorded). Street width source: DCP DCM Street Center Line `Streetwidth` (string; '>75'/'Unknown' occur; informational) → used only to PROPOSE the wide/narrow assumption (confidence Inferred), user confirms. Verification running.
- nyc-data-endpoints.md — verified: 54 PASS / 5 FAIL (rows 5, 6, 7, 52: paraphrased / not verbatim doc quotes; row 36: field list incomplete). None of the FAIL rows is used for a value; endpoints/fields used in code are all PASS rows.
- zr-definitions-and-street-width.md — verified: 24 PASS / 5 FAIL (rows 21, 23 re-citation/formatting, 25 spatial-query attribution, 27 one-word quote error, 28 CSCL field mapping). Wide-street definition (ZR 12-10) PASS; DCM `Streetwidth` field existence confirmed by verifier (values match) → used only to *propose* the wide/narrow assumption.
- commercial-rules-and-uses.md, zr-source-and-versions.md, manager-checks + rules table — verification running.

### 2026-10-25 — Build wave 1 (manager)
- Scaffold done (builder): Next 16.4.3, React 19.3, Tailwind 4.3, shadcn 4.22 (radix), motion 14.6, maplibre-gl 6.16, R3F 9.8, Anthropic SDK 1.3.0, Ajv 8.20, PGlite 0.5.11. typecheck/lint/test/build pass; dev 200. Accent token named `--signal` (shadcn already uses `--accent`).
- Manager wrote `app/lib/types.ts` (engine contract) and `shared/rules/nyc-zr-residence.json` (106 rules for R5/R6/R6A/R6B/R7A/R8A from PASS rows only; residence rows 24/26 excluded; SEP from manager-check M2). Rules table under independent verification.
- In progress (parallel builders, disjoint files): data sources (`lib/sources`), zoning engine (`lib/zoning`), shared ZR corpus ingestion (`shared/zr-corpus`).
- 2026-10-25 evening: session rate limit interrupted all agents (reset 6:30pm); all resumed.
- Rules table re-check: residence rules 107/107 PASS after manager fixes (coverage scoped to `siteCategory: standard`; rear height break split by building type / lot width ≥ 40 ft; undefined building types removed). Manager-check M3 PASS (f=json `"units":"esriFeet"`).
- commercial-rules-and-uses.md — verified 49 PASS / 7 non-PASS (rows 12, 14, 17, 22 use-table tallies; 19 unreachable; 35 C4-4A not in no-bonus list; 56 section titles). → manager built `shared/rules/nyc-zr-commercial.json` (23 rules: C1/C2 overlay commercial FAR 2.00 by underlying R (33-121 col A), C4-4A → R7A equivalent (34-112) + FAR 4.00/4.00, M1-1/M1-2 FAR + CF FAR + 43-43 SEP; split-lot 77-22 area-weighted FAR, 77-28 → manual). C6-2A FAR is NOT FOUND in the text → absent. Verification running.
- _Shared/research/zr-source-and-versions.md — verified 25 PASS / 6 FAIL (rows 5, 7 (106 not 105 of 108 sections at 12/5/2024), 18, 20, 22 (80 distinct pages, negative finding holds), 29 (LL126 ↔ 2022 code link unsourced)). Currency line used in UI: home page "All text changes approved by the city council as of Oct 22, 2026" (PASS).

### 2026-10-25 — Engine, sources, map, eval (manager)
- **Data sources** (`lib/sources`, builder): GeoSearch / PLUTO / MapPLUTO (EPSG:2263) / DCP zoning layers (with 4326 boundaries for the map) / DCM street widths / edge classification. Recorded fixtures for all 10 eval lots (offline demo). 19 source tests.
- **Engine** (`lib/zoning`, builder + manager fixes): rules resolver, deterministic calculators with visible formulas, assumptions ledger, review flags, split-lot handling (77-22 area-weighted FAR, 77-28 → manual), envelope builder validated with Ajv against the canonical schema, provenance checker. Manager fixes: (1) split-lot detection uses PLUTO only; zoning-layer slivers become `data_conflict` flags (DCP: layers not for lot-level determination); (2) special-district lots: cited/computed values demoted to *Inferred* with a note.
- **Map + 3D** (builder): MapLibre with no tiles/keys (our GeoJSON only), north arrow, imperial scale bar, theme-aware; R3F envelope (base volume, setbacks, rear step, SEP plane labelled SIMPLIFIED) with a table text alternative.
- **Eval** (`npm run eval`, gold hand-written by manager from verified sources in `app/evals/gold.json`): **88/88 fields correct (100%), 4/4 expected-nulls correct (0 hallucinated values), provenance completeness 277/277 (100%), 10/10 envelopes schema-valid, 0 parcels failing.** R6 lots are conditional on the street-width assumption (DCM data); documented in gold.
- In progress: memo UI + SSE API, ZR source pane + use tables, LLM agent + cited narrative (mocked; live needs ANTHROPIC_API_KEY).

### 2026-10-26 — Integration, a11y audit, critique, `run` verification (manager)
- Built: memo UI + SSE API, source pane + use-group matrix (official use tables), LLM layer (mocked tests; live untested — no key), exports (PDF A3 drawing sheet Z-101…, .md, .json), README + architecture SVG, shared site cache.
- **a11y (WCAG 2.1 AA):** axe 4.14 — 0 violations in 12 state×theme runs; manager contrast calc — all text ≥4.5:1; fixed control-border contrast (2.84 → 3.58:1) and focus ring (2px solid --signal, offset 2px). Report: `research/a11y-and-critique-2026-10-26.md`.
- **Critique iteration done:** use-group matrix, split-lot per-portion columns, Key controls strip, sticky map, sentence-case labels, quieter "Mark verified", readable setback labels, single local-date source.
- **`run` verification (production build, browser pane, 1440×900):**
  - Live non-fixture address "120 Broadway, Manhattan" → memo in ~2.8 s of steps (<60 s); C5-5 unsupported → all district values "Needs input"; landmark, special district LM, irregular-lot flags raised.
  - 287 Convent Avenue → Key controls FAR 3.00 · ZFA 14,025 sf · base 40–65 ft · height 75 ft · rear 20 ft · coverage 80 % (= gold); ZR 23-22 RefTag opens source pane with the R6A row highlighted; map stays sticky.
  - Override building type → detached: toast "Override saved. Memo recalculated.", assumption shows "overridden".
  - Exports: JSON 200 (`x-envelope-valid: true`), Markdown 200, PDF 200 (`%PDF-1.3`).
  - Bugs found → fixing: 3D view blank until first interaction; autocomplete stays open after submit; ledger buttons all named "Edit"; edit select unlabeled; street-width assumption shown "Cited" (must be Inferred — DCM is informational).

### 2026-10-26 — Sign-off (manager)
Final checks run by the manager: typecheck 0 errors · lint clean · Vitest 24 files / 194 tests · `npm run eval` 88/88 fields, 0 hallucinated values, provenance 277/277, 10/10 envelopes valid · `next build` OK · Playwright 22/22 (brief, screens, a11y/axe, sticky, export, 3D first frame). Run-through bugs (3D first frame, collinear lot vertices, autocomplete, ledger labels, street confidence) fixed and re-checked in the browser; 8/10 eval lots render 3D, split lots show the 77-28 note.
Example envelopes for Project 3 (real lots, schema-valid): `_Shared/schemas/examples/` (R7A interior, R6A interior, R7A corner).

| Acceptance criterion | Status | Evidence |
|---|---|---|
| Address → complete draft memo with map + envelope preview in <60 s | ✅ | live non-fixture address ≈2.8 s of steps; e2e G1 1.4 s offline |
| 100% of numeric outputs have provenance; arithmetic in code with visible formulas | ✅ | eval provenance 277/277; checkProvenance 0; formulas shown ("4,675 sf × 3.00 FAR = 14,025 sf") |
| Split-lot and landmark cases flagged, not guessed | ✅ | eval: split lots → controls manual/null, landmark/historic/special flags; 0 hallucinated |
| Envelope JSON validates against published schema (/schemas/zoning-envelope.schema.json) | ✅ | 10/10 valid (Ajv 2020); `X-Envelope-Valid` on export |
| a11y clean, critique iteration done, verified with `run` | ✅ | axe 0 violations ×12; contrast computed; critique round done; manager `run` in browser |

**Open / not met (honest gaps):**
- **LLM paths unverified live** — no ANTHROPIC_API_KEY in this environment. Narrative (Citations), agent cross-check and Opus escalation are implemented and unit-tested with a mocked client only. The spec's "Claude (sonnet) operates as an agent" is therefore not demonstrated live; rule selection is deterministic (cross-checked by the agent when a key is present).
- **Retrieval:** 1B uses in-memory BM25 over the ZR corpus for the agent's `searchZoningText`, not Postgres+pgvector hybrid (that lives in 1A).
- **Rule coverage:** R5, R6, R6A, R6B, R7A, R8A, C1/C2 overlays in them, C4-4A, M1-1/M1-2 only; others → Needs input. Sky exposure geometry for R6 (and M1) only; others manual (spec: 2–3 types).
- Not modelled (flagged): special-district modifications, eligible sites (23-434), shallow lots, story limits, corner-lot rear yards, split-lot height/setback (77-28).
- Street width wide/narrow is proposed from informational DCM data (Inferred); R6 results depend on it.
- "Open in Massing" is a placeholder link.

### 2026-10-30 — Motion & feel redesign (manager)
User feedback: the UI "looks very robotic". Direction written in `_Shared/Motion & Feel.md` ("Drafted, not printed"),
from motion.zajno.com + the frontend-design / apple-design / shadcn / premium-frontend-ui skills. Built by builders,
reviewed and verified by the manager.
- 1B: hero address field (morphs into the bar), DimensionString key controls, step rail with state words (ms timings → dev drawer), masked heading, map wipe + fly-in, plan-grid parallax, graphite-night dark (text ≥ 5.30:1). Verified: tsc, lint, Vitest 196/196, eval 88/88 (0 hallucinated, provenance 277/277), Playwright 22/22 incl. axe both themes, browser at 1440 light. Not verified: reduced-motion path; animations seen only as start/end frames. Commit 0a0a7ac.
- 2026-10-30 (later): ran the open items with Playwright (reducedMotion emulation + timed frames). Found + fixed: under reduced motion the first-screen heading (and 3A lot outlines) stayed hidden and hydration mismatched; now visible at once, no hydration errors in either mode. Measured: animations settle ≤1.5 s; 3A camera arrival eases (21%→9.5%→1.7% pixels changing per interval), jumps under reduced motion. Still unseen mid-motion: 3A compare→focus frame morph (headless WebGL screenshots take ~1.4 s).

### 2026-10-30 — Ease of use across apps and devices (manager)
- **Open in Massing** is now real: a browser postMessage handoff (spec in `_Shared/ZoningEnvelope Contract.md`). Verified end to end with Playwright on dev builds (localhost) and production builds over the LAN address (the iPad path): "Loaded from Site Brief: 287 Convent Avenue", Site Brief toast "Sent to Massing Studio.", no page errors. Popup-blocked and timeout toasts were not triggered in a browser.
- 3A below 1024 px: Setup / Details sheets, Generate inside the Setup sheet, 40 px touch targets. Full flow verified at 768×1024 and 390×844 (load → setup → generate → details); no horizontal scroll.
- `Start WXY Apps.command` (vault root, macOS): installs, builds when sources change, starts both apps on 3101/3301, prints the LAN address. Verified on this Mac. `Start WXY Apps.bat` (Windows) is written but untested.
- Guides: `How to use Site Brief.md`, `How to use Massing Studio.md`; linked from Home.
- **Open issue (needs a decision):** the 3A engine computes FAR from the lot polygon area (MapPLUTO outline), while 1B uses PLUTO lotarea (cited). 287 Convent: 4,887 vs 4,675 sf, so allowed floor area is 14,660 vs 14,025 sf. The engine notes it but the note is not shown. Documented in both guides.
- Tests: 1B Vitest 204/204, Playwright 22/22, eval 88/88. 3A Vitest 128/128. Commits: 1B 7bbedee, 3A 50a2953.
- 2026-10-30 (decision, user): FAR, coverage and open space use the recorded lot area (envelope lot.area / PLUTO lotarea), not the outline. Engine commit in shared/massing; 3A shows a note when they differ by >1%. Verified: 287 Convent allowed ZFA 14,025 sf in both apps (handoff run); engine 188/188, 3A 128/128; eval: 270 E 3 St no-fail 100% → 83% (recorded 2,021 vs outline 2,303 sf), samples unchanged.

### 2026-10-30 — Readability pass (manager)
User feedback: "not designed good enough, no ai slop. make it easier for humans to access visually." Spec: `_Shared/Readability Pass.md` ("Marked-up set": colour only for status/action; every status = colour + icon + word).
- New: StatusPill (Cited / Inferred / Computed / Needs input / Flag / Accepted / Rejected / Edited) replaces the filled/hollow squares; Review summary strip (counts link to sections); sticky section index with scroll-spy and "N of M reviewed"; assumption decisions persist per BBL with Undo; finished step rail collapses to one line; map key; DRAFT stamp → warn banner; source shown as a readable dataset chip; body 15px, nothing < 13px; 6px control radius; Archivo wide display; primary buttons cobalt.
- Fixed in review: 390px horizontal overflow (page was 1176px wide; grid track + sr-only text escaping scroll wrappers). New `e2e/overflow.spec.ts` at 390/768/1024/1280/1440.
- Verified (manager): tsc, lint, Vitest 208/208, Playwright 27/27 incl. axe both themes (0 violations), fresh browser load 0 console errors. Contrast: all text tokens ≥ 5.4:1 (light) and ≥ 6.4:1 (dark), computed.
- Not verified: step rail mid-run (cached lot finishes instantly); 3D view not visually reviewed; some lib-generated strings still use " · ".
