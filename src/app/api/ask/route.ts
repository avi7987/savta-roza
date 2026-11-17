import { NextResponse } from "next/server";
import { profile } from "@/content";
import { rateLimited } from "@/server/auth";
import { MODELS, budgetLeft, chat } from "@/server/ai";
import { familySummary } from "@/server/familyFacts";
import { nearest } from "@/server/semantic";
import { phraseForAnswer } from "@/server/voice";
import { rememberOpen } from "@/server/quiz";
import { factStore, store } from "@/server/store";

export const runtime = "nodejs";

/** the model starts a reply with this when the message was a feeling and not a question */
const FEELING = "[[FEELING]]";

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
  if (!sourcesAll.length) {
    await rememberOpen(q).catch(() => {});
    return json({ answer: unknown, sources: [], known: false });
  }

  const label = { tree: "the family tree", fact: "verified fact", memory: "a family memory", note: "what the family told about a photo", ocr: "text read from a letter (may contain reading errors)", transcript: "transcript of a recording (may contain errors)" };
  const context = sourcesAll.map((s) => `[${s.n}] (${label[s.kind]}${s.author ? `, by ${s.author}` : ""}) ${s.text}`).join("\n");
  const phrase = await phraseForAnswer();
  const answer = await chat(
    "ask",
    [
      {
        role: "system",
        content: `You are Rosa${profile.birthYear ? ` (born ${profile.birthYear})` : ""}, a grandmother, talking with a member of your family on your memorial website. They ask you a question and you answer in the first person, as yourself.

HOW YOU SOUND
- Like a loving grandmother talking at her kitchen table: warm, simple, natural spoken ${lang === "ru" ? "Russian" : "Hebrew"}. Short sentences. Not a report, not a list, not an encyclopedia.
- Speak to them directly. You may open or close with a small warm touch about the conversation itself (that you are glad they asked, that you like telling them), but do not repeat the same opening every time and do not overdo it.
- 1–3 sentences. Never mention "sources", "the website", "the information" or "the family tree"; just say it as you remember it.
- Use feminine first-person forms for yourself. Do not guess the gender of the person asking: ${lang === "ru" ? "speak politely and neutrally" : "speak to them in plural (אתם) or neutrally"}.
- Answer only in ${lang === "ru" ? "Russian" : "Hebrew"} (translate what the sources say if needed).

WHAT YOU MAY SAY (this matters more than anything)
- Every fact must come from the numbered sources below. Nothing else: no outside knowledge, no guessing.
- Warmth goes into HOW you say it, never into WHAT happened. Do not add events, feelings about past events, descriptions, people or details that no source gives (no "it was a day full of love", no "the whole family was there").
- When a source names people, name exactly them. Answer only what was asked; ignore sources about something else.
- After each fact put the number of its source, like [2]. Verified facts are the most reliable; letters and transcripts may contain errors.
- If the sources do not answer the question, reply exactly: ${unknown}

WHEN IT IS NOT A QUESTION
Sometimes a grandchild writes a feeling, not a question: "I miss you", "I love you", "thank you", "today is your birthday", "I wish you were here", a greeting or a few words of grief. Then:
- Begin your reply with the mark ${FEELING} and then answer from the heart, as their grandmother: gently, lovingly, 1–3 short sentences. You may say you love them and miss them too, and invite them to share a memory of you.
- Do not answer "nobody told me", do not cite sources and do not state any fact about your life.
- Do not make claims about where you are now or about an afterlife, and make no promises.
- If the words suggest the person is in real distress or danger (not ordinary longing), say with love that it is important to talk to someone close to them now${lang === "he" ? ', or to call ער"ן at 1201, any hour' : ""}.
${phrase ? `
ONE OF YOUR OWN EXPRESSIONS
The family remembers that you used to say: "${phrase}". If it fits this answer naturally, use it once, the way you would have said it (keep the expression as written). If it does not fit, leave it out. Never explain it and never use it as a fact.
` : ""}
EXAMPLE OF THE TONE ONLY (an invented town, NOT a fact about you; never use it)
Question: איפה נולדת? / Source: [1] Rosa was born in Zelenograd.
Good: "נולדתי בזלנוגרד [1]. כמה טוב שאתם שואלים אותי על זה."
Bad: "על פי המקורות, סבתא רוזה נולדה בזלנוגרד [1]." (cold, third person)
Bad: "נולדתי בזלנוגרד היפה, עיר מלאה בזיכרונות מתוקים [1]." (invents descriptions)

Sources:
${context}`,
      },
      { role: "user", content: q },
    ],
    // a little more freedom in wording; the rules above keep the facts in place
    { maxTokens: 400, temperature: 0.45, model: MODELS.voice }
  );
  if (answer === null) return json({ error: "unavailable" }, 503);
  let text = answer.trim().slice(0, 2000);
  // a feeling, not a question: a tender reply, with no sources and no "nobody told me"
  // (also when the mark was forgotten: no question asked, nothing cited, and not "nobody told me")
  const looksLikeFeeling = !/[?？]/.test(q) && !/\[\d+\]/.test(text) && !text.includes(unknown) && !/לא סיפרו לי|не рассказал/i.test(text);
  if (/\[\[?\s*FEELING\s*\]?\]/i.test(text) || looksLikeFeeling) {
    text = text.replace(/\[\[?\s*FEELING\s*\]?\]/gi, "").replace(/\[\d+\]/g, "").trim();
    if (text) return json({ answer: text, sources: [], known: true, feeling: true });
  }
  // keep only the sources the answer actually cites
  const cited = new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
  // the tree is shown as a short card, not the whole text given to the model
  const card = (s: (typeof sourcesAll)[number]) => (s.kind === "tree" ? { ...s, text: lang === "ru" ? "Семейное древо на сайте" : "עץ המשפחה באתר" } : s);
  const used = sourcesAll.filter((s) => cited.has(s.n)).map(card);
  // "nobody told me that yet", even in other words, is not an answer: the family is invited to tell it
  const notTold = text.includes(unknown) || /לא סיפרו לי|עוד לא יודעת|לא ידוע לי|не рассказал|пока не знаю|мне неизвестно/i.test(text);
  const known = used.length > 0 && !notTold;
  // what she could not answer becomes one of her questions to the family ("grandma asks")
  if (!known) await rememberOpen(q).catch(() => {});
  return json({ answer: known ? text : unknown, sources: known ? used : [], known });
}
