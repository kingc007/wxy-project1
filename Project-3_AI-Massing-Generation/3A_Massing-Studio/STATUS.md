---
type: status
prototype: 3A
status: prototype-complete (AI mode + Rhino open unverified)
tags: [wxy, status, 3A]
---

# 3A — Massing Studio — Brief-to-Massing Options · Status Log

Spec: [[3A_Massing-Studio/PROMPT|PROMPT]] · Project: [[Project 3 Overview]]

> [!note] Maintained by the Opus manager. One dated entry per milestone. Keep it factual: what was built, what was verified (and how), what is unverified, open questions.

## Milestones
- [x] Skills read (claude-api, frontend-design, shadcn, apple-design, dataviz, ux-copy) — distilled in `../_manager/`
- [x] Research complete & verified (see `research/`)
- [x] Scaffold + data/ingestion
- [x] Core flows working (built-in mode; AI mode untested — no key)
- [x] Tests + eval harness passing
- [x] a11y audit fixed (pass 2 in `a11y-audit.md`)
- [x] Design critique iteration done (`design-critique.md`)
- [x] Verified end-to-end with `run` (production build, built-in mode)

## Log

### 2026-10-25 — Plan + research + scaffold
**Plan.** Manager docs in `../_manager/`: `engine-spec.md` (grammar, envelope model, metrics, compliance, AI boundary),
`ai-spec-3A.md` (routes, tools, prompts, cost guard, offline mode), `design-system.md` (tokens, type, motion, dataviz
palette), `copy-deck-3A.md`, `claude-api-guidance.md`.
**Input contract.** Canonical `_Shared/schemas/zoning-envelope.schema.json` v1.0.0 (Project 1) exists → used as-is
(no draft written). Copied into `app/schemas/`.
**Research.** `research/library-apis.md` (manifold-3d 3.5.4 for 2D booleans/offset + extrude, so clipper2 isn't
needed; rhino3dm 8.35.0; suncalc 2.1.1 returns DEGREES, azimuth clockwise from north; three pinned <0.187 for
postprocessing). `research/nyc-footprints-data.md`: verifier PASS 14 / FAIL 3. The failures are quote-form issues
on claims we don't use (page URL, count quote, licence absence). Dataset 5zhs-2jue, fields `height_roof` /
`ground_elevation` in ft, 205 footprints near Fort Greene Park, Brooklyn fetched 2026-10-25. Zoning values:
`_Shared/research/nyc-zoning-sample-envelope-values.md`, verification in progress.
**Scaffold.** Next 16.4.3, React 19.3, Tailwind 4.3, shadcn base-nova (Base UI), zod 4.6.7, @anthropic-ai/sdk 1.3.0,
vitest 5.0.5. Typecheck/lint/test/build pass (verified by manager). Token contrast checked by the manager: every text
token ≥ 5.78:1 (AA).
**Open.** No ANTHROPIC_API_KEY on this machine, so AI mode can't be exercised yet. An offline built-in mode is designed in.

### 2026-10-26 — Prototype complete (built-in mode verified; AI mode and Rhino untested)
**Built** (app/, commits 0ac1f11 → e21adbf): deterministic engine `src/lib/massing` (manifold-3d 2D ops; envelope
sections incl. sky exposure plane; one composite parametric grammar with 6 typology presets; floor-by-floor generation;
metrics; independent compliance checker; analytic sun/shadow; grounding check; active-key diversity metric). AI layer
`src/lib/ai` + routes: haiku brief parser, sonnet strategy loop (engine-backed tools, grounding and diversity enforced,
cost guard, prompt caching), iterate (param diff + change list), intent, Opus "Think harder"; offline built-in parser and
per-use preset fitter (keeps typology, zero Fails on all 54 eval fits). UI: stepper, compare grid (synced cameras),
focus viewer, zoning table with citations, program fit, parameter sliders (live ~1 ms regen), iterate + history/undo,
sun strip, exports, dev usage drawer, AI/Built-in switch. Exports: .3dm (feet, layers Envelope / Context /
Option_NN::Program, user text: metrics, params, assumptions, citations), glTF, Grasshopper param JSON, A-001 PNG boards.
**Verified by the manager:** 306/306 tests; typecheck, lint, `next build` clean; production server run in the browser
(sample B, brief 2): six options in 1.1 s, zoning table, sun ("Courtyard sun: 1.5 h on Jun 21"), iterate → apply → undo,
live a11y announcements; board SVG inspected visually; envelope/compliance numbers probed on all three samples.
**Eval (offline, `app/eval/report.html`)**: no-Fail 100 % on all 9 runs; Passes-all-rules 0–50 %. The rest are honest
Reviews: retail with no commercial FAR on R7A/R8A/R10; sample C's min base height is `needs_input`. Program fit ±5 %:
A/B 0 % (targets exceed envelope capacity; notes say "Can't reach … closest is …"), C 100/50/83 %. Diversity 0.38–0.42.
Latency 0.3–1.2 s per run. Cost $0.

