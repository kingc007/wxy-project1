import { getPermittedUses } from "@/lib/zr/uses";

/** GET /api/uses?district=R6&overlays=C1-4,C2-4 -> UseGroupSummary[] */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const district = params.get("district")?.trim() ?? "";
  if (!district) return Response.json({ error: "Missing ?district= (e.g. R6A)" }, { status: 400 });
  const overlays = (params.get("overlays") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return Response.json(getPermittedUses(district, overlays));
}
