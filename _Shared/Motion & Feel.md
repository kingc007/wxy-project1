---
type: guidance
source: Opus manager, 2026-10-30. Distilled from motion.zajno.com (8 interface-motion techniques), the skills in
  ~/Downloads/Claude_Skills (frontend-design, apple-design, shadcn) and ~/.agents/skills/premium-frontend-ui.
applies_to: 1B Site Brief, 3A Massing Studio
supersedes: the "Motion" sections of Project-3/_manager/design-system.md and Project-1/shared/DESIGN-GUIDE.md
---
# Motion & feel: "Drafted, not printed"

## Why it reads robotic today
1. **Everything has equal weight.** Same 14px text, same 1px box, same panel rhythm everywhere. No focal point, no
   scale contrast. The eye has nowhere to land.
2. **State changes snap.** A brief appears all at once; a site loads with a jump-cut; selecting an option swaps
   panels. Nothing shows *what changed* or *where it came from* (Zajno: "animation unpacks the visual information").
3. **Machine voice.** Step timings in ms, "No Anthropic API key on the server. Add ANTHROPIC_API_KEY to .env.local",
   mono type on every number. The UI talks about its plumbing instead of the site.
4. **Empty states are notices**, not invitations. The first screen of both apps is a grey box with an instruction.
5. **Saturated navy dark theme by default** feels like a terminal, not a drawing table.

## The idea
An architect's drawing is *drafted*: lines are pulled, dimensions are struck, then labelled. Our UI should arrive the
same way. Every result is drawn on in the order a drafter would draw it — **hairline → extension ticks → value**.
This is the one memorable thing. Everything else gets quieter so it can land.

## Zajno's 8 techniques → where each one earns a place
Rule (frontend-design): motion only where it answers an action or shows what changed. No fade-up on every section,
no hover wobble on every card.

| Technique | Product moment | Spec |
|---|---|---|
| 1 Easing | Everywhere | Enter: `cubic-bezier(.22,1,.36,1)` (ease-out-quint) 420ms. Exit: `cubic-bezier(.64,0,.78,0)` 220ms (exits are faster). Direct manipulation & panels: spring `{type:"spring", bounce:0, duration:0.4}`. Never linear except progress strokes. |
| 2 Offset & delay | Results arriving | Siblings stagger 45ms (max 8 items, then the rest arrive together). Within one item: line first, then label 80ms later (follow-through). |
| 3 Fade | Text changes | Opacity + 6px y for text; opacity only for surfaces next to moving ones (Zajno: animate one with position, its neighbour with opacity only, so they read as separate). |
| 4 Transform & morph | Continuity between states | `layoutId` shared-element morphs: 1B the hero address field morphs into the header bar on submit; 3A a compare tile morphs into the focus stage and back. |
| 5 Masking | Headlines & drawings revealing | Site name / address title reveals line-by-line under a `clip-path: inset()` mask (text rises from behind a baseline). Map/3D panel opens with a clip-path wipe left→right, like a sheet being uncovered. |
| 6 Dimension | Floating tools | Viewer toolbar & popovers are a translucent material (blur 16px, 72% sheet, bright 1px top edge) and lift on open with scale .96→1 from their trigger origin. |
| 7 Parallax | 1B memo scroll only | The plan-grid backdrop moves at 0.4× scroll speed behind the sheet. Very subtle; off under reduced motion. No mouse parallax (this is a tool). |
| 8 Zoom | Arrival at a site | The one orchestrated moment per app. 1B: map flies from borough extent to the lot. 3A: camera eases in from a high wide orbit to the axon preset when a site loads; options "set down" after generating. |

Signature component — **DimensionString** (shared): a horizontal hairline with end ticks that draws from 0 to full
width (`scaleX` 0→1, origin left, 380ms ease-out), ticks pop in at 60% progress, then the value fades in above it and
the label below. Used for the hero numbers: 1B Key controls (FAR, ZFA, base, height, rear, coverage), 3A option metrics
(GFA, FAR used, height, floors). Staggered 45ms per string, driven by real data arriving (never a fake timer).

## Hierarchy & type (fixes #1, #3)
- **Scale contrast.** One display size per screen: site address / option name at `clamp(28px, 2.6vw, 44px)`,
  weight 600, tracking -0.025em, line-height 1.05. Hero values 28px tracking -0.02em. Body 14px. Meta 12px.
- **Numbers in the sans with tabular figures** (`font-variant-numeric: tabular-nums`), not mono. Mono is reserved for
  citation tags and IDs (ZR 23-22, BBL) — things that are literally codes.
- Fewer boxes. Group by whitespace (24/32px) and one hairline, not by a border around every item.

## Voice (fixes #3)
- No ms timings in the UI. Steps show state words ("Found", "Checking", "Done") — timings live in the dev panel.
- Plumbing messages (API keys, model names, fetch ms) move to the dev/usage drawer. The main UI says what the user gets:
  "Written from the zoning text — no AI narrative in this build." / "Built-in strategies".

## First screens (fixes #4)
- 1B: the address field *is* the hero — centred on the sheet, 22px type, one line of guidance, sample lots as a quiet
  list under it. On submit it morphs into the header bar (technique 4) and the step rail draws itself.
- 3A: the three sample sites shown as large hairline plan footprints (SVG drawn from the envelope's lot polygon, stroke
  drawing on via `pathLength`), each with its name and district. Click → zoom arrival (technique 8).

## Theme (fixes #5)
- Light "day sheet" is the designed default; dark stays available via the toggle and system preference.
- Dark becomes **graphite night**, not navy: paper #121417, sheet #181B1F, rule #2A2E34, ink #E8E6E1, ink-2 #A3A6AB,
  accent stays cobalt-light. Re-check contrast ≥ 4.5:1 for text tokens after the change.

## Craft floor (apple-design)
- Press feedback on pointer-down: `active:scale-[.98]` 100ms on buttons/rows.
- Interruptible: use `motion` springs/variants, never CSS keyframes for anything a user can trigger twice quickly.
  Panels enter and exit along the same edge.
- `prefers-reduced-motion: reduce` → every technique collapses to a ≤150ms opacity cross-fade; dimension strings
  render fully drawn; no parallax; camera/map jump instead of fly. Use `MotionConfig reducedMotion="user"` at the root
  plus `useReducedMotion()` for non-motion-component code (map, camera).
- `prefers-reduced-transparency` → solid materials.
- Only `transform`, `opacity`, `clip-path` animate. No width/height/top animations.

## Libraries — decided
- **motion 14.6.0 (`motion/react`)** is already installed in both apps → all of the above. Verified exports: `motion`,
  `AnimatePresence`, `LayoutGroup`, `MotionConfig`, `useReducedMotion`, `useScroll`, `useTransform`, `stagger`.
- **Not adding** Lenis (scroll smoothing hijacks the app's own scroll panes and fights screen readers — premium-frontend-ui
  targets landing pages, these are tools), GSAP (duplicates motion), custom cursors / magnetic buttons (tool, not
  showcase), noise overlays (muddy the hairlines that carry information).
