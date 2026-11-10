// In-browser replacement for the Next.js server: same-origin /api/* requests are answered by the app's real route
// handlers (src/app/api/*/route.ts), imported as modules. Responses (including the NDJSON stream) are real Response objects.
import * as status from "@/app/api/status/route";
import * as parseBrief from "@/app/api/parse-brief/route";
import * as generate from "@/app/api/generate/route";
import * as iterate from "@/app/api/iterate/route";
import * as intent from "@/app/api/intent/route";

type Handler = (req: Request) => Response | Promise<Response>;
const ROUTES: Record<string, Partial<Record<"GET" | "POST", Handler>>> = {
  "/api/status": { GET: status.GET as Handler },
  "/api/parse-brief": { POST: parseBrief.POST as Handler },
  "/api/generate": { POST: generate.POST as Handler },
  "/api/iterate": { POST: iterate.POST as Handler },
  "/api/intent": { POST: intent.POST as Handler },
};

// Relative URLs cannot be resolved in a null-origin / srcdoc frame, so Requests are built on a placeholder origin.
// It is never fetched: the handler is called directly.
const BASE = "http://studio.invalid";

export function installFetchRouter(): void {
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const isApi = raw.startsWith("/api/") || raw.startsWith(`${location.origin}/api/`);
    if (!isApi) return original(input, init);
    const path = new URL(raw, BASE).pathname;
    const route = ROUTES[path];
    const method = (init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase() as "GET" | "POST";
    const handler = route?.[method];
    if (!handler) return Response.json({ error: `No route ${method} ${path}` }, { status: route ? 405 : 404 });
    const req = typeof input === "object" && "url" in input && !(input instanceof URL) ? new Request(input, init) : new Request(`${BASE}${path}`, init);
    return handler(req);
  };
}
