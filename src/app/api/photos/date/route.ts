import { NextResponse } from "next/server";
import { cleanDate } from "@/lib/photoDate";
import { rateLimited } from "@/server/auth";
import { store } from "@/server/store";

export const runtime = "nodejs";

/**
 * "Help us date it": anyone in the family can say roughly when a photo was taken,
 * but only for photos that have no date yet or only an automatic estimate.
 */
export async function POST(req: Request) {
  if (rateLimited(req, 60, 10 * 60 * 1000, "date")) return NextResponse.json({ error: "rate" }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { memoryId?: string; file?: string; year?: number; decade?: number };
  const date = b.year ? cleanDate({ year: b.year }, "user") : b.decade ? cleanDate({ from: b.decade, to: b.decade + 9 }, "user") : undefined;
  if (!b.memoryId || !b.file || !date) return NextResponse.json({ error: "invalid" }, { status: 422 });
  const m = await store.get(b.memoryId);
  const f = m?.files.find((x) => x.name === b.file);
  if (!m || m.status === "rejected" || !f) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (f.date && f.date.source !== "ai") return NextResponse.json({ error: "dated" }, { status: 409 });
  await store.update(m.id, (cur) => ({ ...cur, files: cur.files.map((x) => (x.name === f.name ? { ...x, date } : x)) }));
  return NextResponse.json({ ok: true, date });
}
