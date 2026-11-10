# Project 3 — AI-Assisted Massing Generation (manager instructions)

You are the **Opus manager** for Project 3. The vault-wide rules in `../AGENTS.md` apply in full
(team model, zero-hallucination rules). Read `../_Shared/Research Protocol.md` before any research.

## Prototypes and order
1. `3A_Massing-Studio/` — first. Build the deterministic geometry engine (`/lib/massing`) so 3C can reuse it.
2. `3C_Option-Field/` — reuses the engine; extract it to
   `Project-3_AI-Massing-Generation/shared/massing/` once both apps need it.
3. `3B_GH-Copilot/` — last. Needs Rhino 8 + a Windows/Mac .NET build environment. Check what is installed
   on this machine first; build and test what can run here, and document clearly which steps could not be run.

Each folder's `PROMPT.md` is the spec. Code goes in `<prototype>/app/` (3B: `app/plugin`, `app/panel-ui`,
`app/service`, `app/samples`). Keep `STATUS.md` up to date.

## Input contract dependency
The ZoningEnvelope schema is owned by Project 1 (built in 1B), which runs in a separate chat.
- Look for `../_Shared/schemas/zoning-envelope.schema.json`. If present, use it as-is.
- If not present yet, draft `../_Shared/schemas/zoning-envelope.schema.draft.json` from your PROMPT's
  "Input contract", log it in `../_Shared/ZoningEnvelope Contract.md`, and proceed. Re-check later and
  migrate to the canonical schema when it appears. Never edit the canonical file yourself.
- Sample envelope values (interior lot, corner lot, through-block site) come from verified research notes;
  anything simplified is labelled SIMPLIFIED, all samples are labelled SAMPLE.

## Delegation pattern per prototype
1. Manager: read PROMPT.md, invoke the required skills in order, write a short plan into STATUS.md.
2. `researcher` ×N in parallel: library APIs actually published (react-three-fiber/drei/postprocessing,
   manifold-3d, three-bvh-csg, clipper2 WASM, suncalc, rhino3dm), NYC zoning values for the sample
   envelopes, NYC building-footprint open data; for 3B, McNeel RhinoCommon / Grasshopper SDK / Rhino 8
   Python 3 / Yak docs. Then `verifier` on every note. Only PASS claims are used.
3. Manager: design the parametric grammar, strategy JSON schema, compliance checker, and the
   "LLM proposes, geometry engine disposes" boundary. Own these.
4. `builder` tasks: geometry engine + unit tests, viewer, panels, exports, LLM routes — bounded, file-scoped briefs.
5. `helper`: run tests/typecheck/benchmarks, generate fixtures, check that no LLM output is used as geometry or metrics.
6. Manager: review, eval, a11y audit + critique (skills), `run` verification, update STATUS.md.

## Domain guardrails
- Metrics are computed in code only. Any number the LLM writes in prose must match a computed value (test it).
- Before using any library function, the builder confirms it in the installed package's type definitions.
