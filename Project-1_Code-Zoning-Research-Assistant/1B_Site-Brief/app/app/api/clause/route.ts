import { getSection } from "@/lib/zr/corpus";
import { locateQuote } from "@/lib/zr/locate";
import type { QuoteLocation, ZrSection } from "@/lib/zr/types";

/** GET /api/clause?id=23-22[&quote=...] -> { section, location? } */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id")?.trim() ?? "";
  if (!id) return Response.json({ error: "Missing ?id= (ZR section number, e.g. 23-22)" }, { status: 400 });
  const section = getSection(id);
  if (!section) return Response.json({ error: `No ZR section "${id}" in the ingested corpus.` }, { status: 404 });
  const quote = params.get("quote");
  const body: { section: ZrSection; location?: QuoteLocation } = { section };
  if (quote) body.location = locateQuote(section, quote);
  return Response.json(body);
}
