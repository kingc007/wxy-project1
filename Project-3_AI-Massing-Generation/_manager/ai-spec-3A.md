---
type: spec
owner: Opus manager
applies_to: 3A /src/lib/ai + /src/app/api/*
version: 0.1 (2026-10-25)
---
# 3A AI layer spec ("LLM proposes, geometry engine disposes")

Read with [[engine-spec]] and `claude-api-guidance.md` (model IDs, no temperature, no forced tool_choice, strict tools,
caching, stop_reason handling). All Anthropic calls happen server-side in Next.js route handlers (`runtime = "nodejs"`).
The engine (`@/lib/massing`) runs on the server for tool calls AND in the browser for live editing — same code.

## Modes
- `AI` mode: ANTHROPIC_API_KEY present (server env). `GET /api/status` → `{ai: boolean, models, costLimitUsd}` (never the key).
- `Offline` mode (no key, or user toggles "Built-in strategies"): deterministic fallbacks below. The UI labels every
  output produced this way "Built-in (no AI)". Offline mode is also the eval baseline.

## Routes (all POST JSON, zod-validated in and out)
1. `/api/parse-brief` {brief, envelopeSummary} → {schedule: ProgramSchedule, assumptions: Partial<Assumptions>, usage}
   - claude-haiku-5-5, `messages.parse` + `zodOutputFormat(ProgramScheduleSchema+AssumptionsSchema)`, effort low.
   - Post-check in code: any `source:"brief"` number must literally appear in the brief text (else downgrade to
     `inferred`). `confirmed` forced false. Offline: regex parser for "~N units", "N sf/sq ft of <use>",
     "ground-floor retail/commercial", "community", "courtyard", "toward the <dir|park>"; else defaults.
2. `/api/generate` {envelope, schedule(confirmed=true required → 400 otherwise), assumptions, count:6} → stream
   (NDJSON) of {slot, status, option?: {typology,name,intent,params,notes,agentLog}, usage} then {done, totals}.
   - 6 slots in parallel, each assigned a distinct typology (the six presets) — deliberate spread.
   - Per slot: claude-sonnet-5-5 manual tool loop, effort "low", max 4 model turns, max 3 generateMassing calls
     (4th returns is_error "Loop limit reached — submit your best parameters").
   - Tools (strict, additionalProperties:false; descriptions short and exact):
     - `listTypologies()` → typology library (name, idea, key params, when it works/fails).
     - `generateMassing({typology, params})` → runs engine server-side; returns {optionDraftId, metrics (rounded),
       overall status, failing rules [{rule, allowed, proposed}], programFit, trims}. Invalid params → is_error with
       zod messages.
     - `checkCompliance({optionDraftId})` → full zoning table rows (no citations text, to save tokens).
     - `submitOption({optionDraftId, name, intent, notes})` → ends the slot. intent/notes go through
       checkGrounding against that draft's computed values; ungrounded → is_error listing unmatched numbers (1 retry).
   - Code then: re-generate from params (never trust cached), diversity check vs already-accepted options
     (isNearDuplicate) → if duplicate, slot falls back to its offline preset fit and notes "AI option was a near-duplicate;
     replaced with the built-in preset". If the model ends without submitOption → take its best generateMassing draft
     (fewest fails, then best program fit) with intent "No note — the AI didn't finish" (UI shows it).
   - Cost guard: running total from usage × price table (claude-api-guidance.md); before each model turn, if
     projected total > MASSING_COST_LIMIT_USD → stop that slot (fallback preset) with reason. Totals returned
     {input, output, cacheRead, cacheWrite, usd, ms} for the dev drawer.
   - Caching: system prompt = [role + rules + grammar param table + typology library] as ONE stable text block with
     cache_control ephemeral (byte-stable, no dates/ids; tools array in fixed order). Envelope/schedule go in the user
     message. Log cache_read_input_tokens.
   - Offline: `fitPreset(typology)` — start from preset, search upperFloors (and baseFloors for low-rise types) to bring
     total GFA closest to target without new Fails (deterministic scan), intent from a template filled ONLY with
     computed values.
3. `/api/iterate` {envelope, schedule, assumptions, option(params, typology), instruction, history} →
   {diff: ParamDiff with `from` filled by code, preview: {metricsBefore, metricsAfter, overallBefore/After}, usage}
   - claude-sonnet-5-5, effort low, structured output ParamDiff; code validates each key/value (range, step);
     invalid → one repair round with the errors, then return errors to UI. Nothing applied server-side: client applies
     on "Apply changes", pushes history, ⌘Z pops.
   - Offline: keyword rules ("taller/shorter", "east/west/north/south" → towerU/towerV or stepFrom, "more light" →
     courtyard ringDepth −5 / stepDepth +5) clearly labelled.
4. `/api/intent` {option, envelopeSummary} → {intent} (sonnet, effort low; grounded or rejected).
Opus (`claude-opus-5-5`) is wired only behind an explicit "Think harder" button on generate for one slot
(hard multi-constraint), effort medium. Never default.

## System prompt (strategy) — outline (keep stable; ≥512 tokens so it caches)
- Role: "You are a massing strategist for WXY Architecture + Urban Design, a New York firm. You propose design
  STRATEGIES as parameters for a deterministic geometry engine. You never output coordinates or invent metrics; the
  engine computes all numbers and checks zoning. Designers are the authors; your job is to widen the design space."
- Rules: use only the tools; call generateMassing, read the computed results, adjust at most twice, then submitOption.
  Pursue the assigned typology and make it a strong, specific version of that idea (not a generic box). If targets
  cannot be met inside the envelope, say so plainly in notes, citing only the numbers the tools returned. Never fix a
  failing rule by misdescribing it. Write intent in architect language (street wall, light, public realm, scale),
  ≤160 chars, no hype words.
- Grammar: the param table (label, unit, range, meaning) from PARAM_SPECS.
- Typology library (generic references, no copied imagery):
  podium_tower (street-wall base holding the block edge, slender tower set back above — common in dense North American
  cores; works on deep lots; risks: shadow fan, sterile base), perimeter_courtyard (continuous street wall around a
  shared court — European block tradition; good daylight if court ≥ building height ratio; risk: deep court shade),
  stepped_terraces (floors step back toward a light source or open space, creating roof terraces — hillside/
  ziggurat housing; risk: lower GFA), slab_bar (thin bars oriented for light and through-ventilation — modernist slab
  housing; risk: weak street wall), split_massing (two volumes with a mid-block gap or passage — permeability, views;
  risk: more facade per GFA), carved_volume (a full block with a carved void/notch for an entry court or light well —
  sculptural subtraction; risk: complex structure).
- Divergence instruction: "Other slots are exploring other typologies; make yours unmistakably distinct."

## Grounding & honesty enforcement (tests required)
- Every AI text shown in UI passes checkGrounding against the option's allowed numbers.
- Test: feed recorded/mocked model outputs with an invented number → route rejects it.
- Test: route never forwards model-provided metrics; option metrics always equal generateOption(params) output.
- Mock client: `src/lib/ai/client.ts` exports a factory; tests inject a fake Anthropic-like client returning scripted
  tool_use blocks (so the whole loop is tested without a key).

## Eval (`npm run eval`)
3 sample envelopes × 3 briefs (stored in `eval/briefs.json`, written by the manager), modes: offline (always) and AI
(when key present). Metrics: % options fully compliant, mean diversity (paramDistance), % program targets within ±5 %,
latency, cost. Output `eval/report.html` with SVG thumbnails (axon projection of prisms, rendered in code) +
tables, and `eval/results.json`.
