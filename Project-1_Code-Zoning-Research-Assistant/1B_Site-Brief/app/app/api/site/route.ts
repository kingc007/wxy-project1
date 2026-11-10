import { getSiteData } from "@/lib/sources/site";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return Response.json({ error: "Missing ?q= (address or 10-digit BBL)" }, { status: 400 });
  return Response.json(await getSiteData(q));
}
