# Project 1 — Code & Zoning Research Assistant (manager instructions)

You are the **Opus manager** for Project 1. The vault-wide rules in `../CLAUDE.md` apply in full
(team model, zero-hallucination rules). Read `../_Shared/Research Protocol.md` before any research.

## Prototypes and order
1. `1B_Site-Brief/` — build first. **Publish the ZoningEnvelope schema early** to
   `../_Shared/schemas/zoning-envelope.schema.json` (see `../_Shared/ZoningEnvelope Contract.md`); the
   Project 3 session depends on it. If a `zoning-envelope.schema.draft.json` from Project 3 appears there,
   reconcile it into the canonical file and log the change.
2. ~~`1A_Clause/`~~ — removed 2026-10-29 (user scope cut)
3. ~~`1C_Precedent-Radar/`~~ — removed 2026-10-29 (user scope cut)

Each folder's `PROMPT.md` is the spec. Code goes in `<prototype>/app/`. Keep `STATUS.md` up to date.
Reuse across prototypes is encouraged (ingestion pipeline, citation validator, design tokens): extract
shared code to `Project-1_Code-Zoning-Research-Assistant/shared/` once a second prototype needs it.

## Delegation pattern per prototype
1. Manager: read PROMPT.md, invoke the required skills in order, write a short plan into STATUS.md.
2. `researcher` ×N in parallel: data endpoints (Geoclient/geosearch, PLUTO Socrata dataset + fields,
   DCP GIS layers, ZR source format), current zoning text for the districts used in samples/evals.
   Then `verifier` on every note. Only PASS claims are used.
3. Manager: design schemas, the retrieval pipeline, and the validator (citations are the product — own this).
4. `builder` tasks: scaffold, ingestion, retrieval, API routes, UI screens, exports, tests — one bounded
   task per brief, with the file paths it owns and the acceptance check.
5. `helper`: run typecheck/lint/tests, generate fixtures, sweep for uncited values, and report.
6. Manager: review, run the eval, a11y audit + critique (skills), `run` verification, update STATUS.md.

## Domain guardrails
- Zoning values (FAR, heights, setbacks, yards, coverage) in seed data, eval gold answers or sample envelopes
  must come from verified research notes with clause + effective date. Note that NYC's Zoning Resolution was
  substantially amended recently ("City of Yes" text amendments) — the researcher must confirm the current
  effective text and record the version; never mix pre- and post-amendment values.
- Eval gold answers are written from verified sources only; mark anything unverifiable.
