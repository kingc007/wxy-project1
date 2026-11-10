---
type: review
prototype: 1B
date: 2026-10-26
by: manager (Opus) — design:accessibility-review + design:design-critique skills
---
# 1B Site Brief: accessibility audit and design critique (round 1)

## Accessibility audit (WCAG 2.1 AA)
**Method:** axe-core 4.14 through Playwright (`e2e/a11y.spec.ts`), covering 6 states × light/dark at 1440×900. The manager computed token contrast in Python using the WCAG formula. The manager checked keyboard focus in the browser pane on a production build. Screen-reader semantics were reviewed through the accessibility tree (read_page).

**Summary:** axe found 0 violations in all 12 state/theme runs, with 24–35 passing rules per run. Axe could not decide colour contrast ("incomplete"), so the manager computed it directly.

| # | Issue | WCAG | Severity | Fix |
|---|---|---|---|---|
| A1 | Input, toggle and button borders used `--rule-strong`, which measured 2.84:1 on `--paper-2` in light mode | 1.4.11 | Major | **Fixed:** darkened to #7D7970 (3.58:1) and, in dark mode, to #6680A3 (3.67:1) |
| A2 | The focus indicator is a 3px ring at 50% opacity, which is faint on the blueprint background. The tab-order heuristic flagged 10 stops with no outline | 2.4.7 | Major | Add a global `:focus-visible` rule: 2px solid `--signal` outline with a 2px offset, as the design guide specifies |
| A3 | Small all-caps labels such as "INTENDED USE" and "SITE VIEW" are about 10px | 1.4.4 (readability) | Minor | Set them in sentence case at 12px or larger |

**Contrast (manager-computed):**

| Pair | Light | Dark |
|---|---|---|
| Ink on paper | 14.59 | 14.08 |
| Ink-2 on paper | 7.45 | 9.06 |
| Ink-3 on paper | 5.15 | 6.50 |
| Ink-3 on paper-2 | 4.71 | 5.78 |
| Signal on paper | 7.17 | 8.96 |
| Flag on paper | 6.98 | 9.31 |

All text pairs pass 4.5:1.

## Design critique
**Overall:** the drawing-set language works. The paper and blueprint themes, mono figures, boxed RefTags with the source pane, provenance lines under every value, the title block and the DRAFT stamp all read as an architect's document, not a chatbot. The PDF sheet is the strongest artefact. The biggest opportunity is the memo's information density: a reviewer has to scroll past about 40 use-group rows to reach the bulk table, which is the core job.

| Finding | Severity | Recommendation |
|---|---|---|
| C1 The use-group section has one 10-row table for each district column (four tables on overlay or split lots) and dominates the memo | High | Show one compact matrix: rows are UG I–X, columns are the district columns, cells are a status shape plus label. Put examples and counts behind a disclosure per cell |
| C2 Every bulk row on a split lot reads "Manual — professional analysis", which hides the per-portion values the engine already computed | High | On split lots, show per-portion columns (e.g. R7A 75% │ R8B 25%) plus a "Combined" column (77-22 area-weighted FAR where computed; Manual otherwise) |
| C3 There are no key numbers at the top; the first screen is lot facts | Medium | Add a "Key controls" strip under the sheet title: Max FAR, Max ZFA, Base height, Max height, Rear yard, Coverage. Use mono dimension strings, each with a ConfidenceMark, and make each one jump to its bulk row |
| C4 The map scrolls away while the memo is read | Medium | Make the left map panel `position: sticky` |
| C5 Engine row labels such as "Setback street-setback-edge4 — start height" and "setbacks-manual-split" | Medium | Use human labels, e.g. "Street setback (Attorney Street, narrow) — start height" |
| C6 All-caps micro-labels are used outside title blocks (filter labels, panel labels, table headers), which goes against the design guide | Low | Use sentence case; keep small caps only inside title blocks |
| C7 "Mark verified" buttons on every row are visually loud | Low | Use a quieter tertiary style that keeps a visible label |
| C8 The sheet date can differ from the fetch dates (PDF: "2026-10-25" against "fetched 2026-10-26") | Low | Use a single local-date source for the generation date |

**What works:** RefTag → source pane with a highlighted table row, which makes verification fast. Provenance is printed under every value. The step rail shows real timings. The assumptions ledger lets the reviewer accept, reject or edit each assumption. The empty state teaches by example lots.

## Round 1 outcome
(Filled in after the fixes land.)
