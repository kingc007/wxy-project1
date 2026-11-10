import { parseBriefAi, parseBriefOffline } from "@/lib/ai/brief";
import { ParseBriefRequest } from "@/lib/ai/contracts";
import { describeError } from "@/lib/ai/errors";
import { json, pickMode, readBody } from "@/lib/ai/http";

export async function POST(req: Request) {
  const body = await readBody(req, ParseBriefRequest);
  if (!body.ok) return body.response;
  const { brief, envelopeSummary, mode } = body.data;
  const pick = pickMode(mode);
  if (pick.client) {
    try {
      const r = await parseBriefAi(pick.client, brief, envelopeSummary);
      if (!("error" in r)) return json({ source: "ai", ...r.parsed, usage: r.usage });
      return json({ source: "builtin", ...parseBriefOffline(brief), usage: null, warning: r.error });
    } catch (e) {
      const d = describeError(e);
      return json({ source: "builtin", ...parseBriefOffline(brief), usage: null, warning: d.message });
    }
  }
  return json({ source: "builtin", ...parseBriefOffline(brief), usage: null, ...(pick.notice ? { warning: pick.notice } : {}) });
}
