import { IterateRequest } from "@/lib/ai/contracts";
import { describeError } from "@/lib/ai/errors";
import { json, pickMode, readBody } from "@/lib/ai/http";
import { buildResponse, checkChanges, iterateAi, iterateOffline } from "@/lib/ai/iterate";
import { loadModel } from "@/lib/ai/site";
import { DEFAULT_PARAMS, generateOption, validateParams } from "@wxy/massing";
import type { MassingParams } from "@wxy/massing";

export async function POST(req: Request) {
  const body = await readBody(req, IterateRequest);
  if (!body.ok) return body.response;
  const { envelope, schedule, assumptions, option, instruction, history, mode } = body.data;
  const loaded = await loadModel(envelope);
  if (!loaded.ok) return json({ error: loaded.message }, 400);
  const params: MassingParams = { ...DEFAULT_PARAMS, ...(option.params as Partial<MassingParams>) };
  const v = validateParams(params);
  if (!v.ok) return json({ error: `Invalid option parameters: ${v.errors.slice(0, 3).join("; ")}` }, 400);

  const pick = pickMode(mode);
  let changes;
  let usage = null;
  if (pick.client) {
    try {
      const current = generateOption(loaded.model, schedule, assumptions, params);
      const r = await iterateAi(pick.client, loaded.model, current, instruction, history ?? []);
      if ("error" in r) return json({ error: r.error }, 422);
      changes = r.changes;
      usage = r.usage;
    } catch (e) {
      const d = describeError(e);
      return json({ error: d.message }, d.status);
    }
  } else {
    const r = iterateOffline(instruction, loaded.model, params);
    if ("error" in r) return json({ error: r.error }, 422);
    const c = checkChanges(r, params);
    if (c.errors.length) return json({ error: c.errors.join("; ") }, 422);
    changes = c.changes;
  }
  const res = buildResponse(pick.client ? "ai" : "builtin", usage, changes, loaded.model, schedule, assumptions, params);
  if ("error" in res) return json({ error: res.error }, 422);
  return json({ ...res, ...(pick.notice ? { notice: pick.notice } : {}) });
}
