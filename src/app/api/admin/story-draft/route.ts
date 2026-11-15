import { NextResponse } from "next/server";
import { profile } from "@/content";
import { isAdmin } from "@/server/auth";
import { chat, parseJson } from "@/server/ai";
import { factsOfDecade } from "@/server/knowledge";

export const runtime = "nodejs";

const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "Cache-Control": "no-store" } });

/**
 * A first draft of one decade of the life story, written ONLY from facts the owner verified.
 * It is never published by itself: it comes back to the editor, where the owner reads, changes
 * and saves it.
 */
export async function POST(req: Request) {
  if (!(await isAdmin(req))) return json({ error: "unauthorized" }, 401);
  const b = (await req.json().catch(() => ({}))) as { decade?: number };
  const decade = Number(b.decade);
  if (!Number.isInteger(decade) || decade % 10) return json({ error: "decade" }, 422);
  const facts = await factsOfDecade(decade, ["approved"]);
  if (!facts.length) return json({ error: "no-facts" }, 409);

  const list = facts.map((f, i) => `[${i + 1}]${f.year ? ` (${f.year})` : ""} ${f.statement}${f.place ? ` — ${f.place}` : ""}`).join("\n");
  const answer = await chat(
    "ask",
    [
      {
        role: "system",
        content: `You write one short chapter of a family memorial website about grandmother Rosa${profile.birthYear ? ` (born ${profile.birthYear})` : ""}, for the years ${decade}–${decade + 9}.
Use ONLY the numbered facts given. Do not add any detail, feeling, place, name or event that is not in them. If the facts are few, write little.
Warm, simple, respectful tone. Past tense, third person.
Reply with ONLY a JSON object:
{"title_he": "<a short title in Hebrew>", "text_he": "<1-2 short paragraphs in Hebrew>", "title_ru": "<the title in Russian>", "text_ru": "<the same text in Russian>"}`,
      },
      { role: "user", content: list },
    ],
    { maxTokens: 1400, temperature: 0.3 }
  );
  if (answer === null) return json({ error: "ai" }, 503);
  const d = parseJson<{ title_he?: string; text_he?: string; title_ru?: string; text_ru?: string }>(answer);
  if (!d?.text_he) return json({ error: "ai" }, 503);
  const s = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  return json({ title: s(d.title_he, 120), text: s(d.text_he, 2000), titleRu: s(d.title_ru, 120), textRu: s(d.text_ru, 2000), facts: facts.map((f) => ({ id: f.id, statement: f.statement, year: f.year })) });
}
