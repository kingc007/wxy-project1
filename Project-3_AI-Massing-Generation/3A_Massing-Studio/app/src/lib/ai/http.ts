// Small helpers shared by the route handlers.
import type { ZodType } from "zod";
import { formatZodError } from "@wxy/massing";
import { aiAvailable, getClient, type AiClient } from "./client";
import { NO_KEY_MESSAGE } from "./errors";
import type { Source } from "./contracts";

export const json = (body: unknown, status = 200): Response => Response.json(body, { status });

export async function readBody<T>(req: Request, schema: ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, response: json({ error: "The request body must be JSON." }, 400) };
  }
  const r = schema.safeParse(raw);
  if (!r.success) return { ok: false, response: json({ error: `Invalid request: ${formatZodError(r.error, 5)}` }, 400) };
  return { ok: true, data: r.data };
}

/** AI client for this request, or null (built-in) when the user chose built-in or no key exists. `notice` explains a forced fallback. */
export function pickMode(mode: Source | undefined): { client: AiClient | null; source: Source; notice?: string } {
  if (mode === "builtin") return { client: null, source: "builtin" };
  if (!aiAvailable()) return { client: null, source: "builtin", ...(mode === "ai" ? { notice: NO_KEY_MESSAGE } : {}) };
  const client = getClient();
  return { client, source: client ? "ai" : "builtin" };
}
