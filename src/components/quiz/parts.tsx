"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Share2, Square } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { decadeLabel } from "@/lib/photoDate";
import { ROSA } from "@/content/family";
import PeoplePicker, { refreshNames } from "../people/PeoplePicker";
import { DECADES } from "../PhotoActions";
import { buttonClass, cn } from "../ui";
import { refreshPhotos } from "../gallery/usePhotos";

/* the pieces "Grandma asks" shares between the small card that pops up and the page of all her questions */

export type Card =
  | { id: string; kind: "photo-when" | "photo-who"; src: string; memoryId: string; file: string; year?: number }
  | { id: string; kind: "fact"; text: string; textRu?: string; from: "owner" | "asked" }
  | { id: string; kind: "born"; personId: string; name: string; gender?: string }
  | { id: string; kind: "words" | "memory"; n: number };

export const KEY = "roza-quiz";
export const NAME = "roza-my-name";
export const HELPED = "roza-quiz-helped";

/** done: never pop up again for this visitor (answered or skipped); answered: they told her */
export type Saved = { done: string[]; answered: string[]; closedAt?: number };
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
export const read = (): Saved => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { done: list(v.done), answered: list(v.answered), closedAt: typeof v.closedAt === "number" ? v.closedAt : undefined };
  } catch {
    return { done: [], answered: [] };
  }
};
export const write = (s: Saved) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, done: s.done.slice(-500), answered: s.answered.slice(-500) }));
  } catch {}
};
export const markDone = (id: string) => {
  const s = read();
  write({ ...s, done: Array.from(new Set([...s.done, id])) });
};

/** an answer: remembered so it is not asked again, the name kept for next time, one more rose for today */
export function noteAnswer(id: string, name?: string) {
  const s = read();
  write({ ...s, done: Array.from(new Set([...s.done, id])), answered: Array.from(new Set([...s.answered, id])) });
  let n = 1;
  try {
    if (name) localStorage.setItem(NAME, name);
    n = (Number(sessionStorage.getItem(HELPED)) || 0) + 1;
    sessionStorage.setItem(HELPED, String(n));
  } catch {}
  return n;
}

/** everything she could ask right now: what the site is missing, and her own questions about words and memories */
export async function loadCards(t: { quiz: { words: string[]; memories: string[] } }, want?: string): Promise<{ on: boolean; cards: Card[] }> {
  const r = await fetch(`/api/quiz${want ? `?q=${encodeURIComponent(want)}` : ""}`).catch(() => null);
  const d = (r?.ok ? await r.json() : { on: false, cards: [] }) as { on: boolean; cards: Card[] };
  const local: Card[] = [...t.quiz.words.map((_, n) => ({ id: `w-${n}`, kind: "words" as const, n })), ...t.quiz.memories.map((_, n) => ({ id: `m-${n}`, kind: "memory" as const, n }))];
  return { on: d.on, cards: [...d.cards, ...local] };
}

/** easy ones first and in between, so one answer leads to the next */
export function order(cards: Card[], first?: string) {
  const pick = (k: Card["kind"]) => cards.filter((c) => c.kind === k);
  const asked = cards.filter((c) => c.kind === "fact" && c.from === "asked");
  const own = cards.filter((c) => c.kind === "fact" && c.from === "owner");
  const lanes = [pick("photo-when"), pick("words"), pick("photo-who"), [...asked, ...own], pick("memory"), pick("born")];
  const out: Card[] = [];
  for (let i = 0; lanes.some((l) => l.length); i++) {
    const lane = lanes[i % lanes.length];
    if (lane.length) out.push(lane.shift()!);
  }
  const f = first ? out.findIndex((c) => c.id === first) : -1;
  if (f > 0) {
    out.unshift(...out.splice(f, 1));
    // and then something different, not a second of the same kind
    const g = out.findIndex((c, k) => k > 0 && c.kind !== out[0].kind);
    if (g > 1) out.splice(1, 0, ...out.splice(g, 1));
  }
  return out;
}

type Q = ReturnType<typeof useLang>["t"]["quiz"];
/** the question in her words, in the visitor's language */
export function questionText(card: Card, q: Q, lang: string) {
  switch (card.kind) {
    case "photo-when":
      return q.photoWhen;
    case "photo-who":
      return q.photoWho;
    case "fact":
      return (lang === "ru" && card.textRu) || card.text;
    case "born":
      return q.born(card.name, card.gender === "f", card.personId === ROSA);
    case "words":
      return q.words[card.n];
    case "memory":
      return q.memories[card.n];
  }
}

/** one small rose for each thing they helped with today */
export function Dots({ n }: { n: number }) {
  return (
    <div aria-hidden className="flex flex-wrap gap-1.5">
      {Array.from({ length: Math.min(n, 12) }, (_, k) => (
        <motion.span key={k} initial={k === n - 1 ? { scale: 0 } : false} animate={{ scale: 1 }} transition={{ type: "spring", visualDuration: 0.4, bounce: 0.5, delay: 0.15 }} className="h-2 w-2 rounded-full bg-rose/70" />
      ))}
    </div>
  );
}

