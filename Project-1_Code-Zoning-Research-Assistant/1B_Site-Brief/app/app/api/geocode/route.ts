import { autocomplete } from "@/lib/sources/geosearch";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ results: [] });
  try {
    return Response.json({ results: await autocomplete(q) });
  } catch (e) {
    return Response.json({ results: [], error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
