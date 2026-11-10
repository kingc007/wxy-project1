---
type: prompt
project: "Project 1"
prototype: 1B
name: "Site Brief — Cited Zoning Analysis from an Address"
build_order: 1
tags: [wxy, prompt, 1B]
---

> [!info] Full build prompt (shared base block + prototype spec, verbatim). Back to [[Project 1 Overview]] · [[Home]]

# CONTEXT: WXY Architecture + Urban Design

You are building a prototype for WXY, a NYC-based architecture, urban design and planning
firm working largely on public/civic projects. Their team is technically strong (Grasshopper,
parametric modeling, GIS/land-use mapping) and has well-organized internal project data.

## Their problems with AI (design every decision against these)
1. TRUST: Verifying AI output costs so much time that it erases the benefit.
2. ACCURACY: Code/zoning errors carry professional liability. A wrong FAR or setback is unacceptable.
3. HIDDEN ASSUMPTIONS & INTERPRETATION: AI silently picks one reading of an ambiguous clause.
4. COST: Tools are expensive relative to delivered value.
5. ONBOARDING: Staff time to learn new tools is scarce.
6. CREATIVITY/BIAS: Output feels generic; it must support, not replace, professional judgment.

## Core product principles (non-negotiable)
- EVERY factual claim is traceable to a source passage (document, section, paragraph, version/effective date).
  No citation = the claim is not shown as fact; it is shown as an explicitly labeled inference.
- ASSUMPTIONS ARE FIRST-CLASS: Every answer exposes an "Assumptions & Interpretations" ledger the
  user can accept, reject or edit, and the answer regenerates accordingly.
- CONFIDENCE IS HONEST: Show per-claim confidence (Cited / Inferred / Unverified / Conflicting sources).
  The system must say "I don't know" or "the sources conflict" rather than guess.
