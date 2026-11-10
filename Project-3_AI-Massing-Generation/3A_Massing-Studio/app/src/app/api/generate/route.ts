import { GenerateRequest } from "@/lib/ai/contracts";
import { describeError } from "@/lib/ai/errors";
import { runGenerate } from "@/lib/ai/generate";
import { json, readBody } from "@/lib/ai/http";
import { loadModel } from "@/lib/ai/site";
import type { GenerateEvent } from "@/lib/ai/contracts";

export const maxDuration = 300;

// NDJSON stream: {type:"start"}, {type:"slot",...} per slot, {type:"done", totals}.
export async function POST(req: Request) {
  const body = await readBody(req, GenerateRequest);
  if (!body.ok) return body.response;
  const { envelope, schedule, assumptions, count, mode, thinkHarderSlot } = body.data;
  if (!schedule.confirmed) return json({ error: "Confirm the program schedule before generating." }, 400);
  const loaded = await loadModel(envelope);
  if (!loaded.ok) return json({ error: loaded.message }, 400);

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: GenerateEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        await runGenerate({ model: loaded.model, schedule, assumptions, count, mode: mode ?? "ai", thinkHarderSlot }, emit);
      } catch (e) {
        emit({ type: "error", message: describeError(e).message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
