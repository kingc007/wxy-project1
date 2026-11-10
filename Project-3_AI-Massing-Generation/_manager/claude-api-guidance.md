---
type: guidance
source: claude-api skill (bundled 2.1.308, model table cached 2026-10-06), read 2026-10-25 by Opus manager
---
# Claude API guidance for Project 3 builders (distilled from the `claude-api` skill)

Package: `@anthropic-ai/sdk` (TypeScript). `import Anthropic from "@anthropic-ai/sdk"; const client = new Anthropic();`
(reads ANTHROPIC_API_KEY from env). Server-side only (Next.js route handlers) — never in client bundles.

## Models (exact IDs, no date suffix) and $/1M tokens
| Route | Model ID | Input | Output | Cache read |
|---|---|---|---|---|
| parse / validate / label | `claude-haiku-5-5` | 0.10 | 0.50 | not stated in skill → treat as UNVERIFIED, use input rate in cost estimate |
| strategy generation, critique, vision | `claude-sonnet-5-5` | 2.00 | 10.00 | 0.20 |
| hard multi-constraint / "Push further" (on demand only) | `claude-opus-5-5` | 4.00 | 20.00 | 0.20 |
Cache writes: 1.25x input (5-min TTL). Haiku price applies to prompts ≤100K tokens.

## Hard rules (requests that break these return HTTP 400)
- NO `temperature`, `top_p`, `top_k` on any model (API version 2026-10-21 rejects them). Diversity must come
  from the prompt + deterministic diversity enforcement in code, not sampling params.
- NO forced `tool_choice` (`{type:"any"}` / `{type:"tool"}`) on sonnet-5-5 / opus-5-5. Use default `auto`,
  name the tool in the prompt, set `strict: true` on tool definitions (schema needs `additionalProperties:false`
  + `required`), and re-prompt if no tool_use came back.
- NO `thinking: {type:"disabled"}` and NO `budget_tokens`. Omit `thinking` (adaptive by default) and control
  depth with `output_config: { effort: "low"|"medium"|"high" }`. Use `low` for haiku parsing, `medium` for sonnet.
- NO assistant prefill (last message must not be assistant).
- Always check `response.stop_reason` before reading content: handle `"refusal"` (read `stop_details`),
  `"max_tokens"`, `"tool_use"`, `"end_turn"`, `"pause_turn"`.

## Patterns
- Structured output (preferred for parse/label/critique):
  ```ts
  import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
  const r = await client.messages.parse({ model, max_tokens, messages, output_config: { format: zodOutputFormat(Schema), effort: "low" } });
  const out = r.parsed_output; // null if parse failed → treat as error
  ```
- Tool loop (strategy agent): manual loop with `client.messages.create({ model, max_tokens, system, tools, messages })`;
  while `stop_reason === "tool_use"`: push `{role:"assistant", content: response.content}`, execute every
  `tool_use` block (types: `Anthropic.ToolUseBlock`), return ALL `tool_result` blocks in ONE user message
  (`Anthropic.ToolResultBlockParam`, `is_error: true` on failures). Cap iterations in code.
  Parse tool inputs as objects (`block.input`), validate with Zod before use; never string-match JSON.
- Prompt caching: `system: [{ type: "text", text: STABLE_SYSTEM_PLUS_TYPOLOGY_LIBRARY, cache_control: { type: "ephemeral" } }]`.
  Min cacheable prefix 512 tokens on these models. Keep the cached prefix byte-stable: no timestamps/IDs, deterministic
  tool order, sorted JSON. Verify with `usage.cache_read_input_tokens`.
- Vision: content block `{ type: "image", source: { type: "base64", media_type: "image/png", data } }` placed before the text block.
- Usage/cost: `response.usage.input_tokens`, `.output_tokens`, `.cache_creation_input_tokens`, `.cache_read_input_tokens`.
- Errors: typed classes `Anthropic.RateLimitError`, `Anthropic.AuthenticationError`, `Anthropic.BadRequestError`,
  `Anthropic.APIError` (most specific first). SDK retries 2x by default; set a per-request `timeout` (ms in TS).
- Refusal fallback (sonnet-5-5 on Claude API): optional `client.beta.messages.create({ ..., betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })`. We keep it OFF by default in these prototypes (simplicity) — documented decision.
- Use SDK types (`Anthropic.MessageParam`, `Anthropic.Tool`, `Anthropic.Message`); don't redefine them.
