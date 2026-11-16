import { NextResponse } from "next/server";
import { rateLimited } from "@/server/auth";
import { factStore } from "@/server/store";

export const runtime = "nodejs";

const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "Cache-Control": "no-store" } });
const clean = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001F\u007F<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n) : "");

/**
 * A family member tells grandma a short detail ("I made aliyah in 1991"). It waits as a suggestion
 * until the site's owner checks it; only then do the answers use it.
 */
export async function POST(req: Request) {
  if (rateLimited(req, 10, 60 * 60 * 1000, "tell")) return json({ error: "rate" }, 429);
  const b = (await req.json().catch(() => ({}))) as { answer?: unknown; question?: unknown; by?: unknown; website?: unknown };
  if (clean(b.website, 100)) return json({ ok: true });
  const statement = clean(b.answer, 300);
  const by = clean(b.by, 80);
  if (statement.length < 3) return json({ error: "answer" }, 422);
  if (by.length < 2) return json({ error: "by" }, 422);
  const question = clean(b.question, 300) || undefined;
  const year = statement.match(/(?<!\d)(18[89]\d|19\d\d|20[0-2]\d)(?!\d)/g);
  await factStore.create(
    { statement, category: "other", year: year?.length === 1 ? Number(year[0]) : undefined, sources: [{ memoryId: "", kind: "family", quote: question, by }], by: "family" },
    [],
    "pending"
  );
  return json({ ok: true });
}
