---
type: guidance
source: Opus manager via design:ux-copy skill, 2026-10-25
---
# 3A Massing Studio — copy deck (use verbatim unless a layout forces a shorter variant)

Voice: a senior architect's drawing-set notes. Plain verbs, sentence case, no hype, no "AI magic". Errors don't apologize.

## Stepper (left rail)
Site · Brief · Program schedule · Assumptions  (step labels; the stepper is a real sequence → numbering allowed)
- Site, empty: "Pick a sample site or load a zoning envelope (.json) to start."
- Site loaded subline: "{lot area} sf lot · {district} · max FAR {far}"  + SAMPLE tag when sample.
- Brief placeholder: "Describe the project the way you'd brief the team: units, uses, ground floor, open space, moves you want to try. e.g. ~120 units, ground-floor retail, a public courtyard, step down toward the park."
- Brief CTA: "Read brief"   (→ parses into schedule). Loading: "Reading the brief…"
- Schedule header: "Program schedule" · helper: "Check what we took from your brief. Nothing is generated until you confirm."
  Row controls: "Accept" / "Edit". Inferred value tag: "Inferred".
- Assumptions header: "Assumptions" · helper: "Values we had to assume. Edit any of them; metrics update."
  Assumption names: "Floor-to-floor, residential", "Floor-to-floor, commercial", "Floor-to-floor, community facility",
  "Ground floor height", "Average unit size (net)", "Efficiency (net ÷ gross)".
- Confirm CTA: "Confirm schedule". After confirm: "Generate 6 options". Loading: "Building 6 options… {n}/6".

## Parameter names (designer language → engine key)
Typology · Podium height (floors) · Tower footprint (% of lot) · Tower position (along street / depth) ·
Street wall height · Step-back above street wall (ft) · Front / side / rear setback (ft) · Courtyard width / depth (ft) ·
Terrace step (floors per step) · Terrace depth (ft) · Bar depth (ft) · Bar orientation (°) · Split gap (ft) ·
Carve depth (ft) · Floor-to-floor (ft) · Orientation (°)

## Compare grid card
Title "Option {n} · {name}" · intent line (≤ 90 chars) · metric row: "FAR {used} / {max}", "GFA {x} sf", "Height {h} ft",
"~{u} units", "Open space {p}%", status badge "Passes all rules" | "Fails {k} rule(s)" | "Needs review".

## Zoning table
Columns: Rule | Allowed | Proposed | Status. Status words: "Passes", "Fails", "Review". Allowed cell links: "Source: {citation}".
Rule names: "Floor area ratio (FAR)", "Zoning floor area", "Max building height", "Base height (street wall) min / max",
"Lot coverage", "Rear yard", "Front yard", "Side yards", "Setback above base height", "Sky exposure plane", "Envelope containment".
Footer: "Metrics are computed by the geometry engine, not the AI. Study-grade; verify with a zoning professional."

## Iterate
Field placeholder: "Tell this option what to change, e.g. pull the tower east, more light in the courtyard."
CTA: "Propose changes" → change list title "Proposed changes ({n})" → "Apply changes" / "Discard".
After apply toast: "Changes applied. ⌘Z to undo." History item: "{time} · {instruction}".

## Shadows
Toggle: "Sun study". Presets: "Mar 21 (equinox)", "Jun 21 (summer solstice)", "Dec 21 (winter solstice)".
Metric: "Courtyard sun: {h} h on {date}". Footnote: "Study-grade shadow approximation, not a certified daylight analysis."

## Export
Menu: "Export .3dm for Rhino", "Export glTF", "Export boards (PNG)", "Export parameters (JSON for Grasshopper)".
Done: "Exported {file}."

## Errors / empty
- Invalid envelope: "This file isn't a valid zoning envelope: {field} {problem}. Check it against zoning-envelope.schema.json."
- No API key: "AI features are off: no Anthropic API key on the server. Add ANTHROPIC_API_KEY to .env.local and restart. You can still use the built-in strategy set."
- AI failed: "The AI couldn't return a valid strategy ({reason}). Try again, or edit parameters by hand."
- Targets not met: "Can't reach {target} inside this envelope — closest is {value}."
- Over budget: "Stopped at the cost limit ({$x}). Raise the limit in Settings or generate fewer options."
- Compare empty: "No options yet. Confirm the program schedule, then generate."
