---
type: critique
prototype: 3A
skill: design:design-critique
date: 2026-10-26
screens: start/site, program schedule, compare grid, focus + zoning table, A-001 board (screenshots at 1440×900, light)
---
# Design critique — Massing Studio (iteration 1)

## Overall impression
The sheet-and-chipboard language holds: quiet paper chrome, graphite rules, mono tabular numbers, and a zoning table
that reads like a drawing set. The biggest gap is the **missing first moment**. Until six options exist, the centre
stage is an empty paper field. The study model of the site and its envelope should be on the table from the moment a
site is picked. Second biggest: in focus view the **context out-shouts the proposal**.

## Usability
| Finding | Severity | Recommendation |
|---|---|---|
| Centre is empty after picking a site; the envelope and context aren't visible until generation | 🔴 | Show lot + translucent envelope + context in Focus as soon as a site loads (spec flow 1); empty-state copy moves to a small caption |
| Sun study toggle breaks the page layout; the sun panel is unreachable | 🔴 | Lock the shell to the viewport (internal scroll per column); dock the sun panel as a compact strip above the toolbar |
| Tiles 3 & 6 blank | 🔴 | Viewer fix (assigned) |
| A "Podium + tower" option that has no tower | 🔴 | Fitter preserves typology (assigned) |
| Tile titles truncate ("Option 1 · Podi…"); the status badge steals the title's width | 🟡 | Title on its own line (2-line clamp), status as a small word+icon line under the metrics |
| Site summary says "max FAR 6.50" — that's community facility, residential is 6.02 | 🟡 | "Residential FAR 6.02 · CF 6.50" (per use, never an unlabeled max) |
| No way to choose AI vs built-in, and no "Think harder" (spec: Opus on demand) | 🟡 | Header mode switch (disabled with a tooltip when no key) + "Think harder" in the option panel's ⋯ menu |
| Brief parser put the community facility on the "Ground floor" though the brief says "lower two floors" | 🟢 | Offline parser: "lower N floors" → placement lower, floors N |

## Visual hierarchy
- **Eye goes first to**: the dense grey context blocks (focus view). Wrong — it should be the white proposal.
  Fix: context at lower contrast (lighter fill, 0.5 px lighter edges, no AO darkening), proposal pure chipboard white
  with full graphite edges; envelope wireframe a touch lighter.
- **Reading flow**: left rail → generate → grid works. Right panel: the zoning table's Rule column wraps to 3–4 lines
  at 380 px, which makes the table tall and hard to scan.
- **Emphasis**: "SIMPLIFIED" tags on almost every row become noise. Replace them with a dagger mark (†) after the rule
  name and one legend line under the table ("† simplified rule — see notes"). Keep SAMPLE/UNVERIFIED tags.

## Consistency
| Element | Issue | Recommendation |
|---|---|---|
| Rule names | Long engine labels in tight places (tiles, boards) | Use `shortRule` in tiles/boards; full `rule` in the panel table with the short one as `title` |
| Assumption rows | "Default" tag repeated six times | One "Defaults — edit for your project" line; tag only values the user or brief changed |
| Disabled Generate | Reads as pale lavender — off-palette | Disabled = graphite at 40 % on paper, not tinted accent |
| Toolbar | Wraps and overlaps | One row; icon-only under ~900 px (assigned) |

## Accessibility
See `a11y-audit.md` (pass 1): textarea label, live announcements, file input name, sample-card accessible names,
theme toggle tab order, layout reflow on sun toggle.

## What works well
- The zoning table: Rule | Allowed | Proposed | Status, citations behind every Allowed value, "Not applicable" greyed,
  status as icon + word.
- The A-001 board: honest drawing-set sheet with title block, SAMPLE stamp and mini zoning tables.
- Copy: designer language throughout ("Podium height", "Step down toward"), honest notes ("Can't reach 120 units inside
  this envelope — closest is 53").
- Keyboard shortcuts listed in the footer; viewer has instructions and a text summary.

## Priority recommendations
1. **Put the site on the table immediately**: lot, envelope, context visible in the viewer once a site is chosen.
2. **Make the proposal the hero in focus view** by quieting the context.
3. **Fix the shell**: viewport-locked layout, sun strip, tile title layout, per-use FAR summary, dagger instead of
   SIMPLIFIED tags.

## Iteration log
- Iteration 1 fixes dispatched 2026-10-26 (engine labels + missing-FAR honesty row; fitter typology preservation;
  viewer tiles/toolbar/tones; UI items above). Re-review after fixes (manager, browser, 2026-10-26): site model on the table at selection ✓; six distinct
  options with readable titles and all tiles rendering ✓; masses read white chipboard against grey context ✓;
  per-use FAR summaries ✓; dagger legend ✓; sun strip docked, layout locked ✓. Remaining polish (not blocking):
  ~5 s first geometry load shows a blank stage — add a "Setting up the model…" caption; courtyard in Option 2 on
  sample C is small at the fitted ring depth (designer can widen it with the slider).