export function Question({ card, by, onAnswered, onSkip, bare }: { card: Card; by: string; onAnswered: (name?: string) => void; onSkip: () => void; bare?: boolean }) {
  const { t, lang } = useLang();
  const q = t.quiz;
  const [name, setName] = useState(by);
  const [text, setText] = useState("");
  const [extra, setExtra] = useState("");
  const [year, setYear] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [newNames, setNewNames] = useState<string[]>([]);
  const [audio, setAudio] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "failed">("idle");
  const [err, setErr] = useState("");
  const [shared, setShared] = useState(false);
  const trap = useRef<HTMLInputElement>(null);

  const question = questionText(card, q, lang);
  const photo = card.kind === "photo-when" || card.kind === "photo-who" ? card : null;
  const canRecord = card.kind === "fact" || card.kind === "memory";
  const who = name.trim();

  const post = async (url: string, body: unknown) => {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    return !!r?.ok;
  };
  const memory = async (type: string, body: string, title: string, file?: File | null) => {
    const fd = new FormData();
    fd.set("type", type);
    fd.set("website", trap.current?.value ?? "");
    fd.set("name", who);
    fd.set("title", title);
    fd.set("memory", body);
    fd.set("when", JSON.stringify({ mode: "unknown" }));
    if (file) {
      fd.append("files", file);
      fd.set("filesMeta", JSON.stringify([{}]));
    }
    const r = await fetch("/api/memories", { method: "POST", body: fd }).catch(() => null);
    return !!r?.ok;
  };

  const run = async (work: () => Promise<boolean>, needsName = true) => {
    if (needsName && who.length < 2) return setErr(q.needName);
    setErr("");
    setState("sending");
    const ok = await work();
    if (!ok) return setState("failed");
    onAnswered(who.length >= 2 ? who : undefined);
  };

  const photoInfo = (extra: Record<string, unknown>) => post("/api/photos/bulk-info", { items: [{ memoryId: photo!.memoryId, file: photo!.file }], by: who || undefined, ...extra });

  const submit = () => {
    if (card.kind === "photo-who") {
      if (!people.length && !newNames.length) return setErr(q.needWho);
      return run(async () => {
        const ok = await photoInfo({ people, newPeople: newNames });
        if (ok) {
          if (newNames.length) refreshNames();
          refreshPhotos();
        }
        return ok;
      }, false);
    }
    if (card.kind === "born") {
      const y = Number(year);
      if (!(y > 1850 && y <= new Date().getFullYear())) return setErr(q.needYear);
      return run(() => post("/api/quiz/answer", { id: card.id, kind: "born", answer: year, name: card.name, gender: card.gender, personId: card.personId, question, by: who, website: trap.current?.value ?? "" }));
    }
    if (card.kind === "words") {
      if (text.trim().length < 2) return setErr(q.needAnswer);
      return run(() => memory("words", text.trim(), extra.trim(), null));
    }
    if (!text.trim() && !audio) return setErr(q.needAnswer);
    if (card.kind === "memory") return run(() => memory(audio ? "audio" : "story", text.trim(), question, audio));
    if (card.kind === "fact") {
      return run(async () => {
        if (audio) return (await memory("audio", text.trim(), question, audio)) && (await post("/api/quiz/answer", { id: card.id, recorded: true }));
        return post("/api/quiz/answer", { id: card.id, kind: "fact", answer: text.trim(), question, by: who, website: trap.current?.value ?? "" });
      });
    }
  };

  const share = async () => {
    const url = `${location.origin}/?q=${encodeURIComponent(card.id)}`;
    const msg = q.shareText(question);
    try {
      if (navigator.share) return void (await navigator.share({ text: msg, url }));
    } catch {
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${msg}\n${url}`)}`, "_blank", "noopener");
    setShared(true);
  };

  const field = "w-full rounded-xl border border-charcoal/15 bg-white px-3.5 py-2.5 text-[1rem] leading-relaxed outline-none transition-colors focus:border-rose";
  const sending = state === "sending";

  return (
    <div className="flex flex-col gap-3">
      {!bare && <h2 className="font-display text-[1.35rem] leading-snug text-burgundy">{question}</h2>}
      {photo && !bare && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.src} alt="" className="h-36 w-full rounded-[14px] bg-mount object-cover ring-1 ring-line sm:h-44" />
      )}
      <input ref={trap} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

      {card.kind === "photo-when" && (
        // one row that scrolls sideways on a phone, so the card stays small
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {DECADES.map((d) => (
            <button key={d} type="button" disabled={sending} onClick={() => run(async () => (await photoInfo({ decade: d })) && (refreshPhotos(), true), false)} className="min-h-10 shrink-0 rounded-full bg-white px-3.5 text-[0.92rem] text-charcoal ring-1 ring-charcoal/10 transition-colors hover:bg-blush/50 hover:text-burgundy disabled:opacity-50">
              {decadeLabel(d, lang)}
            </button>
          ))}
        </div>
      )}
      {card.kind === "photo-who" && (
        <PeoplePicker
          label={q.pick}
          selected={people}
          added={newNames}
          onChange={(ids, names) => {
            setPeople(ids);
            setNewNames(names);
            setErr("");
          }}
        />
      )}
      {card.kind === "born" && <input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder={q.yearPh} aria-label={q.yearPh} className={cn(field, "max-w-[12rem]")} />}
      {card.kind === "words" && (
        <>
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} dir="auto" placeholder={q.wordsPh} aria-label={q.wordsPh} className={field} />
          <input value={extra} onChange={(e) => setExtra(e.target.value)} maxLength={120} dir="auto" placeholder={q.wordsWhen} aria-label={q.wordsWhen} className={cn(field, "text-[0.95rem]")} />
        </>
      )}
      {(card.kind === "fact" || card.kind === "memory") && <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1500} dir="auto" placeholder={q.answerPh} aria-label={question} className={cn(field, "resize-none")} />}
      {canRecord && <Recorder file={audio} onFile={setAudio} />}

      {card.kind !== "photo-when" && (
        <div className="flex flex-col gap-2">
          {!by && <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" placeholder={q.name} aria-label={q.name} aria-invalid={err === q.needName} className={cn(field, "min-h-11 py-2 aria-[invalid=true]:border-burgundy")} />}
          <button type="button" onClick={submit} disabled={sending} className={cn(buttonClass.primary, "min-h-11 w-full justify-center")}>
            {sending ? q.sending : card.kind === "photo-who" ? q.save : q.send}
          </button>
        </div>
      )}
      {(err || state === "failed") && (
        <p role="alert" className="text-[0.9rem] text-burgundy">
          {err || q.failed}
        </p>
      )}
      {(card.kind === "fact" || card.kind === "born") && <p className="text-[0.8rem] text-ink-soft">{q.pendingNote}</p>}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-1 text-[0.9rem]">
        <button type="button" onClick={onSkip} disabled={sending} className="min-h-10 text-ink-soft underline decoration-dusty/40 underline-offset-4 hover:text-charcoal">
          {q.skip}
        </button>
        <button type="button" onClick={share} className="inline-flex min-h-10 items-center gap-1.5 text-burgundy hover:text-rose">
          <Share2 className="h-4 w-4" strokeWidth={1.6} aria-hidden />
          {shared ? q.copied : q.share}
        </button>
      </div>
    </div>
  );
}

