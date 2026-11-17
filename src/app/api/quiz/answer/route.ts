import { NextResponse } from "next/server";
import { rateLimited } from "@/server/auth";
import { dropOpen } from "@/server/quiz";
import { factStore } from "@/server/store";

export const runtime = "nodejs";

const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "Cache-Control": "no-store" } });
const clean = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001F\u007F<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n) : "");

/**
 * An answer to one of grandma's questions, in words. Like everything told directly, it waits as a
 * suggestion until the site's owner checks it; the question she could not answer is not asked again.
 */
export async function POST(req: Request) {
  if (rateLimited(req, 30, 60 * 60 * 1000, "quiz")) return json({ error: "rate" }, 429);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (clean(b.website, 100)) return json({ ok: true });
  const id = clean(b.id, 200);
  const question = clean(b.question, 300);
  const by = clean(b.by, 80);
  const personId = clean(b.personId, 80) || undefined;
  // answered with a recording (saved as a memory of its own): the question is only marked as answered
  if (b.recorded === true) {
    if (id.startsWith("a-")) await dropOpen(id);
    return json({ ok: true });
  }
  let statement = clean(b.answer, 600);
  if (b.kind === "born") {
    const year = Number(statement);
    if (!Number.isInteger(year) || year < 1850 || year > new Date().getFullYear()) return json({ error: "answer" }, 422);
    statement = `${clean(b.name, 80)}: ${year}`;
  }
  if (statement.length < 2) return json({ error: "answer" }, 422);
  if (by.length < 2) return json({ error: "by" }, 422);
  const year = b.kind === "born" ? Number(clean(b.answer, 4)) : statement.match(/(?<!\d)(18[89]\d|19\d\d|20[0-2]\d)(?!\d)/g)?.map(Number);
  await factStore.create(
    {
      statement: b.kind === "born" ? `${clean(b.name, 80)} ${b.gender === "f" ? "נולדה" : "נולד"} בשנת ${clean(b.answer, 4)}` : statement,
      category: b.kind === "born" ? "family" : "other",
      year: typeof year === "number" ? year : year?.length === 1 ? year[0] : undefined,
      people: personId ? [personId] : undefined,
      sources: [{ memoryId: "", kind: "family", quote: question || undefined, by }],
      by: "family",
    },
    [],
    "pending"
  );
  if (id.startsWith("a-")) await dropOpen(id);
  return json({ ok: true });
}
