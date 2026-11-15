import "server-only";
import { profile } from "@/content";
import { MODELS, base64, budgetLeft, chat, parseJson, runAi } from "./ai";
import { indexMemory } from "./semantic";
import { factStore, jobStore, store, textStore, type FactSource, type StoredFact, type StoredJob, type StoredMemory } from "./store";

/*
  What the site learns from what the family shares.

  Every new memory leaves a little background work: read the words in a photographed letter or
  recipe, write down what is said in a recording, and then look for facts about Rosa's life in all
  of it. A fact is kept only together with the exact words it came from, and it stays a suggestion
  until the site's owner checks it. Nothing found by the computer is shown as certain.
*/

const TYPES_TO_READ = new Set(["letter", "recipe"]);
const MAX_AUDIO = 20 * 1024 * 1024;
const MAX_IMAGE = 2_500_000;
const CATEGORIES: StoredFact["category"][] = ["origin", "family", "home", "work", "events", "traits", "food", "other"];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[֑-ׇ̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/* ---------- the queue ---------- */

async function enqueue(type: StoredJob["type"], memoryId: string, file?: string) {
  const open = await jobStore.list("pending");
  if (open.some((j) => j.type === type && j.memoryId === memoryId && j.file === file)) return;
  await jobStore.create({ type, memoryId, file, attempts: 0 }, [], "pending");
}

/** what a memory needs: its letters read, its recordings written down, then its facts found */
export async function enqueueMemory(m: StoredMemory) {
  for (const f of m.files) {
    if (f.deleteRequest) continue;
    if (f.kind === "audio") await enqueue("transcribe", m.id, f.name);
    if (f.kind === "image" && TYPES_TO_READ.has(m.type ?? "")) await enqueue("ocr", m.id, f.name);
  }
  await enqueue("facts", m.id);
  await enqueue("index", m.id);
}

/** after the family told more about a photo, look at the memory again */
export async function enqueueFacts(memoryId: string) {
  await enqueue("facts", memoryId);
  await enqueue("index", memoryId);
}

const ORDER: Record<StoredJob["type"], number> = { ocr: 0, transcribe: 0, facts: 1, index: 2 };

/**
 * Do some of the waiting work. Stops when the day's share of the AI allowance is used; what is
 * left stays in the queue for the next time (a later upload, or the owner opening the page).
 */
export async function runJobs(opts: { memoryId?: string; limit?: number } = {}) {
  const jobs = (await jobStore.list("pending"))
    .filter((j) => !opts.memoryId || j.memoryId === opts.memoryId)
    .sort((a, b) => ORDER[a.type] - ORDER[b.type] || a.createdAt.localeCompare(b.createdAt));
  let done = 0;
  for (const j of jobs.slice(0, opts.limit ?? 6)) {
    // a memory's facts wait until its letters and recordings are read
    if ((j.type === "facts" || j.type === "index") && jobs.some((o) => o.memoryId === j.memoryId && ORDER[o.type] < ORDER[j.type] && o.status === "pending" && o.id !== j.id)) continue;
    const budget = j.type === "transcribe" ? "speech" : j.type === "index" ? "embed" : "background";
    if ((await budgetLeft(budget)) <= 0) break;
    let ok: boolean | "skip" = false;
    let error: string | undefined;
    try {
      ok = j.type === "ocr" ? await readImage(j) : j.type === "transcribe" ? await transcribe(j) : j.type === "index" ? await indexMemory(j.memoryId) : await findFacts(j.memoryId);
    } catch (e) {
      error = String((e as Error)?.message ?? e).slice(0, 200);
    }
    if (ok) {
      await jobStore.setStatus(j.id, "approved");
      j.status = "approved";
      done++;
    } else {
      const attempts = j.attempts + 1;
      await jobStore.update(j.id, (cur) => ({ ...cur, attempts, error: error ?? cur.error }));
      if (attempts >= 3) await jobStore.setStatus(j.id, "rejected");
      // probably out of allowance for today
      if (!error) break;
    }
  }
  return done;
}

/* ---------- reading and listening ---------- */

async function saveText(j: StoredJob, source: "ocr" | "transcript", text: string, model: string) {
  const old = (await textStore.list()).filter((t) => t.memoryId === j.memoryId && t.file === j.file && t.source === source);
  for (const o of old) await textStore.setStatus(o.id, "rejected");
  await textStore.create({ memoryId: j.memoryId, file: j.file, source, text: text.slice(0, 20000), model }, [], "approved");
}

/** the words in a photographed letter, recipe or document, in their own language */
async function readImage(j: StoredJob): Promise<boolean | "skip"> {
  const m = await store.get(j.memoryId);
  const f = m?.files.find((x) => x.name === j.file);
  if (!m || !f) return "skip";
  // the original, if it is small enough to send, keeps small handwriting readable
  const src = f.size <= MAX_IMAGE ? f.name : f.thumb;
  const bytes = src ? await store.readFile(m.id, src) : undefined;
  if (!bytes) return "skip";
  const mime = /\.png$/i.test(src!) ? "image/png" : /\.webp$/i.test(src!) ? "image/webp" : "image/jpeg";
  const text = await chat("background", [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Copy out all the text in this image exactly as written (handwritten or printed), in its original language (often Hebrew or Russian), keeping line breaks. Do not translate, summarise or add anything. Where a word cannot be read, write [?]. If there is no text, answer exactly: NO_TEXT`,
        },
        { type: "image_url", image_url: { url: `data:${mime};base64,${base64(bytes)}` } },
      ],
    },
  ], { maxTokens: 1500, temperature: 0 });
  if (text === null) return false;
  const clean = text.trim();
  if (!clean || /^NO_TEXT/.test(clean)) return true;
  await saveText(j, "ocr", clean, MODELS.vision);
  return true;
}

/** what is said in a recording */
async function transcribe(j: StoredJob): Promise<boolean | "skip"> {
  const m = await store.get(j.memoryId);
  const f = m?.files.find((x) => x.name === j.file);
  if (!m || !f) return "skip";
  if (f.size > MAX_AUDIO) throw new Error("too long to transcribe");
  const bytes = await store.readFile(m.id, f.name);
  if (!bytes) return "skip";
  const res = await runAi<{ text?: string }>("speech", MODELS.speech, { audio: base64(bytes) });
  if (!res) return false;
  const text = (res.text ?? "").trim();
  if (text) await saveText(j, "transcript", text, MODELS.speech);
  return true;
}

/* ---------- facts ---------- */

type Raw = { statement_he?: string; statement_ru?: string; category?: string; year?: number | null; place?: string | null; quote?: string };

/** everything written about one memory: the words, what the family added, letters and recordings */
async function corpus(m: StoredMemory) {
  const parts: { kind: FactSource["kind"]; file?: string; text: string }[] = [];
  const head = [m.title, m.body].filter(Boolean).join("\n");
  if (head.trim()) parts.push({ kind: "memory", text: head });
  for (const f of m.files)
    for (const n of f.notes ?? []) {
      const t = [n.what, n.place && `מקום: ${n.place}`, n.when && `מתי: ${n.when}`, n.who && `מי: ${n.who}`].filter(Boolean).join(". ");
      if (t) parts.push({ kind: "note", file: f.name, text: t });
    }
  for (const t of await textStore.list("approved")) if (t.memoryId === m.id) parts.push({ kind: t.source, file: t.file, text: t.text });
  return parts;
}

/** find facts in one memory; each must come with words that really appear in it */
export async function findFacts(memoryId: string): Promise<boolean | "skip"> {
  const m = await store.get(memoryId);
  if (!m || m.status === "rejected") return "skip";
  const parts = await corpus(m);
  // a few words (a caption, a title) are too little to learn facts from
  if (parts.reduce((n, p) => n + p.text.trim().length, 0) < 40) return true;
  const numbered = parts.map((p, i) => `[${i + 1}] (${p.kind})\n${p.text}`).join("\n\n");
  const who = m.author ? `It was shared by ${m.author}${m.relation ? ` (${m.relation})` : ""}.` : "";
  const answer = await chat("background", [
    {
      role: "system",
      content: `You help a family keep a record of the life of their grandmother Rosa (${profile.birthYear ? `born ${profile.birthYear}` : "born in the 1930s"}). You read what family members wrote and list FACTS about Rosa's life that the text states clearly: where she was born or lived, family events (marriage, children, moves), work, habits, dishes she cooked, things she loved, dates.
Rules:
- Only what the text says. Never guess, infer or add knowledge. If unsure, leave it out.
- The statement must not say more than its quote: no "every summer", "always", "with the grandchildren" unless those words are in the text.
- A title or caption of a few words (e.g. "the sea at Bat Yam") is not a fact about Rosa by itself; skip it unless the text says what Rosa did.
- Ignore text that is clearly a test or not about the family.
- Each fact must include "quote": a short phrase copied EXACTLY, character for character, from the text, that proves it.
- "statement_he": one short sentence in Hebrew, about Rosa in the third person ("רוזה ..."). "statement_ru": the same in Russian.
- "category": one of ${CATEGORIES.join(", ")}.
- "year": a four-digit year only if the text gives it, else null. "place": a place name if the text gives it, else null.
- At most 10 facts. If there are none, return [].
Reply with ONLY a JSON array.`,
    },
    { role: "user", content: `${who}\n\n${numbered}` },
  ], { maxTokens: 1400, temperature: 0.1 });
  if (answer === null) return false;
  const raw = parseJson<Raw[]>(answer);
  if (!Array.isArray(raw)) return true;

  const existing = await factStore.list();
  for (const r of raw.slice(0, 10)) {
    const statement = typeof r.statement_he === "string" ? r.statement_he.trim().slice(0, 300) : "";
    const quote = typeof r.quote === "string" ? r.quote.trim().slice(0, 400) : "";
    if (!statement || quote.length < 4) continue;
    // the quote has to be in the text; otherwise the fact is not grounded and is dropped
    const from = parts.find((p) => norm(p.text).includes(norm(quote)));
    if (!from) continue;
    const source: FactSource = { memoryId: m.id, file: from.file, kind: from.kind, quote };
    const year = Number(r.year);
    const fact = {
      statement,
      statementRu: typeof r.statement_ru === "string" ? r.statement_ru.trim().slice(0, 300) : undefined,
      category: CATEGORIES.includes(r.category as StoredFact["category"]) ? (r.category as StoredFact["category"]) : "other",
      year: Number.isInteger(year) && year > 1850 && year <= new Date().getFullYear() ? year : undefined,
      place: typeof r.place === "string" && r.place.trim() ? r.place.trim().slice(0, 80) : undefined,
    };
    // the same fact found again only gains a source
    const same = existing.find((e) => e.status !== "rejected" && norm(e.statement) === norm(statement));
    if (same) {
      if (!same.sources.some((s) => s.memoryId === m.id && norm(s.quote ?? "") === norm(quote))) await factStore.update(same.id, (cur) => ({ ...cur, sources: [...cur.sources, source] }));
      continue;
    }
    const made = await factStore.create({ ...fact, sources: [source], by: "ai" }, [], "pending");
    existing.push(made);
  }
  return true;
}

/** the facts of one decade (verified first), for the life story */
export async function factsOfDecade(decade: number, include: ("approved" | "pending")[] = ["approved"]) {
  return (await factStore.list()).filter((f) => include.includes(f.status as "approved" | "pending") && f.year && Math.floor(f.year / 10) * 10 === decade).sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
}

export async function queueState() {
  const all = await jobStore.list();
  return {
    waiting: all.filter((j) => j.status === "pending").length,
    failed: all.filter((j) => j.status === "rejected").map((j) => ({ id: j.id, type: j.type, memoryId: j.memoryId, error: j.error })),
    budget: { background: await budgetLeft("background"), speech: await budgetLeft("speech"), embed: await budgetLeft("embed") },
  };
}
