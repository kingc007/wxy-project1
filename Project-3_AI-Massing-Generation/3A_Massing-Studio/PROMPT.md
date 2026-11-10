---
type: prompt
project: "Project 3"
prototype: 3A
name: "Massing Studio — Brief-to-Massing Options"
build_order: 1
tags: [wxy, prompt, 3A]
---

> [!info] Full build prompt (shared base block + prototype spec, verbatim). Back to [[Project 3 Overview]] · [[Home]]

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

---

# PROTOTYPE 3A — "Massing Studio": Brief-to-Massing Options in the Browser

## One-line pitch
Load a site envelope, describe the brief in plain language ("~120 units, ground-floor retail, a public courtyard,
step down toward the park"), and get 6 diverse, compliant massing options in seconds, each with deterministic
metrics, exposed assumptions, and one-click export to Rhino.

## Core flows
1. SITE: Choose a sample envelope or upload `ZoningEnvelope` JSON. Viewer shows lot, envelope as a translucent
   wireframe, simple context blocks (extruded footprints from a bundled sample of NYC building footprint data,
   with heights).
2. BRIEF: A writing surface (not a chat bubble) for the brief. Below it, the AI parses the brief into an editable
   "Program Schedule" (use, target GFA/units, ground-floor requirements, open-space targets) and an
   "Assumptions" list (floor-to-floor by use, unit avg size, gross-to-net efficiency), each with an
   [Accept] [Edit] control. Nothing generates until the schedule is confirmed (one click).
3. GENERATE: The AI produces 6 strategies deliberately spread across a design space (e.g. podium + tower,
   perimeter block with courtyard, stepped terraces, slab + bar, split massing, carved volume). Enforce diversity:
   strategies must differ on ≥2 typological parameters; reject near-duplicates via parameter-distance check.
   Each strategy = typed JSON → geometry engine → clipped to envelope → metrics.
4. COMPARE: 2×3 grid of synchronized mini-viewports (shared camera; orbit one, all follow) with name, one-line design
   intent, and key metrics (FAR used / max, GFA, height, units est., open space %, compliance status). Click to
   focus → full viewer + side panel:
   - Zoning table: Rule | Allowed | Proposed | Status (Pass / Fail / Review), each "Allowed" value linked to its
     envelope citation.
   - Parameter panel: sliders/inputs for the strategy's parameters with live geometry + metric updates (<100ms for
     typical changes; debounce heavy booleans). Sliders snap to sensible increments (floor heights, 5-ft setbacks).
   - "Design intent" note (AI-written, editable) explaining the idea in architect language. No invented claims about
     metrics: it may only reference computed values passed to it.
5. ITERATE WITH LANGUAGE: Per-option instruction field ("pull the tower east, more light to the courtyard") →
   AI returns a parameter DIFF (shown as a reviewable change list before applying) → apply/undo. Full history per option.
6. SHADOWS: Toggle sun study (date/time scrubber with seasonal presets); shadow footprint on context and ground;
   quick "shadow hours on courtyard" metric computed in code.
7. EXPORT: .3dm (layers: Envelope, Option_N/Program, Context; user-text attributes with all metrics, parameters,
   assumptions, envelope citations), glTF, PNG boards (axonometric set of all options with metric tables in a
   title-block frame), and parameter JSON.

## AI architecture
- Brief parsing: haiku → structured ProgramSchedule (Zod-validated).
- Strategy generation: sonnet with tool use. Tools: `listTypologies`, `generateMassing(params)`,
  `evaluate(optionId)`, `checkCompliance(optionId)`. The model iterates: propose → evaluate → adjust, max 3 loops per
  option, then returns its best parameter set and an honest note if targets could not be met within the envelope.
- Creativity: system prompt + a typology library with real urban design references (described generically, not
  copied imagery) and an explicit "divergence" instruction; temperature/sampling per `claude-api` guidance.
- Cost guard: one generation run ≤ a configurable budget; show tokens/cost in a dev drawer. Cache system prompt
  + typology library.

## Evaluation
- For each of the 3 sample envelopes × 3 briefs: % options fully compliant, mean diversity score (parameter
  distance), % program targets met within ±5%, generation latency, cost. `npm run eval` → HTML report with
  thumbnails.

## UI layout
- Left rail (320px): Site → Brief → Schedule → Assumptions (a vertical stepper you can jump around in).
- Center: 3D viewer / options grid (toggle). Viewer controls bottom-center as a compact floating toolbar
  (Axon presets, Plan, Section-cut slider, Sun, Model/Diagram style).
- Right panel (380px): selected option details, zoning table, parameters, history.
- Keyboard: 1–6 select option, C compare, S sun, E export, ⌘Z undo, arrow keys orbit when viewer focused.
- Use `apple-design` for camera easing (damped, interruptible), panel springs, slider feel.

## Acceptance criteria
- Brief → 6 diverse options with metrics in <30s.
- All metrics computed in code; unit tests cover area/FAR/clipping.
- Non-compliant options are clearly labeled with the failing rule. They are never silently "fixed" or hidden.
- .3dm opens in Rhino with correct layers, units (feet), and attributes (document the manual verification steps).
- a11y + critique iteration done; `run` verified.
