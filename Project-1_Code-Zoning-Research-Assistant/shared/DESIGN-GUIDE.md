---
type: guide
source: manager distillation of skills frontend-design, shadcn, apple-design, dataviz, ux-copy (2026-10-25)
applies_to: 1B, 1A, 1C
---
# WXY Project 1 design system: "Sheet set"

Concept: every screen is a sheet from a drawing set. The memo is a sheet with a title block. Citations are drawing
references. Values are dimension strings. The one memorable element is the **reference tag + leader line**: the
boxed clause tag that, when hovered, draws a hairline leader to its passage. Spend boldness there and keep everything
else quiet.

## Tokens (CSS custom properties on :root; Tailwind v4 `@theme inline` maps them)
| token | paper (light) | blueprint (dark) | use |
|---|---|---|---|
| --paper | #F5F3EE | #0F1E33 | page background (set explicitly on body) |
| --paper-2 | #ECE9E2 | #142842 | sunken panels, table header, title block fill |
| --ink | #1E2124 | #E6ECF3 | primary text, strong rules |
| --ink-2 | #4A4F55 | #B3C0CF | secondary text |
| --ink-3 | #62676D | #93A3B6 | muted text (must keep ≥4.5:1 on --paper; re-check) |
| --rule | #CFCBC2 | #2B4262 | 1px hairlines |
| --rule-strong | #7D7970 | #6680A3 | sheet border, title-block lines |
| --grid | rgb(30 33 36 / 0.045) | rgb(230 236 243 / 0.05) | plan grid, 8px minor / 64px major |
| --accent | #1F4E9E | #8FC1FF | **only** interactive state, focus ring, citation tags, links |
| --accent-wash | rgb(31 78 158 / 0.10) | rgb(143 193 255 / 0.14) | highlighted cited span |
| --flag | #8A3B12 | #F2B48A | review flags ONLY, always with an icon + label |

Dark mode is a selected "blueprint" theme, not an inversion. Apply it with `@media (prefers-color-scheme: dark)` under
`:root:not([data-theme="light"])` and with `:root[data-theme="dark"]`. A manual toggle in the header sets
`data-theme` and persists it in localStorage, wrapped in try/catch.
Radius: 0 on sheets and tables, 2px on controls and tags. No drop shadows, except a 1px offset hairline on floating
panels. No gradients.

## Type
- UI: **IBM Plex Sans** (400/500/600). Numbers, clause IDs and dimension strings: **IBM Plex Mono** (400/500), with
  `font-variant-numeric: tabular-nums`. Title-block labels: **IBM Plex Sans Condensed** 500, small caps at 11–12px,
  used only inside title blocks, which is drawing-set vernacular. Load all of them via `next/font/google`.
- Scale (rem): 0.75 / 0.8125 / 0.875 (body UI) / 1 (memo body) / 1.25 / 1.5 / 2. Use letter-spacing -0.01em at ≥1.5rem.
  Use line-height 1.55 for memo body and 1.3 for dense tables. Keep memo measure ≤ 72ch.
- No all-caps eyebrow labels above headings. No middle-dot meta strings. No "→" on buttons.
  Sheet numbers and section numbers are real sequences, so numbering them is fine.

## Signature components
- **RefTag**: inline boxed tag `[ZR 23-22]` in mono 12px, 1px accent border, 2px radius, padding 0 4px.
  On hover or focus it shows a preview card with the quote, section title and "Last amended 12/5/2024", and an SVG
  hairline leader line from the tag to the card. On click it opens the Source pane, scrolled to the span with the
  span highlighted in --accent-wash. It is keyboard reachable with a visible focus ring (2px accent outline, 2px offset).
- **ProvenanceTag** for data values: `PLUTO 26v2 · fetched 2026-10-25`, in mono 11px, --ink-3, no border, with the
  same hover card (dataset, field, raw value, URL).
- **Confidence mark**: shape plus label, never color alone, all in ink:
  Cited = filled square ■ "Cited"; Inferred = outlined square □ "Inferred"; Unverified = dashed outlined circle ◌
  "Unverified"; Conflicting = two offset outlined squares "Conflicting".
  Needs input = an empty dimension box with the label "Needs input".
