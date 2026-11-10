---
type: project
project: Project 1
tags: [wxy, project-1]
---

# Project 1 — Code & Zoning Research Assistant

Back to [[Home]] · Shared context: [[Project 1 Base Block]] · Manager rules: [[Project-1_Code-Zoning-Research-Assistant/CLAUDE|CLAUDE]]

| # | Prototype | Pitch | Spec | Status |
|---|---|---|---|---|
| 1 | 1B Site Brief | Address/BBL → cited zoning memo + `ZoningEnvelope` JSON | [[Project-1_Code-Zoning-Research-Assistant/1B_Site-Brief/PROMPT\|PROMPT]] | [[Project-1_Code-Zoning-Research-Assistant/1B_Site-Brief/STATUS\|STATUS]] |
| 2 | 1A Clause | Plain-language code question → fully cited, verifiable answer | — | removed 2026-10-29 (scope cut to 1B; folder moved to Trash) |
| 3 | 1C Precedent Radar | Cross-jurisdiction cited comparison matrix + precedents | — | removed 2026-10-29 (scope cut to 1B; folder moved to Trash) |

**Team:** Opus manager (main chat) → `researcher` (Sonnet), `verifier` (Haiku), `builder` (Sonnet), `helper` (Haiku).
**Produces:** [[ZoningEnvelope Contract]] (consumed by Project 3).


> [!note] Scope decision 2026-10-29 (user): keep the best prototype, **1B Site Brief** (complete; see its STATUS.md). 1A Clause and 1C Precedent Radar were stopped mid-build and their folders moved to the macOS Trash. `shared/` (ZR corpus, verified rules tables, design/LLM guides, `shared/ui`) is kept because 1B uses it; `shared/ui` was extracted for 1A and is currently unused.
