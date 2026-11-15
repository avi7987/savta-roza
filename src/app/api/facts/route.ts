import { NextResponse } from "next/server";
import { factStore } from "@/server/store";

export const runtime = "nodejs";

/** Facts about Rosa's life that the site's owner verified, with where each one comes from. */
export async function GET() {
  const facts = (await factStore.list("approved")).map((f) => ({
    id: f.id,
    statement: f.statement,
    statementRu: f.statementRu,
    year: f.year,
    place: f.place,
    category: f.category,
    sources: f.sources.filter((s) => s.memoryId).map((s) => s.memoryId),
  }));
  return NextResponse.json({ facts }, { headers: { "Cache-Control": "no-cache" } });
}
