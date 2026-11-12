import { NextResponse } from "next/server";
import { isPhash, isSha } from "@/lib/dedupe";
import { rateLimited } from "@/server/auth";
import { findDuplicates } from "@/server/dupes";

export const runtime = "nodejs";

/** Before uploading: which of these photos are already on the site? Answers only exact/similar and approved/pending. */
export async function POST(req: Request) {
  if (rateLimited(req, 120, 10 * 60 * 1000, "check")) return NextResponse.json({ error: "rate" }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { items?: { sha?: string; phash?: string }[] };
  const items = (body.items ?? []).slice(0, 20).map((i) => ({ sha: isSha(i.sha) ? i.sha : undefined, phash: isPhash(i.phash) ? i.phash : undefined }));
  const hits = await findDuplicates(items);
  return NextResponse.json({ results: hits.map((h) => (h ? { match: h.match, status: h.status } : null)) }, { headers: { "Cache-Control": "no-store" } });
}