**Acceptance criteria**
| Criterion | Status |
|---|---|
| Brief → 6 diverse options with metrics in < 30 s | ✅ built-in (1.1 s measured). ⚠ AI mode not measured (no API key) |
| All metrics computed in code; unit tests cover area/FAR/clipping | ✅ (engine tests incl. envelope clipping, SEP, containment) |
| Non-compliant options labelled with failing rule, never hidden/fixed | ✅ Fail/Review rows with rule + detail; trimming shown as Review; missing-FAR uses flagged |
| .3dm opens in Rhino with layers, feet, attributes | ⚠ rhino3dm round-trip test passes (units, layers, user text); **not opened in Rhino 8** — not installed here. Manual steps: `app/docs/rhino-verification.md` |
| a11y + critique iteration; `run` verified | ✅ (no screen-reader or axe run — see a11y-audit.md limitations) |

**Not verified / open**
- AI mode end to end (strategy loop, strict tool schemas against the live API, cache hit rate, real cost per run) — needs
  `ANTHROPIC_API_KEY` in `app/.env.local`.
- Export buttons not clicked in the browser (that would download files); export code verified in Node tests.
- First 3D load shows a blank stage for ~5–8 s (WASM + WebGL init) — add a loading caption.
- Night-model dark mode: 3D ground/paper stays light.
- Offline iterate keyword rules can remove a typology's move ("shorter" on a 2-floor tower → 0); the change list shows
  it before applying (designer decides).

### 2026-10-29 — Project scope cut to 3A (final)
At the user's request, 3B GH Copilot and 3C Option Field were **permanently deleted** (folders, research notes, specs);
3A is the kept prototype. The engine now lives in `../shared/massing` (`@wxy/massing`, own git repo, 187 tests) and 3A
depends on it (`file:` dependency). Re-verified after the deletion: 3A 120 tests + engine 187 tests pass, typecheck
clean, `next build` succeeds. Also verified on Project 1's three real envelopes (`_Shared/schemas/examples/`, schema
v1.0.0): all validate and generate; typologies that can't fit a narrow real lot are flagged "doesn't fit this lot".
Still open (unchanged): AI mode needs `ANTHROPIC_API_KEY` in `app/.env.local` to be exercised; the .3dm has not been
opened in Rhino 8 (manual steps in `app/docs/rhino-verification.md`).
- 2026-10-29: the user confirmed **no Anthropic API key will be provided**. Built-in mode (offline brief parser + deterministic
  preset fitter, labelled "Built-in (no AI)") is the operating mode. The AI code paths stay in place, tested against a scripted
  fake client, but have never been run against the live API. The acceptance criterion "brief → 6 options < 30 s" is met in
  built-in mode only (1.1 s measured).

### 2026-10-30 — Motion & feel redesign (manager)
User feedback: the UI "looks very robotic". Direction written in `_Shared/Motion & Feel.md` ("Drafted, not printed"),
from motion.zajno.com + the frontend-design / apple-design / shadcn / premium-frontend-ui skills. Built by builders,
reviewed and verified by the manager.
- 3A: sample lots drawn as hairline footprints at one shared scale, camera zoom arrival, compare↔focus frame morph (canvases cross-fade), DimensionString option metrics, display headings, translucent toolbar/popovers, API-key copy → usage drawer, graphite-night dark (text ≥ 5.08:1). Verified: tsc, lint, Vitest 120/120, browser at 1440 light + night (load → arrival → generate 6 → select → focus). Not verified: reduced-motion path. Commit e4989a1.
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
Same spec as 1B: `_Shared/Readability Pass.md`.
- Viewer toolbar: icon + text labels, grouped; slider labelled "Cut height" with value. Export no longer truncated. "Strategies" toggle labelled and explained; AI disabled with a plain reason when no key. Setup steps show done / current / upcoming. Generate's blocker shown once with a jump link to the step that unblocks it. Zoning table uses Pass / Fails / Needs input pills. Compare tiles: name in Archivo wide, status pill, "Selected" marker. Empty right panel lists what will appear. "Fails 2 rules" (was "rule(s)").
- Verified (manager): tsc, lint, Vitest 128/128, no horizontal scroll at 390/768/1440, 0 console errors on load + site select. Builder ran injected axe-core on empty/brief/schedule/compare/selected in both themes: 0 violations (not re-run by manager).
- Not verified: AI mode with a real key; Sun study panel and export menu after restyle; jump-link opening the Setup sheet below 1024px.
- **Fixed (feature, user decision 2026-10-30 "fit to FAR"):** with no program target, built-in options are now fitted to the allowed floor area (residential FAR × recorded lot area, else the highest FAR) instead of showing the typology preset unchanged. Change is in 3A `src/lib/ai/fit.ts` (`zoningCapacityGfa`); the shared engine is untouched; `targetGfa` still reports the schedule target (null). Before: R7A interior, 5 of 6 options failed FAR (e.g. courtyard 5.51 / 4.00). After, empty schedule, verified in the browser: R7A interior all 6 ≤ 4.00 (4 pass, 2 needs review); R8A corner all 6 pass (5.84–6.01 / 6.02); R10 through-block all 6 ≤ 10.00, needs review (no fails). New unit test: every typology with an empty schedule has no FAR fail. Vitest 128/128; eval unchanged apart from latency (briefs always set a target).