- **Sheet**: 1px --rule-strong frame with a title block at the bottom right. The title block holds project/site,
  sheet title, sheet no. (e.g. Z-101), date, "Drawn: Site Brief (draft)", and "Checked: —" until a person marks it
  verified. Show a "DRAFT — for professional review" stamp as an outlined rotated box in --flag.
- **Step rail**: a horizontal sequence of steps (Locate → Lot data → Districts → Rules → Calculate → Review).
  Each step is a tick on a hairline. Its state is shown by shape: pending (hollow), running (hollow with an animated
  accent arc; static under reduced motion), done (filled ink), needs attention (flag icon). The elapsed time sits
  under each step in mono. The rail reports real progress only.

## Data viz (dataviz skill)
- Bulk table: Rule | Value | Applies because | Citation. Values are right-aligned mono tabular. Rows are 44px or
  taller with hairline separators. There are no colored cells.
- Meters (FAR used vs. max, coverage): a single-series horizontal bar, 6px tall, ink fill on a --paper-2 track,
  4px rounded end, with a direct value label in ink (never in the bar color) and a tooltip on hover/focus.
  Each meter carries one series, so no legend is needed.
- 1C matrix inline bars: same spec, on one shared scale per column, with the scale stated in the column header.
- Categorical color is not needed anywhere. If it ever is, run `dataviz/scripts/validate_palette.js` first.
- Every chart has a table equivalent or an aria-label summary.

## Motion (apple-design skill; Framer Motion / `motion`)
- Default spring: `{ type: "spring", bounce: 0, duration: 0.35 }`, critically damped.
- The Source pane slides in from the right and out to the right (symmetric) with `{ bounce: 0, duration: 0.4 }`.
  It is interruptible: always animate from the current value and never block input.
- Cited span highlight fades in over 180ms. Popovers originate from their trigger (transform-origin at the trigger).
- Give press feedback on pointer-down (scale 0.98, 100ms).
- `prefers-reduced-motion: reduce` replaces slides and springs with 150ms opacity cross-fades and disables the rail
  arc animation. Respect `prefers-contrast: more` with solid borders.
- Do not use per-section entrance animations or hover animations on every card.

## Layout
- 1440 is the reference width. At 1024 panes collapse: the Source pane becomes an overlay sheet. At 390 the layout
  is a single column with the map above the memo, and the Source pane opens as a full-height sheet.
- The plan-grid background goes on the page only, never behind text blocks (sheets are --paper and opaque).
- Focus is always visible. Hit targets are at least 24px (WCAG 2.2). Mouse and touch targets are 44px where possible.

## Copy deck (ux-copy skill), used verbatim across prototypes
- Confidence labels: **Cited** "Quoted directly from the source." · **Inferred** "Derived from more than one clause;
  check the reasoning." · **Unverified** "No source found for this. Treat as a lead, not a fact." ·
  **Conflicting** "Sources disagree. Both readings are shown."
- Needs input: "Needs input" with the tooltip "No source gives this value for this lot. Enter it or leave it open."
- Draft stamp: "DRAFT — for professional review". Footer disclaimer: "Draft research for a licensed professional to
  review. Not a zoning determination."
- Assumption actions: **Accept** / **Reject** / **Edit**. Override saved toast: "Override saved. Memo recalculated."
  Overridden mark tooltip: "Overridden. Source value: {v}."
- Mark verified: button "Mark verified", which then reads "Verified by {name} · {date}". Name prompt: "Your name or
  initials".
- Errors (what happened + how to fix):
  - Geocode: "No NYC tax lot found for “{q}”. Check the spelling or enter a 10-digit BBL."
  - Data source down: "Couldn’t reach {source}. Showing cached data from {date}." When there is no cache:
    "Couldn’t reach {source}. Try again in a minute."
  - LLM unavailable: "Narrative unavailable: no Anthropic API key is set. All values and calculations below still
    come from cited sources." (Rule values never depend on the LLM.)
  - Split lot: "This lot lies in more than one district. Each portion is shown separately; a professional must decide
    how the controls combine."
  - Unsupported district: "{district} isn’t in this prototype’s rule set yet. Values are left as Needs input."
- Empty state (1B input): "Enter an NYC address or BBL to draft a zoning brief." Example chips use the real eval lots.
- Loading narration describes real steps only, e.g. "Looking up the lot in PLUTO…".
