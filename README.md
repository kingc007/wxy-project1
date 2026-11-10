# Zoning-to-Massing: AI prototypes for architecture + urban design

Two linked prototypes built for the kind of work WXY Architecture + Urban Design does. The first turns a
NYC address into a **cited zoning brief**. The second turns that brief into **compliant massing options**.

```
address ──► Site Brief (1B) ──► ZoningEnvelope (JSON) ──► Massing Studio (3A) ──► six options ──► Rhino .3dm
            cited zoning analysis   versioned contract       brief-to-massing         glTF / Grasshopper JSON
```

| Prototype | What it does | Folder |
|---|---|---|
| **1B Site Brief** | Geocodes an address, pulls PLUTO / MapPLUTO lot data, resolves zoning rules, computes buildable envelope numbers with the formula shown, and exports a sheet. Every value carries a citation or is flagged as inferred / manual-review. | `Project-1_Code-Zoning-Research-Assistant/1B_Site-Brief/` |
| **3A Massing Studio** | Takes a ZoningEnvelope plus a program brief and generates six massing options with live parameter sliders, an independent compliance check, sun/shadow analysis, and exports to Rhino (.3dm), glTF and Grasshopper JSON. | `Project-3_AI-Massing-Generation/3A_Massing-Studio/` |

Each prototype's `STATUS.md` is a dated log of what was built, how it was verified, and what is *not* verified.

## How the zoning data is kept honest

The rules table is built only from claims that a second agent re-fetched and confirmed against the source
(section, verbatim quote, amendment date). The LLM may *select* a rule but can never supply a number, and a
validator rejects any value not traceable to the rules table or a dataset field. See
[`_Shared/Research Protocol.md`](_Shared/Research%20Protocol.md) and the verification tallies in each
prototype's `research/` folder. Synthetic data is labelled SAMPLE; simplified rules are labelled SIMPLIFIED.

The two prototypes share one interface, [`_Shared/schemas/zoning-envelope.schema.json`](_Shared/schemas/zoning-envelope.schema.json)
(see [`ZoningEnvelope Contract.md`](_Shared/ZoningEnvelope%20Contract.md)).

## How it was built

An Opus session acted as manager and delegated to Sonnet/Haiku subagents (researcher, verifier, builder,
helper) under the rules in [`CLAUDE.md`](CLAUDE.md). The manager reviewed every diff and ran the tests itself.

## Running it

Each app is Next.js. Copy `.env.example` to `.env.local` in the app folder.

```bash
cd Project-1_Code-Zoning-Research-Assistant/1B_Site-Brief/app && npm install && npm run dev   # port 3101
cd Project-3_AI-Massing-Generation/3A_Massing-Studio/app     && npm install && npm run dev   # port 3301
```

**No API key needed.** Without `ANTHROPIC_API_KEY` both apps run in a deterministic built-in mode. Per the
status logs, the AI-assisted mode has not been exercised end to end, and neither has opening exports in Rhino.
Single-file builds of both apps (preloaded lots only) are in `_Shared/shareable-artifacts/`.

## Known limits

- NYC only; a limited set of districts (R5–R8A, some C1/C2/C4/M1 rules) is encoded. Special districts, landmarks
  and split lots are flagged for manual review rather than guessed.
- Prototype quality, not for real zoning determinations. Always verify against the current Zoning Resolution.
