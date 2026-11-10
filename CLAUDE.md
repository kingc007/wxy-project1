# WXY Prototypes — Vault-wide rules

This folder is an Obsidian vault holding two projects for WXY Architecture + Urban Design. See [[Home]].

```
WXYArchitecture/                         (vault root)
├── Home.md                              map of content
├── _Shared/                             cross-project contracts + protocols
│   ├── Research Protocol.md             anti-hallucination rules (MANDATORY for research)
│   ├── ZoningEnvelope Contract.md       1B → 3A/3B/3C interface
│   └── schemas/zoning-envelope.schema.json   (canonical; owned by Project 1 / 1B)
├── Project-1_Code-Zoning-Research-Assistant/   (1A Clause, 1B Site Brief, 1C Precedent Radar)
└── Project-3_AI-Massing-Generation/            (3A Massing Studio, 3B GH Copilot, 3C Option Field)
```

Each prototype folder holds `PROMPT.md` (the spec — the source of truth), `STATUS.md` (progress log),
`research/` (verified research notes) and `app/` (all code lives here, never next to the notes).

## Team model: Opus manages, Sonnet/Haiku build

The main session (Opus) is the **manager / tech lead**. It:
- reads `PROMPT.md`, invokes the required skills itself (subagents may not have the Skill tool) and distils
  the relevant guidance into each delegated brief;
- plans the work, breaks it into self-contained tasks, and delegates them to subagents in `.claude/agents/`:
  - `researcher` (Sonnet) — web/API/docs research, under [[Research Protocol]]
  - `verifier` (Haiku) — independently re-checks every research claim against its source
  - `builder` (Sonnet) — implements features, tests, UI
  - `helper` (Haiku) — mechanical work: running tests/lint/typecheck, fixtures, file sweeps, data transforms
- reviews every diff a subagent returns, runs the tests itself, and decides what is accepted;
- does the hard reasoning itself (architecture, zoning interpretation, schema design, conflict resolution);
- keeps `STATUS.md` current and never reports something as working without having verified it.

The manager writes little production code directly — small glue fixes and review corrections only.
Run independent subagent tasks in parallel; never let two builders edit the same files at once.

## Zero-hallucination rules (apply to every agent)
1. **No facts from memory.** Zoning values, code sections, API endpoints, dataset IDs, library APIs, model
   IDs, Rhino/Grasshopper APIs, prices — anything factual — must come from a source fetched or read in this
   session (web page, official docs, the installed package's source/types, a skill). Memory may suggest
   *where to look*, never *what the answer is*.
2. **Every claim carries provenance**: URL or file path, retrieval date, and a verbatim quote (≤ 2 sentences)
   that supports it. No quote → not a fact.
3. **Say "NOT FOUND" / "UNVERIFIED" / "CONFLICTING"** instead of guessing. An honest gap beats a plausible value.
4. **Two-agent check**: research only becomes usable after `verifier` (a different agent) re-fetches the
   source and confirms the quote exists and supports the claim. Failed checks are removed or relabelled.
5. **Code against real APIs**: before using a library, read its installed types/README (in `node_modules`)
   or official docs. Never invent function signatures. If an API can't be confirmed, stop and report.
6. **Synthetic data is labelled SAMPLE**; simplified rules are labelled SIMPLIFIED. Never present either as real.
7. Subagents must report back exactly what they did, what they verified and how, and what they could not
   verify. The manager treats unverified subagent claims as unverified.

## Hygiene
- Secrets: `.env.local` only, `.env.example` committed, never print keys.
- Each prototype's `app/` is its own git repo (init on scaffold); commit at milestones.
