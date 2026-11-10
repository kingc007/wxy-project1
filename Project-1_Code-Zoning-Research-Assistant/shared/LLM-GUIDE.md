---
type: guide
source: claude-api skill (bundled 2.1.308, model table cached 2026-10-06) + https://platform.claude.com/docs/en/build-with-claude/citations.md (fetched 2026-10-25)
---
# LLM guide for Project 1 builders (distilled by the manager from the `claude-api` skill)

Builders: use ONLY these patterns. If you need something not here, stop and report.

## SDK + models
- Package `@anthropic-ai/sdk` (TypeScript). `import Anthropic from "@anthropic-ai/sdk"; const client = new Anthropic();`
  (reads `ANTHROPIC_API_KEY`). Zod helpers: `@anthropic-ai/sdk/helpers/zod` (`zodOutputFormat`),
  `@anthropic-ai/sdk/helpers/beta/zod` (`betaZodTool`). Confirm exports in `node_modules/@anthropic-ai/sdk` after install.
- Model IDs (exact strings, no date suffix): `claude-haiku-5-5` (extraction/rerank/classify),
  `claude-sonnet-5-5` (synthesis/agent), `claude-opus-5-5` (escalation / conflict resolution / eval grader).
- Prices $/MTok in/out: haiku 0.10/0.50, sonnet 2.00/10.00, opus 4.00/20.00. Cache reads: sonnet & opus 0.20.
  Use these for the cost estimate panel (label "list price, 2026-10-06").
- Thinking: do NOT send `budget_tokens` (400). Omit `thinking` or send `{type:"adaptive"}`. Opus 5.5 cannot disable thinking.
  Control depth with `output_config: { effort: "low"|"medium"|"high" }`. Use `low` for haiku extraction/rerank.
- Never send `temperature`, `top_p`, `top_k` (400 on API version 2026-10-21).
- No assistant prefill (400). Forced `tool_choice` `{type:"any"|"tool"}` returns 400 on sonnet-5-5/opus-5-5 — use `auto` + instruction + `strict: true`.
- Always check `stop_reason` (`end_turn`, `max_tokens`, `tool_use`, `pause_turn`, `refusal`) before reading content.
- Errors: catch `Anthropic.RateLimitError`, `Anthropic.AuthenticationError`, `Anthropic.BadRequestError`, then `Anthropic.APIError`.

## Basic / structured output
```ts
const r = await client.messages.parse({ model, max_tokens: 4000, output_config: { format: zodOutputFormat(Schema), effort: "low" }, messages });
r.parsed_output // null if parsing failed
```

## Citations (the core of 1A/1C; also memo prose in 1B)
- Pass each retrieved section as a **custom content document** so citations point at exact chunks:
```ts
{ type: "document",
  source: { type: "content", content: [ { type: "text", text: chunk1 }, { type: "text", text: chunk2 } ] },
  title: "ZR 23-22 — <title> (eff. <date>)",
  context: "metadata not citable (jurisdiction, version)",
  citations: { enabled: true },
  cache_control: { type: "ephemeral" } /* on static docs only */ }
```
- Plain text alternative: `source: { type: "text", media_type: "text/plain", data }` → `char_location` citations.
- Response: multiple `text` blocks; cited ones carry `citations[]`:
  - `{ type: "content_block_location", cited_text, document_index, document_title, start_block_index, end_block_index /* exclusive */ }`
  - `{ type: "char_location", cited_text, document_index, document_title, start_char_index, end_char_index /* exclusive */ }`
- Streaming: `content_block_delta` with `delta.type === "citations_delta"` carries `delta.citation` (append to current text block);
  `delta.type === "text_delta"` carries `delta.text`.
- **Citations are incompatible with structured outputs (`output_config.format`) → 400.** For structured cited answers,
  instruct a tagged plain-text layout (e.g. lines starting `[SHORT]`, `[RULE n]`, `[RELATED]`, `[ASSUMPTION]`, `[CONFLICT]`)
  and parse the text blocks + their citations in code. Then run the post-validator.
- `cited_text` is extracted by the API from our documents (guaranteed valid pointers) — still map `document_index` +
  block index back to our chunk ids in code and verify `cited_text` is a substring of the chunk.
- Never put a `text` block that has non-empty `citations` into a later `user` message (400). Strip citations when re-sending.

## Streaming
```ts
const stream = client.messages.stream({ model, max_tokens: 16000, system, messages });
for await (const ev of stream) { if (ev.type === "content_block_delta") { /* text_delta | citations_delta */ } }
const final = await stream.finalMessage();
```
Expose to the browser via a Next.js route handler returning an SSE `ReadableStream`.

## Tool use (1B agent)
Tool runner (beta): `client.beta.messages.toolRunner({ model, max_tokens, tools: [betaZodTool({ name, description, inputSchema: z.object(...), run })], messages })`.
Validate tool inputs; return errors as tool results. Manual loop alternative: `while (stop_reason === "tool_use")` append
assistant content, then ONE user message containing ALL `tool_result` blocks.

## Prompt caching
Top-level `cache_control: { type: "ephemeral" }` on `messages.create`, or per-block on the static system prompt / glossary /
static documents. Order: tools → system → messages; keep volatile content (dates, ids, question) after the cached prefix.
Verify via `usage.cache_read_input_tokens`. Small prefixes (< ~1–4k tokens) silently don't cache.

## Usage → cost
`usage.input_tokens`, `usage.output_tokens`, `usage.cache_creation_input_tokens`, `usage.cache_read_input_tokens`.
Cost = in×price_in + out×price_out + cache_read×cache_price + cache_write×1.25×price_in (per 1M).

## No-key mode
If `ANTHROPIC_API_KEY` is absent the apps must still run: deterministic paths only, LLM-dependent sections render
"LLM unavailable — set ANTHROPIC_API_KEY" (never fabricated text).
