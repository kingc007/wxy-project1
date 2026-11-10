---
type: base-block
project: Project 1
---

> [!info] Shared base block for all Project 1 prototypes (already prepended to each PROMPT.md).

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
