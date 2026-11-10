---
type: guidance
source: Opus manager, from frontend-design + shadcn + apple-design + dataviz + ux-copy skills (2026-10-25)
---
# Project 3 shared design system: "Model shop / drawing set"

## Concept
The UI is a drawing sheet pinned to a model-shop table. Chrome = the sheet (paper, graphite linework,
title-block conventions). 3D = a white basswood/chipboard study model on a paper base with a faint plan grid.
The ONE bold thing: the study model itself, and the drawing-set zoning table (Rule | Allowed | Proposed | Status).
Everything else stays quiet.

## Color tokens (CSS variables in globals.css; Tailwind maps to them)
Light ("day sheet")
- --paper        #F6F5F1   page background (cool-warm off-white; NOT cream #F4F1EA)
- --sheet        #FFFFFF   panels / table body
- --graphite     #22252A   primary text + 1px linework
- --graphite-2   #5C6068   secondary text (contrast ≥ 4.5:1 on --paper, verify)
- --rule         #D5D3CC   hairlines, grid
- --accent       #2E46C9   "cobalt pencil" — the ONLY interaction color (focus rings, selection, primary button, slider thumb)
- --fail         #B3261E   status Fail (always with ✕ icon + word "Fails")
- --review       #8A5A00   status Review (always with ! icon + word "Review")
- --pass         #22252A   status Pass is graphite + ✓ (passing is the quiet default)
Dark ("night model")
- --paper #16181B, --sheet #1E2125, --graphite #E9E7E1, --graphite-2 #A4A6AB, --rule #34373C,
  --accent #8C9CFF, --fail #FF8A80, --review #F0B74A