- JURISDICTION AND VERSION AWARE: Every source carries jurisdiction + effective date. Zoning text changes
  (e.g. NYC's recent text amendments) — never mix versions silently; flag when a source may be superseded.
- HUMAN IN THE LOOP: Outputs are drafts for a licensed professional. Provide "Mark verified by [name]" on claims.
- ZERO-TRAINING UX: A new staff member is productive in under 5 minutes, with no manual.
- COST-AWARE: Route cheap tasks (classification, extraction, reranking) to claude-haiku-5-5, synthesis to
  claude-sonnet-5-5, and hard interpretation/conflict resolution to claude-opus-5-5. Use prompt caching
  for large static corpora. Show a per-query cost estimate in a dev/admin panel.

## Required skills: invoke these via the Skill tool, in this order, before writing code
1. `claude-api`: read BEFORE writing any LLM code. Confirm current model IDs, the Citations feature
   (document blocks with citations enabled), tool use, prompt caching, streaming, structured outputs.
   Do not write Anthropic SDK code from memory.
2. `anthropic-skills:frontend-design`: establish a distinctive aesthetic direction before any UI.
3. `anthropic-skills:shadcn`: component foundation (customize heavily; it must not look like a stock shadcn app).
4. `anthropic-skills:apple-design`: motion, spring physics, interruptible transitions, typography detail,
   reduced-motion support.
5. `dataviz`: before any chart, metric tile, confidence meter or comparison matrix.
6. `design:ux-copy`: all microcopy, empty states, error states, confidence labels, disclaimers.
7. `design:accessibility-review`: run a WCAG 2.1 AA audit at the end; fix every issue found.
8. `design:design-critique`: run a critique on screenshots of every primary screen; iterate once on the findings.
9. `run`: launch the app and verify the core flow end-to-end in the browser before declaring done.

## Design direction (shared across WXY prototypes)
- Aesthetic: "architectural drawing set", not "AI chatbot". Think title blocks, sheet numbers, hairline rules
  (0.5–1px), generous whitespace, plan-grid backgrounds at very low contrast, drawing-annotation style
  callouts with leader lines for citations.
- Palette: near-monochrome warm paper (#F6F4EF-ish) / graphite ink, ONE accent color used only for interactive
  state and citations. Full dark mode ("blueprint/night" variant) via CSS tokens on :root, with
  prefers-color-scheme plus a manual toggle.
- Type: a refined grotesk for UI (e.g. Inter Display, Söhne-alternative, or IBM Plex Sans), a monospace for
  section numbers, clause IDs, numeric values (IBM Plex Mono / JetBrains Mono). Tabular numerals everywhere numbers align.
- Citations look like drawing references: a small boxed tag like [ZR 23-153 ¶b] that, on hover, previews the
  passage and, on click, opens the source pane scrolled and highlighted to the exact span.
- Motion: subtle, physical, purposeful (source pane slides in with a spring; highlights fade in). Respect
  prefers-reduced-motion.
- Responsive: designed for 1440px desktop first (two- or three-pane), usable at 1024px, readable at 390px mobile.
- Never: purple gradients, sparkle emojis, "✨ AI" badges, bubbly chat bubbles, robot avatars.

## Tech baseline
- Next.js (App Router) + TypeScript (strict), Tailwind with design tokens, shadcn/ui primitives, Framer Motion.
- Postgres + pgvector (local via Docker) for chunks/embeddings; Drizzle ORM. Hybrid retrieval: BM25 (Postgres
  full-text) + vector, fused with reciprocal rank fusion, then LLM rerank with claude-haiku-5-5.
- Anthropic TypeScript SDK; streaming responses via route handlers / server-sent events.
- Ingestion: PDF/HTML/DOCX parsers that preserve hierarchy (article › chapter › section › paragraph) and keep
  page numbers and anchors. Chunk on structural boundaries, never mid-clause. Store parent section text for
  context expansion.
- Env: ANTHROPIC_API_KEY via .env.local (create .env.example; never commit secrets).
- Tests: Vitest for retrieval/citation logic; Playwright for the primary flow; an eval harness (see each prompt).
- Seed data: ship with a small, real public corpus so the demo works offline after ingestion. Clearly mark any
  synthetic "WXY internal" sample docs as SAMPLE.
- README: setup in ≤5 commands, architecture diagram (use `artifact-diagramming` guidance for a clean SVG),
  known limitations, cost notes.

---

# PROTOTYPE 1B — "Site Brief": Automated, Cited Zoning Analysis from an Address

## One-line pitch
Enter an address or BBL and get a draft zoning analysis memo for the parcel in minutes: lot data, zoning
districts, overlays, permitted uses, bulk regulations (FAR, height, setbacks, yards, coverage) and a calculated
buildable envelope summary. Every number traces to a data source or clause, and every calculation shows its work.

## Why this matters for WXY
Manual site/zoning research is repeated on every project and feeds directly into massing (Project 3). This
prototype's structured output (zoning envelope JSON) must be designed as the INPUT contract for the massing prototypes.

## Data sources (verify current endpoints via web research before coding; cache responses locally)
- NYC Geoclient or NYC Planning Labs geosearch for address → BBL.
- MapPLUTO / PLUTO (NYC Open Data, Socrata API) for lot area, frontage, depth, existing BFA, zoning district(s),
  overlays, special districts, landmark/historic district flags.
- DCP zoning GIS layers (zoning districts, special purpose districts, commercial overlays, inclusionary areas) for
  the map and for split-lot detection.
- Zoning Resolution text corpus (same ingestion approach as a cited RAG system) for rule lookup.
- Record dataset name, version/release, and fetch timestamp for every value.

## Core flows
1. INPUT: One field with address/BBL autocomplete. Optional: intended use (residential / commercial / community
   facility / mixed), and toggles for programs (e.g. affordable housing bonuses) that change bulk rules.
2. SITE CARD: Map (MapLibre GL, a custom monochrome style that matches the drawing aesthetic) centered on the lot,
   with lot outline, adjacent lots, district boundaries, overlays. Lot facts table: every value has a source tag
   ("PLUTO 25v2 · fetched 2026-10-25").
3. ANALYSIS MEMO (generated, streamed), with sections:
   - Zoning designations (incl. split-lot handling: flag and analyze each portion).
   - Permitted use groups (cited).
   - Bulk regulations table: Rule | Value | Applies because | Citation. Columns use tabular mono figures.
   - Calculations panel: deterministic TypeScript functions (NOT the LLM) compute max ZFA = lot area × FAR etc.
     The LLM selects which rule values apply (with citations); code performs arithmetic. Show formulas inline
     ("5,000 sf × 3.0 FAR = 15,000 sf ZFA").
   - Assumptions & open questions: e.g. "Assumed interior lot (not corner) — PLUTO lot type = 5" with
     Accept/Override. Overrides recompute the memo.
   - Flags requiring professional review: landmarks, special districts, split lots, irregular lots, pending rezonings.
4. ENVELOPE OUTPUT: Generate a typed `ZoningEnvelope` JSON (lot polygon in local coordinates + EPSG:2263 reference,
   max FAR by use, base height min/max, max building height, setback planes with distances & heights, yard depths,
   lot coverage, sky exposure plane parameters where applicable, citations per field, assumptions[]). Show a simple
   3D preview (react-three-fiber) of the envelope as a translucent wireframe volume on the lot. Export JSON +
   "Open in Massing" deep link (placeholder).
5. EXPORT: PDF memo styled as a drawing-set sheet (title block, north arrow, scale bar on map, sheet number,
   "DRAFT — for professional review" stamp). Also .md and .json.

## AI architecture
- Tooling-first: Claude (sonnet) operates as an agent with typed tools: `geocode`, `getPluto`, `getZoningLayers`,
  `searchZoningText`, `getClause`, `calculate` (deterministic calculators), `flagForReview`. Opus only for
  split-lot or conflicting-rule resolution. Haiku for extraction/reranking. Confirm tool-use patterns via `claude-api`.
- Structured outputs validated with Zod. Any envelope field without citation or data-source provenance fails
  validation → shown as "Needs input" in UI, never silently filled.
- Deterministic unit-tested calculators in /lib/zoning/calc (FAR, ZFA, yard depths, coverage).

## Evaluation
- 10 test parcels (mix: interior lot, corner lot, split-lot, special district, landmark). For each, hand-write
  expected key values from public sources (mark any you could not verify). `npm run eval` compares outputs; report
  field-level accuracy and provenance completeness (target 100% provenance).

## UI layout
- Two-column desktop: left 40% map + 3D envelope toggle (segmented control "Plan | 3D"); right 60% memo in a sheet
  frame with title block. A progress rail at the top shows steps (Locate → Lot data → Districts → Rules → Calculate
  → Review) with real-time status.
- Data provenance hover cards on every value. Values whose user override diverges from source show a subtle
  "overridden" mark with the original value on hover.
- Use `dataviz` for the bulk table, any coverage/FAR meters, and the step rail.

## Acceptance criteria
- Address → complete draft memo with map + envelope preview in <60s.
- 100% of numeric outputs have provenance; arithmetic done in code with visible formulas.
- Split-lot and landmark cases are flagged, not guessed.
- Envelope JSON validates against the published schema (document it in /schemas/zoning-envelope.schema.json).
- a11y clean, critique iteration done, verified with `run`.

## Out of scope
Non-NYC jurisdictions (but architect for them), DOB filing, full sky-exposure geometry for every district
(implement for 2–3 representative district types, flag others as "manual").