/** a small record button: easier than typing for some of the family */
function Recorder({ file, onFile }: { file: File | null; onFile: (f: File | null) => void }) {
  const { t } = useLang();
  const q = t.quiz;
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [secs, setSecs] = useState(0);
  const [denied, setDenied] = useState(false);
  const url = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  useEffect(() => {
    if (!rec) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [rec]);
  const supported = typeof window !== "undefined" && "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia;
  if (!supported) return null;

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported(m));
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const mime = (r.mimeType || type || "audio/webm").split(";")[0];
        const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
        onFile(new File(chunks, `recording-${Date.now()}.${ext}`, { type: mime }));
        setRec(null);
      };
      r.start();
      setSecs(0);
      setRec(r);
    } catch {
      setDenied(true);
    }
  };

  if (file && !rec)
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-[0.85rem] text-ink-soft">{q.recorded}</span>
        <audio src={url} controls className="h-10 w-full" />
        <button type="button" onClick={() => (onFile(null), start())} className="w-fit text-[0.88rem] text-burgundy underline decoration-dusty/50 underline-offset-4">
          {q.redo}
        </button>
      </div>
    );
  return (
    <div className="flex items-center gap-3">
      {rec ? (
        <button type="button" onClick={() => rec.stop()} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-burgundy px-4 text-[0.92rem] text-white">
          <Square className="h-3.5 w-3.5" fill="currentColor" aria-hidden />
          {q.stop}
          <span className="tabular-nums opacity-80" aria-live="polite">
            {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
          </span>
        </button>
      ) : (
        <button type="button" onClick={start} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-burgundy/20 px-4 text-[0.92rem] text-burgundy transition-colors hover:bg-white/70">
          <Mic className="h-4 w-4" strokeWidth={1.6} aria-hidden />
          {q.record}
        </button>
      )}
      {rec && <span aria-hidden className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose" />}
      {denied && <span className="text-[0.85rem] text-burgundy">{q.noMic}</span>}
    </div>
  );
}
