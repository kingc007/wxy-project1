// /api/intent: one grounded line of design intent. AI text is checked against computed numbers; rejected twice -> built-in template.
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { allowedNumbersFromOption, checkGrounding } from "@wxy/massing";
import type { Assumptions, EnvelopeModel, MassingOption, ProgramSchedule } from "@wxy/massing";
import { MODELS, REQUEST_TIMEOUT_MS, type AiClient } from "./client";
import type { SlotUsage, Source } from "./contracts";
import { usageFromResponse, usdFor } from "./cost";
import { INTENT_SYSTEM_PROMPT } from "./prompts";
import { targetGfaOf } from "./fit";
import { targetAllowed, templateIntent } from "./intent";
import { contextAllowed, optionCounts } from "./site";

const IntentOut = z.object({ intent: z.string().min(1).max(160) }).strict();
export const UNGROUNDED_WARNING = "Couldn't write a grounded note; edit it yourself.";

export async function writeIntent(
  client: AiClient | null,
  model: EnvelopeModel,
  schedule: ProgramSchedule,
  assumptions: Assumptions,
  option: MassingOption,
): Promise<{ intent: string; source: Source; usage: SlotUsage | null; warning?: string }> {
  const fallback = templateIntent(option.typology, option);
  if (!client) return { intent: fallback, source: "builtin", usage: null };
  const allowed = allowedNumbersFromOption(option, [...contextAllowed(model, schedule, assumptions), ...optionCounts(option), ...targetAllowed(targetGfaOf(schedule, assumptions))]);
  const m = option.metrics;
  const facts = JSON.stringify({
    typology: option.typology,
    floors: m.floors,
    height_ft: Math.round(m.height * 10) / 10,
    gfa_sf: Math.round(m.gfa / 10) * 10,
    far: Math.round(m.far * 100) / 100,
    openSpacePct: Math.round(m.openSpacePct * 10) / 10,
    overall: option.overall.label,
  });
  const usage: SlotUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, usd: 0 };
  let rejected = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await client.messages.parse(
      {
        model: MODELS.intent,
        max_tokens: 1500,
        system: INTENT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Option facts (computed): ${facts}${rejected ? `\nYour last line used numbers that were not computed: ${rejected}. Rewrite without them.` : ""}` }],
        output_config: { format: zodOutputFormat(IntentOut), effort: "low" },
      },
      { timeout: REQUEST_TIMEOUT_MS },
    );
    const u = usageFromResponse(r.usage);
    usage.input += u.input;
    usage.output += u.output;
    usage.cacheRead += u.cacheRead;
    usage.cacheWrite += u.cacheWrite;
    usage.usd += usdFor(MODELS.intent, u);
    const out = r.parsed_output as z.infer<typeof IntentOut> | null;
    if (!out) continue;
    const g = checkGrounding(out.intent, allowed);
    if (g.ok) return { intent: out.intent, source: "ai", usage };
    rejected = g.unmatched.join(", ");
  }
  return { intent: fallback, source: "builtin", usage, warning: UNGROUNDED_WARNING };
}
