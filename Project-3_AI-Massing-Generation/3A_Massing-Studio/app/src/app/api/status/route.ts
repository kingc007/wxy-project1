import { connection } from "next/server";
import { MODELS, aiAvailable, costLimitUsd } from "@/lib/ai/client";

// Never returns the key; only whether one exists. connection() keeps this out of build-time prerendering.
export async function GET() {
  await connection();
  return Response.json({
    ai: aiAvailable(),
    models: { parse: MODELS.parse, strategy: MODELS.strategy, iterate: MODELS.iterate, intent: MODELS.intent, hard: MODELS.hard },
    costLimitUsd: costLimitUsd(),
  });
}
