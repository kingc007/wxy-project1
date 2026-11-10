---
type: guidance
source: Opus manager, 2026-10-30. User feedback: "not designed good enough, no ai slop. make it easier for humans to access visually."
applies_to: 1B Site Brief, 3A Massing Studio
builds_on: "[[Motion & Feel]]" (motion rules stay; this pass changes legibility, colour meaning and layout)
---
# Readability pass: "Marked-up set"

## What is wrong today (from full-res screenshots, 1440×900)
1. **Everything is grey on grey.** Ink-3 meta text at 12px, mono source lines, 1px hairlines everywhere. It reads as
   the generic "broadsheet hairline + mono labels" look, and it is hard on the eyes.
2. **Status has no colour.** Cited / Inferred / Unverified are told apart by a filled vs hollow 8px square. A reader
   has to decode each one. Nothing tells you *what needs your attention*.
3. **Long brief, no wayfinding.** 8 sections stacked; no index, no "what's left to review".
4. **Gimmicks.** The rotated red "DRAFT" stamp; the finished step rail keeps 70px of chrome after the work is done.
5. **3A icon-only tools.** The viewport toolbar is 8 unlabeled icons; "Export" is truncated to "Export E"; a purple
   "Read brief" button matches nothing; the same "confirm the program schedule" hint is shown twice.

## The idea
A reviewer's marked-up drawing set: the drawing is calm and black, and the reviewer's marks are in colour, and the
colour *means* something. Colour is reserved for status and action, never decoration. Every coloured mark also carries
a word and a shape, so it works for colour-blind readers and in print.

## Tokens (both apps, same values)
Light (default)
| token | hex | use |
|---|---|---|
| --paper | #F3F4F2 | app background (cool, not cream) |
| --sheet | #FFFFFF | memo / panels |
| --ink | #15191D | text |
| --ink-2 | #3D444B | secondary text (≥ 9:1 on sheet) |
| --ink-3 | #555D65 | meta text (≥ 6.5:1 on sheet) — never lighter than this for text |
| --rule | #D5D9D6 | hairlines |
| --signal | #1F3FBF | actions, links, citations (cobalt) |
| --ok | #17663F | Cited / verified / pass |   wash --ok-wash #E5F2EA |
| --warn | #8A5300 | Inferred / assumption / needs input | wash --warn-wash #FBF0DA |
| --flag | #B42318 | Flag / fails / unverified | wash --flag-wash #FCE9E7 |
Dark (graphite night) keeps existing paper/sheet/ink values; add --ok #6FD39C, --warn #F2B85B, --flag #FF9A80, washes at
~14% alpha of each. Check every text/bg pair ≥ 4.5:1 and write the computed ratios in STATUS.

Status vocabulary (one component, used everywhere): a pill = 6px-radius wash background + coloured text + icon.
- Cited → check-circle icon, --ok.  Inferred → half-circle/alert icon, --warn.  Unverified / Needs input → help-circle,
  --warn.  Flag / Fails → alert-triangle, --flag.  Computed → calculator icon, ink-2 on paper-2.

## Type
- Archivo stays (already loaded, variable width axis). **Display = Archivo at wdth 112–125, weight 650** (site address,
  option name, section headings) — the wide cut is the one memorable typographic move; it echoes title-block lettering.
- Body 15px / 1.5 (was 14). Meta 13px minimum (was 12). Table text 14px. Nothing below 12px anywhere, including tags.
- Mono (Plex Mono) only for literal codes: BBL, ZR section numbers, dataset versions. Not for dates or source prose.
- No all-caps labels, no " · " meta chains where a second line or a table cell reads better, no "WORD — fragment".

## Shape
- Controls, pills, inputs: 6px radius. Panels / sheets: 0 (they are paper). Buttons min height 40px, targets ≥ 40px.
- Primary action = solid --signal with white text. Secondary = 1px rule-strong outline. One primary per region.
- Disabled buttons: keep contrast ≥ 3:1 and always say *why* next to them once (never twice).

## Motion
Unchanged from [[Motion & Feel]]. Do not add new entrance animations.
