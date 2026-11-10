import { IntentRequest } from "@/lib/ai/contracts";
import { describeError } from "@/lib/ai/errors";
import { json, pickMode, readBody } from "@/lib/ai/http";
import { writeIntent } from "@/lib/ai/intent-ai";
import { loadModel } from "@/lib/ai/site";
import { DEFAULT_PARAMS, generateOption, validateParams } from "@wxy/massing";
import type { MassingParams } from "@wxy/massing";

export async function POST(req: Request) {
  const body = await readBody(req, IntentRequest);
  if (!body.ok) return body.response;
  const { envelope, schedule, assumptions, option, mode } = body.data;
  const loaded = await loadModel(envelope);
  if (!loaded.ok) return json({ error: loaded.message }, 400);
  const params: MassingParams = { ...DEFAULT_PARAMS, ...(option.params as Partial<MassingParams>) };
  const v = validateParams(params);
  if (!v.ok) return json({ error: `Invalid option parameters: ${v.errors.slice(0, 3).join("; ")}` }, 400);
  const pick = pickMode(mode);
  try {
    const o = generateOption(loaded.model, schedule, assumptions, params);
    const r = await writeIntent(pick.client, loaded.model, schedule, assumptions, o);
    return json({ ...r, ...(pick.notice ? { notice: pick.notice } : {}) });
  } catch (e) {
    const d = describeError(e);
    return json({ error: d.message }, d.status);
  }
}
