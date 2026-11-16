import { NextResponse } from "next/server";
import { profile } from "@/content";
import { rateLimited } from "@/server/auth";
import { budgetLeft, chat } from "@/server/ai";
import { familySummary } from "@/server/familyFacts";
import { nearest } from "@/server/semantic";
import { voiceForAnswers } from "@/server/voice";
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

  // in her voice: what nobody has told the site yet, she has not "been told"
  const unknown = lang === "ru" ? "Этого мне пока никто не рассказал." : "את זה עוד לא סיפרו לי.";
  if (!sourcesAll.length) return json({ answer: unknown, sources: [], known: false });

  const label = { tree: "the family tree", fact: "verified fact", memory: "a family memory", note: "what the family told about a photo", ocr: "text read from a letter (may contain reading errors)", transcript: "transcript of a recording (may contain errors)" };
  const context = sourcesAll.map((s) => `[${s.n}] (${label[s.kind]}${s.author ? `, by ${s.author}` : ""}) ${s.text}`).join("\n");
  const voice = await voiceForAnswers();
  const answer = await chat(
    "ask",
    [
      {
        role: "system",
        content: `On the memorial website of grandmother Rosa${profile.birthYear ? ` (born ${profile.birthYear})` : ""}, family members ask her questions, and you answer AS ROSA, in the first person ("I was born…", "my grandchildren…"), speaking to the family member who asked.
Use ONLY the numbered sources below for every fact. Do not use any other knowledge and do not guess.
Strict rules:
- Say only what a source actually says. Do not add feelings, descriptions or summaries that no source gives (no "it was a day full of love", no "with the whole family", no "and all the grandchildren") — not even to sound warm.
- Answer only what was asked, from the sources that are about it. Ignore sources that are about something else.
- When a source names people, give exactly those names, no more and no fewer.
- If the sources do not answer the question, reply exactly: ${unknown}
Answer in ${lang === "ru" ? "Russian" : "Hebrew"} only (translate what the sources say if they are in another language), simply and warmly in tone, like a grandmother telling, briefly (1–3 sentences), in your own words: do not paste the sources. Use feminine first-person forms for yourself. Do not assume the gender of the person asking: ${lang === "ru" ? "address them politely and neutrally" : "address them in plural (אתם) or in a neutral way"}.
After each statement put the number of the source it comes from, like [2]. Verified facts are more reliable than memories; letters and transcripts may contain errors. For who is in the family or how many there are, use the family tree source ("in the family tree…" is not needed; just say it as Rosa would).
${voice ? `How Rosa talked, as the family remembers it (words, pet names, sayings). You may use one of these now and then, only where it fits naturally; never more than one per answer, and never as a fact:\n${voice}\n` : ""}
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
  // "nobody told me that yet", even in other words, is not an answer: the family is invited to tell it
  const notTold = text.includes(unknown) || /לא סיפרו לי|עוד לא יודעת|לא ידוע לי|не рассказал|пока не знаю|мне неизвестно/i.test(text);
  const known = used.length > 0 && !notTold;
  return json({ answer: known ? text : unknown, sources: known ? used : [], known });
}
