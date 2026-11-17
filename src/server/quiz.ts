import "server-only";
import { ROSA } from "@/content/family";
import { sortYear } from "@/lib/photoDate";
import { store } from "./store";
import { treeState } from "./treeEdit";

/*
  "Grandma asks": small cards that ask a visitor one thing the site does not know yet. The questions
  come from what is missing: photos with no date or nobody tagged, questions she could not answer,
  people in the tree without a birth year, and questions the owner wrote. Answers go where the rest
  of the site's knowledge goes (a suggested fact for the owner to check, a memory, a photo note).
*/

export type QuizCard =
  | { id: string; kind: "photo-when" | "photo-who"; src: string; memoryId: string; file: string; year?: number }
  | { id: string; kind: "fact"; text: string; textRu?: string; from: "owner" | "asked" }
  | { id: string; kind: "born"; personId: string; name: string; gender?: string };

const OPEN = "quiz-open";
const OWN = "quiz-questions";
const OFF = "quiz-off";
const MAX_OPEN = 40;

/** what she would ask if the owner has not written questions of their own */
export const DEFAULT_QUESTIONS = [
  "איפה נולדתי, ובאיזה בית גדלתי?",
  "באיזו שנה עליתי לארץ, ואיך זה היה?",
  "במה עבדתי במשך השנים?",
  "מה היה המאכל שהכי אהבתם שבישלתי?",
  "איך נפגשתי עם סבא?",
  "איזה שיר הייתי שרה או מזמזמת?",
  "מה הייתי עושה כשהייתי שמחה במיוחד?",
  "איזו עצה שלי אתם זוכרים עד היום?",
];
const DEFAULT_RU = [
  "Где я родилась и в каком доме выросла?",
  "В каком году я приехала в Израиль и как это было?",
  "Кем я работала все эти годы?",
  "Какое моё блюдо вы любили больше всего?",
  "Как я познакомилась с дедушкой?",
  "Какую песню я пела или напевала?",
  "Что я делала, когда была особенно счастлива?",
  "Какой мой совет вы помните до сих пор?",
];

/** a short stable id for a line of text, so "already answered" holds across visits */
export function hashId(s: string) {
  let h = 5381;
  for (const c of s.normalize("NFC")) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}

const norm = (s: string) => s.replace(/[\s?？.!,"'״׳]+/g, " ").trim().toLowerCase();

export async function quizOn() {
  return (await store.getMeta(OFF).catch(() => undefined)) !== "1";
}
export async function setQuizOn(on: boolean) {
  await store.setMeta(OFF, on ? "0" : "1");
}

export async function ownQuestions() {
  const v = await store.getMeta(OWN).catch(() => undefined);
  return v === undefined ? DEFAULT_QUESTIONS : v.split(/\n+/).map((x) => x.trim()).filter(Boolean);
}
export async function setOwnQuestions(text: string) {
  const lines = text
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F<>]/g, "")
    .split(/\n+/)
    .map((x) => x.trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 60);
  await store.setMeta(OWN, lines.join("\n"));
  return lines;
}

/** questions someone asked her that the site could not answer yet, newest first */
export async function openQuestions(): Promise<{ q: string; at: string }[]> {
  try {
    const v = JSON.parse((await store.getMeta(OPEN)) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x?.q === "string") : [];
  } catch {
    return [];
  }
}
async function saveOpen(list: { q: string; at: string }[]) {
  await store.setMeta(OPEN, JSON.stringify(list.slice(0, MAX_OPEN)));
}

/** remember a question she could not answer, so the family is asked it */
export async function rememberOpen(q: string) {
  const text = q.replace(/[\u0000-\u001F\u007F<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
  if (text.length < 6) return;
  const list = await openQuestions();
  if (list.some((x) => norm(x.q) === norm(text))) return;
  await saveOpen([{ q: text, at: new Date().toISOString() }, ...list]);
}

/** once someone answered it (or the owner removed it), it is no longer asked */
export async function dropOpen(idOrText: string) {
  const list = await openQuestions();
  const next = list.filter((x) => x.q !== idOrText && `a-${hashId(x.q)}` !== idOrText);
  if (next.length !== list.length) await saveOpen(next);
}

const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

/** a fresh handful of questions for one visit; the browser leaves out the ones this visitor already answered */
export async function quizCards(want?: string): Promise<QuizCard[]> {
  const memories = (await store.list()).filter((m) => m.status !== "rejected" && !m.deleteRequest);
  const files = memories.flatMap((m) =>
    m.files
      .filter((f) => f.kind !== "audio" && !f.deleteRequest && (f.thumb || f.kind === "image"))
      .map((f) => ({ m, f, people: new Set([...(m.people ?? []), ...(f.people ?? [])].filter((x) => x !== ROSA)) }))
  );
  const src = (m: { id: string }, f: { thumb?: string; name: string }) => `/api/files/memories/${m.id}/${f.thumb ?? f.name}`;
  const when: QuizCard[] = shuffle(files.filter((x) => !x.f.date || x.f.date.source === "ai"))
    .map(({ m, f }) => ({ id: `pw-${m.id}-${f.name}`, kind: "photo-when", src: src(m, f), memoryId: m.id, file: f.name }));
  const who: QuizCard[] = shuffle(files.filter((x) => !x.people.size))
    .map(({ m, f }) => ({ id: `pp-${m.id}-${f.name}`, kind: "photo-who", src: src(m, f), memoryId: m.id, file: f.name, year: sortYear(f.date) }));

  const asked: QuizCard[] = (await openQuestions()).map((x) => ({ id: `a-${hashId(x.q)}`, kind: "fact", text: x.q, from: "asked" }));
  const own: QuizCard[] = shuffle(await ownQuestions()).map((q) => {
    const d = DEFAULT_QUESTIONS.indexOf(q);
    return { id: `o-${hashId(q)}`, kind: "fact", text: q, textRu: d >= 0 ? DEFAULT_RU[d] : undefined, from: "owner" };
  });

  // the closest family first: her children, their partners and her grandchildren, with no birth year yet
  let born: QuizCard[] = [];
  try {
    const { graph: g } = await treeState();
    const real = (id: string) => {
      const p = g.byId.get(id);
      return !!p && !p.virtual && !p.placeholder && !!p.name && !p.pending;
    };
    const kids = g.childrenOf(ROSA);
    const close = [ROSA, ...g.partnersOf(ROSA), ...kids, ...kids.flatMap((k) => g.partnersOf(k)), ...kids.flatMap((k) => g.childrenOf(k))];
    born = Array.from(new Set(close))
      .filter((id) => real(id) && !g.byId.get(id)!.born)
      .map((id) => {
        const p = g.byId.get(id)!;
        return { id: `b-${id}`, kind: "born", personId: id, name: p.name, gender: p.gender };
      });
  } catch {}

  // a question someone sent with a link is always there, even when it would not be in this handful
  const all = [...when, ...who, ...asked, ...own, ...born];
  const sent = want ? all.find((c) => c.id === want) : undefined;
  const some = [...when.slice(0, 30), ...who.slice(0, 30), ...asked, ...own, ...born];
  return sent && !some.includes(sent) ? [sent, ...some] : some;
}