Program colors (diagram mode + legends). VALIDATED with dataviz `validate_palette.js --pairs all` on 2026-10-25:
light (surface #F6F5F1) ALL PASS, worst CVD ΔE 9.2, normal-vision ΔE 24.0; dark (surface #1E2125) ALL PASS.
| Program | Light | Dark | Secondary encoding (always) |
|---|---|---|---|
| Residential | #2a78d6 | #3987e5 | solid fill + "RES" label |
| Commercial | #eb6834 | #d95926 | 45° line hatch + "COM" label |
| Community facility | #1baf7a | #199e70 | 135° line hatch + "CF" label |
| Open space | NO HUE — paper with dot texture + dashed outline | same | "Open space" label |
Light-mode orange + aqua are < 3:1 on paper → relief rule: visible labels or the table view must exist (they do: zoning table).
All-pairs forms (3D diagram, scatter) cap at 3 hues — that is why open space is a texture, not a 4th hue.
Selection in the 3D views is shown with a heavy graphite outline + label (not accent color), so the cobalt accent never
competes with residential blue.

Data-viz rules (dataviz skill):
- Sequential (sun-hours heatmap, scatter 3rd-objective color) = ONE hue light→dark: blue ramp
  #cde2fb #b7d3f6 #9ec5f4 #86b6ef #6da7ec #5598e7 #3987e5 #2a78d6 #256abf #1c5cab #184f95 #104281 #0d366b. Never rainbow.
- Status colors reserved: Pass/Fail/Review always icon + word.
- One y-axis only; thin marks; 2px lines; markers ≥ 8px; hit targets ≥ 24px (scatter uses nearest-point/Voronoi).
- Legend whenever ≥ 2 series; direct-label selectively. Text in text tokens, never in series color.
- Every chart has a hover/focus tooltip AND a table view (tooltips never gate a value). Keyboard focus = hover.
- Compliance shape in scatter: circle = compliant, ✕ = non-compliant (shape + legend, not color).
- Color follows the entity, never its rank; filtering never repaints survivors.

## Type
- UI: "Archivo" (Google Fonts, variable width axis). Body 14px/20px; panel titles Archivo SemiCondensed 600 15px.
  Title-block / sheet labels use Archivo width 75 (condensed), sentence case. NO all-caps tracked eyebrows.
- Metrics & tables: "IBM Plex Mono" with `font-variant-numeric: tabular-nums`. All numbers right-aligned.
- Scale: 12 / 14 / 15 / 18 / 24 / 32. Line length < 80ch.

## Layout (3A)
```
┌────────── 320 ──────────┬──────────────── flex ────────────────┬──────── 380 ────────┐
│ Site  ▸ Brief ▸ Schedule│  [3D viewer | 2×3 options grid]       │ Option 3 · Perimeter │
│ ▸ Assumptions (stepper) │                                       │ Zoning table         │
│                         │                                       │ Parameters           │
│                         │   [ Axon | Plan | Section | Sun | Style ] floating toolbar     │
│                         │                                       │ History              │
└─────────────────────────┴───────────────────────────────────────┴──────────────────────┘
```
Left-aligned everywhere. Panels separated by 1px --rule lines, not cards with shadows. Radius: 2px on inputs/buttons,
0 on panels. Shadows only on floating toolbar and popovers (one token: 0 1px 2px rgb(0 0 0 / .08), 0 6px 20px rgb(0 0 0 / .06)).

## Motion (apple-design, WWDC "Designing Fluid Interfaces")
- Respond on pointer-down; feedback continuous during drags (sliders update geometry 1:1, never only on release).
- Interruptible everything: camera preset tweens are cancelled by any pointer/wheel/key input and new tweens start
  from the CURRENT camera position/target (never the logical target). Use a damped camera controller (drei
  CameraControls `smoothTime` or OrbitControls `enableDamping`) — confirm the API in installed types.
- Springs, not fixed-duration CSS transitions, for panels: default critically damped
  (Framer Motion `{type:"spring", bounce:0, duration:0.35}`); bounce ~0.2 ONLY after a flick (e.g. thumbnail wall fling).
- Panels enter/exit along the same edge (right panel slides from right). Popovers originate from their trigger.
- Keyboard orbit: arrow keys rotate azimuth/polar by 15° steps with the same damped spring; +/- dolly; Home = axon preset.
- Floating viewer toolbar = translucent material (backdrop-filter blur + 70% sheet) with solid fallback under
  `prefers-reduced-transparency`; `prefers-contrast: more` → solid + border.
- `prefers-reduced-motion`: camera jumps (no tween), panels cross-fade ≤150ms, no overshoot, no parallax.
- Slider snapping: snap the value (floor heights, 5-ft setbacks) with a light tick; the thumb stays under the pointer.
- One orchestrated moment only: the six options "set down" onto the compare grid after generation.
- Undo is always available (⌘Z) instead of confirmation dialogs; confirm only destructive irreversible actions.

## Copy (ux-copy)
Designer language: "Podium height", "Tower footprint", "Courtyard width", "Street wall", "Step-back",
"Floor-to-floor", "Efficiency (net/gross)". Sentence case. Buttons say what they do: "Confirm schedule",
"Generate 6 options", "Apply changes", "Undo", "Export .3dm". Errors say what happened + how to fix.
Status words: "Passes", "Fails", "Review". Labels: SAMPLE, SIMPLIFIED, UNVERIFIED appear as small outlined tags.

## Never
Neon gradients, sparkles/✨, glossy renders, purple AI gradients, identical rounded card grids with drop shadows,
"→" on every button, ALL-CAPS eyebrows.

## shadcn/ui rules (from the shadcn skill)
- Init in the Next app: `npx shadcn@latest init --defaults` (Next template, nova preset), then `npx shadcn@latest info`
  to learn `base` (radix vs base), `iconLibrary`, aliases, `tailwindCssFile`. Use THOSE values; never assume lucide.
- Before using a component: `npx shadcn@latest docs <component>` and follow the fetched docs.
- Map our tokens onto shadcn CSS variables in the tailwind CSS file (--background=paper, --card=sheet, --foreground=graphite,
  --muted-foreground=graphite-2, --border=rule, --primary=accent, --destructive=fail, --ring=accent, --radius small).
  Restyle via cva variants, not per-use className color overrides. No manual `dark:` colors: tokens switch in `.dark`.
- Layout via `flex flex-col gap-*` (no space-y-*); `size-*` for squares; `cn()` for conditionals.
- Forms: FieldGroup + Field + FieldLabel; validation with data-invalid + aria-invalid. Option sets of 2–7 → ToggleGroup.
- Use Badge for tags (SAMPLE / SIMPLIFIED / status), Alert for callouts, Empty for empty states, Skeleton for loading,
  Separator for rules, Tooltip/Popover for info, Sheet/Dialog always with a Title, Tabs triggers inside TabsList,
  Button loading = Spinner + disabled (no isLoading prop). Icons in Buttons use data-icon, no size classes.
