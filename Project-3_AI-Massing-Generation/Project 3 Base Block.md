---
type: base-block
project: Project 3
---

> [!info] Shared base block for all Project 3 prototypes (already prepended to each PROMPT.md).

# CONTEXT: WXY Architecture + Urban Design

You are building a prototype for WXY, a NYC architecture, urban design and planning firm. Today they build 2D/3D
models in Rhino + Grasshopper with complex geometry, measure impacts (density, shadows, etc.) manually, and run
massing studies by hand. They want AI to GENERATE massing options. They are technically strong (parametric
modeling) and say they need help on the CREATIVE side.

## Their concerns (design every decision against these)
- TRUST & ACCURACY: Massing must be geometrically valid and zoning-compliant, with metrics computed
  deterministically, never "estimated" by an LLM.
- ASSUMPTIONS: Every input the AI inferred (program split, floor-to-floor heights, efficiency factor) is visible and editable.
- CREATIVITY & BIAS: AI must widen the design space, not converge on generic boxes. Designers stay the authors.
- WORKFLOW FIT: Output must flow into Rhino/Grasshopper. Never force them to abandon their tools.
- COST & ONBOARDING: Cheap to run, learnable in minutes.

## Core architectural rule: "LLM proposes, geometry engine disposes"
- The LLM NEVER outputs raw geometry coordinates as the final truth. It outputs PARAMETERS / DESIGN STRATEGIES
  (typed JSON: typology, podium height, tower footprint ratio, setbacks, courtyard dims, stepping rules, orientation)
  or code against a constrained parametric API.
- A deterministic geometry engine generates the solid, clips it to the zoning envelope, and computes all metrics
  (GFA, ZFA, FAR, floor count, height, lot coverage, footprint, setbacks satisfied, facade area, shadow hours).
- A compliance checker validates against the envelope; violations are shown, never hidden.

## Input contract
Consume a `ZoningEnvelope` JSON (lot polygon, max FAR by use, base/max heights, setback planes, yards, coverage,
citations, assumptions). Ship /schemas/zoning-envelope.schema.json and 3 sample envelopes (an interior lot, a corner
lot, a large through-block site) marked SAMPLE. Values come from public NYC zoning rules where possible; mark any
simplified values "SIMPLIFIED".

## Required skills: invoke via the Skill tool, in this order, before writing code
1. `claude-api`: before any LLM code: current model IDs, tool use, structured outputs, prompt caching, streaming,
   and (where useful) vision input for sketch/reference-image interpretation.
2. `anthropic-skills:frontend-design`: distinctive aesthetic direction first.
3. `anthropic-skills:shadcn`: primitives, heavily customized.
4. `anthropic-skills:apple-design`: 3D camera motion, orbit damping, springy panels, gesture handling,
   reduced-motion fallbacks.
5. `dataviz`: all metric tiles, option-comparison charts, scatter/Pareto plots, sun-hour heatmaps.
6. `design:ux-copy`: all labels, parameter names in designer language (not developer jargon), errors, empty states.
7. `design:accessibility-review`: WCAG 2.1 AA audit incl. keyboard control of the 3D viewer and non-visual metric access.
8. `design:design-critique`: critique screenshots of each primary screen; iterate once.
9. `run`: launch and verify the end-to-end flow in the browser.

## Design direction
- Aesthetic: architectural model-shop meets drawing set. Default 3D style = white "chipboard/basswood" study model:
  matte white masses, soft ambient occlusion, crisp 1px dark edges (edge-detection outline pass), context buildings
  in light grey, ground as paper with a faint plan grid. Optional "diagram" mode with flat program colors.
- Program colors: a restrained, accessible categorical palette (validate with `dataviz`) for residential /
  commercial / community facility / open space. Never rely on color alone (patterns or labels too).
- UI chrome: warm paper / graphite near-monochrome, ONE accent for interaction. Dark mode = "night model" variant.
- Type: refined grotesk for UI, mono with tabular figures for all metrics.
- Metrics read like a drawing-set zoning table: Rule | Allowed | Proposed | Status.
- Never: neon sci-fi gradients, "AI magic" sparkles, glossy plastic renders.
- Desktop-first (1440px), functional at 1024px; mobile = view-only option browsing.

## Tech baseline
- Next.js (App Router) + TypeScript strict, Tailwind tokens, shadcn/ui, Framer Motion.
- 3D: three.js via react-three-fiber + drei; postprocessing for outlines/SSAO; three-bvh-csg or Manifold (WASM)
  for robust boolean ops; turf.js / clipper2 (WASM) for 2D polygon offsets and clipping.
- Sun/shadow: suncalc for sun positions (NYC lat/long), shadow casting for selected dates/times; equinox and
  solstice presets.
- Rhino interop: rhino3dm (WASM) to export .3dm with named layers per program/option and user-text attributes
  (metrics, parameters, envelope citations). Also export glTF and a parameter JSON for Grasshopper.
- Deterministic geometry + metrics live in /lib/massing with Vitest unit tests (area, FAR, setback clipping,
  envelope containment within tolerance).
- Anthropic TypeScript SDK; model routing: claude-haiku-5-5 (parse/validate/label), claude-sonnet-5-5 (strategy
  generation, critique), claude-opus-5-5 (hard multi-constraint reasoning only, on demand).
- .env.example only; never commit keys. README: ≤5 setup commands, architecture diagram, limitations, cost per run.
