---
type: moc
tags: [wxy, home]
---

# WXY Architecture + Urban Design — AI Prototypes

Two projects, three prototypes each. Each project is built in its own Claude Code chat, with Opus as the
manager and Sonnet / Haiku subagents as researchers and builders. Rules: [[CLAUDE]] · [[Research Protocol]].

## Start here
Double-click **Start WXY Apps.command** (Mac) or **Start WXY Apps.bat** (Windows, untested). Site Brief opens at
http://localhost:3101 and Massing Studio at http://localhost:3301.
- [[How to use Site Brief]]: address → cited zoning brief → PDF sheet, or **Open in Massing**
- [[How to use Massing Studio]]: envelope + brief → six options → Rhino .3dm
- Shareable full apps (no install, preloaded lots only): [Site Brief](https://claude.ai/artifact/KyaKDC5K2ZsRLDkRvV89Aw) ·
  [Massing Studio](https://claude.ai/artifact/USAjpXT4MA6MNXmkeYCCDG). See `_Shared/shareable-artifacts/README.md`.

## Project 1 — Code & Zoning Research Assistant
[[Project 1 Overview]] · [[Project 1 Base Block]]

| Order | Prototype | Spec | Status |
|---|---|---|---|
| 1 | **1B Site Brief**: cited zoning analysis from an address | [[Project-1_Code-Zoning-Research-Assistant/1B_Site-Brief/PROMPT\|PROMPT]] | [[Project-1_Code-Zoning-Research-Assistant/1B_Site-Brief/STATUS\|STATUS]] |
| 2 | **1A Clause**: cited code research workspace | — | removed 2026-10-29 (scope cut to 1B; folder moved to Trash) |
| 3 | **1C Precedent Radar**: cross-jurisdiction comparison | — | removed 2026-10-29 (scope cut to 1B; folder moved to Trash) |

## Project 3 — AI-Assisted Massing Generation
[[Project 3 Overview]] · [[Project 3 Base Block]]

| Order | Prototype | Spec | Status |
|---|---|---|---|
| 1 | **3A Massing Studio**: brief-to-massing in the browser | [[Project-3_AI-Massing-Generation/3A_Massing-Studio/PROMPT\|PROMPT]] | [[Project-3_AI-Massing-Generation/3A_Massing-Studio/STATUS\|STATUS]] |

## Cross-project
- [[ZoningEnvelope Contract]]: the 1B output is the input to every Project 3 prototype.
- Suggested overall order: 1B → 3A. (Project 1 scope cut to 1B and Project 3 scope cut to 3A on 2026-10-29; 3B and 3C were deleted at the user's request.)
