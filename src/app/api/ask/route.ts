import { NextResponse } from "next/server";
import { profile } from "@/content";
import { rateLimited } from "@/server/auth";
import { budgetLeft, chat } from "@/server/ai";
import { familySummary } from "@/server/familyFacts";
import { nearest } from "@/server/semantic";
import { factStore, store } from "@/server/store";

export const runtime = "nodejs";

const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "Cache-Control": "no-store" } });

/**
 * A family member's question about Rosa, answered only from what is on the site: the closest
 * pieces of the archive are found by meaning, and the model may use nothing else. Every answer
 * comes with the sources it used; when the site does not know, it says so.
 */
export async function POST(req: Request) {
  if (rateLimited(req, 15, 10 * 60 * 1000, "ask")) return json({ error: "rate" }, 429);
  const b = (await req.json().catch(() => ({}))) as { q?: string; lang?: string };
  const q = typeof b.q === "string" ? b.q.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, 300) : "";
  const lang = b.lang === "ru" ? "ru" : "he";
  if (q.length < 3) return json({ error: "question" }, 422);
  if ((await budgetLeft("ask")) <= 0) return json({ error: "tired" }, 503);

  const hits = await nearest(q, 8);
  if (hits === null) return json({ error: "unavailable" }, 503);

  // what each source is, for the cards under the answer
  const memories = new Map((await store.list()).filter((m) => m.status !== "rejected").map((m) => [m.id, m]));
  const facts = new Map((await factStore.list("approved")).map((f) => [f.id, f]));
  const sources = hits
    .filter((h) => (h.factId ? facts.has(h.factId) : h.memoryId && memories.has(h.memoryId)))
    .map((h, i) => {
      const m = h.memoryId ? memories.get(h.memoryId) : undefined;
      const photo = m?.files.find((f) => (h.file ? f.name === h.file : f.kind === "image"));
      // a verified fact is given in the language of the question (its vector holds both)
      const f = h.factId ? facts.get(h.factId) : undefined;
      const text = f ? (lang === "ru" ? f.statementRu || f.statement : f.statement) : h.text;
      return {
        n: i + 1,
        kind: h.kind,
        text,
        memoryId: m?.id,
        factId: h.factId,
        title: m?.title || m?.body.slice(0, 60),
        author: m?.author,
        photo: photo && photo.kind !== "audio" ? `/api/files/memories/${m!.id}/${photo.thumb ?? photo.name}` : undefined,
      };
    });

  // the family tree is always one of the sources: who her children, grandchildren and great-grandchildren are
  const tree = await familySummary(lang).catch(() => null);
  const sourcesAll = tree
    ? [...sources, { n: sources.length + 1, kind: "tree" as const, text: tree, memoryId: undefined, factId: undefined, title: undefined, author: undefined, photo: undefined }]
    : sources;

  const unknown = lang === "ru" ? "На сайте пока нет ответа на этот вопрос." : "באתר עוד אין תשובה לשאלה הזו.";
  if (!sourcesAll.length) return json({ answer: unknown, sources: [], known: false });

  const label = { tree: "the family tree", fact: "verified fact", memory: "a family memory", note: "what the family told about a photo", ocr: "text read from a letter (may contain reading errors)", transcript: "transcript of a recording (may contain errors)" };
  const context = sourcesAll.map((s) => `[${s.n}] (${label[s.kind]}${s.author ? `, by ${s.author}` : ""}) ${s.text}`).join("\n");
  const answer = await chat(
    "ask",
    [
      {
        role: "system",
        content: `You answer family members' questions about their grandmother Rosa${profile.birthYear ? ` (born ${profile.birthYear})` : ""} on her memorial website.
Use ONLY the numbered sources below. Do not use any other knowledge and do not guess. If the sources do not answer the question, reply exactly: ${unknown}
Answer in ${lang === "ru" ? "Russian" : "Hebrew"} only (translate what the sources say if they are in another language), warmly and briefly (1–4 sentences), in your own words: do not paste the sources. Refer to her as "סבתא רוזה" / "бабушка Роза". After each statement put the number of the source it comes from, like [2]. Verified facts are more reliable than memories; letters and transcripts may contain errors. For questions about who is in the family or how many there are, use the family tree source and say it is according to the family tree on the site.

Sources:
${context}`,
      },
      { role: "user", content: q },
    ],
    { maxTokens: 500, temperature: 0.2 }
  );
  if (answer === null) return json({ error: "unavailable" }, 503);
  const text = answer.trim().slice(0, 2000);
  // keep only the sources the answer actually cites
  const cited = new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
  // the tree is shown as a short card, not the whole text given to the model
  const card = (s: (typeof sourcesAll)[number]) => (s.kind === "tree" ? { ...s, text: lang === "ru" ? "Семейное древо на сайте" : "עץ המשפחה באתר" } : s);
  const used = sourcesAll.filter((s) => cited.has(s.n)).map(card);
  const known = used.length > 0 && !text.includes(unknown);
  return json({ answer: known ? text : unknown, sources: known ? used : [], known });
}
