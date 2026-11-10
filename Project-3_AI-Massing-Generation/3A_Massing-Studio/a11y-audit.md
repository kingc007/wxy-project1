---
type: audit
prototype: 3A
standard: WCAG 2.1 AA
auditor: Opus manager (design:accessibility-review skill)
date: 2026-10-26
---
# Accessibility audit — Massing Studio (pass 1, before fixes)

Method: manual browser review at 1440×900 (light), keyboard-only passes, programmatic DOM checks (accessible names,
labels, landmarks, headings, live regions, target sizes) in the page. An automated axe run was not possible: loading
axe-core from a CDN into the page was blocked by this environment's safety policy. Token contrast was computed by the
manager (WCAG relative luminance formula) for every text/background pair in the design tokens.

## Summary (pass 1)
Issues: 9 — Critical 1 · Major 5 · Minor 3

| # | Issue | WCAG | Severity | Fix |
|---|---|---|---|---|
| 1 | Brief textarea's accessible name is its placeholder; the visible "Project brief" label isn't associated | 3.3.2 / 4.1.2 | Major | `<label for>` / FieldLabel htmlFor |
| 2 | Hidden file input (`#envelope-file`) has no name (the visible button is fine, but the input itself is announced unnamed when reached) | 4.1.2 | Minor | aria-label "Load envelope JSON file" |
| 3 | Live regions exist but announced nothing after generation or option selection (observed empty) | 4.1.3 | Major | announce "6 options ready: 5 pass, 1 needs review"; on param change "FAR 3.92 of 4.00, passes" |
| 4 | Sun study toggle broke layout (document grew to 2,140 px; sun panel not reachable) | 2.1.1 / 1.4.10 | Critical | fix panel + lock shell to viewport with internal scroll |
| 5 | Compare tiles 3 & 6 render blank → visual info missing (text alternative exists in tiles) | 1.1.1 (partial) | Major | viewer fix (assigned) |
| 6 | Toolbar labels overlap when wrapped | 1.4.10 / 1.4.4 | Major | one-row toolbar, icon-only + tooltip when narrow (assigned) |
| 7 | Site sample SR text reads "R8A · corner lot · sf" — the number sits in an element excluded from the name | 1.3.1 | Major | include area in the accessible name |
| 8 | Tile titles truncate ("Option 1 · Podi…") with no full name available on hover/focus | 1.3.1 / 2.4.6 | Minor | wrap or full name in title/tooltip; status badge on own line |
| 9 | Theme toggle is the first tab stop before the stepper | 2.4.3 | Minor | move after main content or into footer |

## Passed checks
- Landmarks: header, main, nav "Project setup", aside "Option details", footer. `lang="en"`. One H1, step H2s.
- Visible focus: cobalt 2 px ring/border on cards and buttons (ring colour #2E46C9 on paper = 6.79:1).
- Zoning table is a real `<table>` with caption text and header cells; status shown as icon + word ("✓ Passes", "Not applicable").
- 3D viewer: focusable, `role="application"` with an aria-label and instructions ("Arrow keys orbit 15 degrees…"),
  an aria-describedby summary ("Option 1 · Podium + tower, 6 floors, 65.0 ft. Passes all rules. Full numbers are in the
  zoning table…") — non-visual metric access is the zoning table + program fit table.
- Keyboard shortcuts 1–6 / C / S / E / ⌘Z documented in the footer.

## Colour contrast (tokens)
| Element | FG | BG | Ratio | Req | Pass |
|---|---|---|---|---|---|
| Body text | #22252A | #F6F5F1 | 14.09 | 4.5 | ✅ |
| Secondary text | #5C6068 | #F6F5F1 | 5.78 | 4.5 | ✅ |
| Accent / focus | #2E46C9 | #F6F5F1 | 6.79 | 3.0 | ✅ |
| Fail text | #B3261E | #FFFFFF | 6.54 | 4.5 | ✅ |
| Review text | #8A5A00 | #FFFFFF | 5.93 | 4.5 | ✅ |
| Dark secondary | #A4A6AB | #1E2125 | 6.63 | 4.5 | ✅ |
| Dark accent | #8C9CFF | #1E2125 | 6.40 | 3.0 | ✅ |
| Dark fail / review | #FF8A80 / #F0B74A | #1E2125 | 7.08 / 8.91 | 4.5 | ✅ |
| Program colours (diagram) | orange #eb6834, aqua #1baf7a | #F6F5F1 | 2.93 / 2.58 | 3.0 (graphics) | ⚠ relief rule: labels + hatch + table view present |

## Pass 2 (after iteration-1 fixes, 2026-10-26, manager re-check in the browser at 1440×900 light)
| # | Status | Evidence |
|---|---|---|
| 1 | ✅ Fixed | textarea `labels[0]` = "Project brief" (DOM check) |
| 2 | ✅ Fixed | file input aria-label "Load envelope JSON file" |
| 3 | ✅ Fixed | live region read: "6 options ready: 0 pass, 6 need review, 0 fail"; on select "Option 1, Podium + tower, FAR 6.30 of 10.00, needs review"; builder verified param-change announcement (500 ms debounce) |
| 4 | ✅ Fixed | with sun on: `scrollHeight` 900 = viewport; sun strip visible with presets, scrubber, "Courtyard sun: 4.8 h on Jun 21" |
| 5 | ✅ Fixed | all six compare tiles render (screenshot) — root cause drei View culling offset canvases; custom tile viewports + regression test |
| 6 | ✅ Fixed | toolbar one row, icon-only under 900 px container with tooltips + aria-labels |
| 7 | ✅ Fixed | sample card names e.g. "Corner lot, sample site, R8A, corner lot, 10,000 square feet, Residential FAR 6.02 · CF 6.50" |
| 8 | ✅ Fixed | tile titles on their own line, 2-line clamp, full name in `title` |
| 9 | ✅ Fixed | theme toggle moved to footer; first tab stops: mode switch → stepper → site cards |

Remaining known limitations (documented, not blocking AA for this prototype):
- No automated axe run (CDN injection blocked by the environment); recommend `@axe-core/playwright` in CI.
- No screen-reader session (VoiceOver/NVDA) performed — only DOM-level name/role/live checks.
- 200 % zoom reflow not tested.
- Mobile (< 768 px) is view-only by design (spec).
