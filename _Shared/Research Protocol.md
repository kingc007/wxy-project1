---
type: protocol
tags: [wxy, research, protocol]
---

# Research Protocol (anti-hallucination)

Applies to the `researcher` and `verifier` agents and to anything the manager researches itself.
Back to [[Home]].

## Researcher (Sonnet) must
1. Use only primary/official sources where they exist: NYC DCP (Zoning Resolution, zoning GIS), NYC Open Data
   (Socrata), NYC DOB / Building Code, official city planning sites, official library docs / GitHub repos,
   McNeel developer docs, Anthropic docs. Secondary sources only when no primary exists — label them.
2. Actually fetch every source it cites (WebFetch / reading the file). Search-result snippets are not sources.
3. Record each finding as a row in the claim table below. One claim per row. Quote verbatim.
4. Record effective date / version / release for every regulatory or dataset source.
5. Write **NOT FOUND** when a search fails, **CONFLICTING** when sources disagree (list both), and
   **UNVERIFIED** when a value is plausible but no fetched source states it. Never fill a gap.
6. Never paraphrase a number. Copy it exactly as the source states it, with units.
7. Save the note to `<prototype>/research/<topic>.md` (or `_Shared/research/` for cross-project topics).

## Verifier (Haiku) must
1. Re-fetch each source URL independently (do not trust the researcher's quote).
2. Confirm the quote appears (allowing whitespace/formatting differences) and that it supports the claim.
3. Set `Verified` to `PASS`, `FAIL (quote not found)`, `FAIL (does not support claim)` or `UNREACHABLE`.
4. Add a `verified_by: verifier` and date to the note frontmatter. It may not add new claims.

## Note template
```markdown
---
type: research
topic: <topic>
prototype: <1A|1B|…|shared>
researched: YYYY-MM-DD
verified_by: (pending)
---
# <Topic>

## Question
<what the manager asked>

## Claims
| # | Claim | Source (URL / file) | Version / effective date | Verbatim quote | Status | Verified |
|---|-------|--------------------|--------------------------|----------------|--------|----------|
| 1 | … | … | … | "…" | CITED | (pending) |

## Not found / open questions
- …

## Conflicts
- …
```

## Manager rule
Code, seed data, eval gold answers and sample envelopes may only use claims with `Verified = PASS`.
Anything else is labelled UNVERIFIED in the product (or left out).
