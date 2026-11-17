"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Heart, Mic, Share2, Square, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { decadeLabel } from "@/lib/photoDate";
import { ROSA } from "@/content/family";
import PeoplePicker, { refreshNames } from "../people/PeoplePicker";
import { DECADES } from "../PhotoActions";
import { STATIC } from "../Transition";
import { buttonClass, cn } from "../ui";
import { refreshPhotos } from "../gallery/usePhotos";

/*
  "Grandma asks": one small card at a time, in her voice, asking something the site does not know.
  It comes once the visitor has looked around (or right after they shared or asked something),
  never over an open window, and never again the same question for the same person. After an
  answer she thanks them and offers one more; "enough for now" puts it away until a later visit.
*/

type Card =
  | { id: string; kind: "photo-when" | "photo-who"; src: string; memoryId: string; file: string; year?: number }
  | { id: string; kind: "fact"; text: string; textRu?: string; from: "owner" | "asked" }
  | { id: string; kind: "born"; personId: string; name: string; gender?: string }
  | { id: string; kind: "words" | "memory"; n: number };

const KEY = "roza-quiz";
const NAME = "roza-my-name";
const HELPED = "roza-quiz-helped";
/** after "enough for now", she waits this long before asking again */
const REST = 8 * 60 * 60 * 1000;

type Saved = { done: string[]; closedAt?: number };
const read = (): Saved => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { done: Array.isArray(v.done) ? v.done : [], closedAt: typeof v.closedAt === "number" ? v.closedAt : undefined };
  } catch {
    return { done: [] };
  }
};
const write = (s: Saved) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, done: s.done.slice(-500) }));
  } catch {}
};

/** easy ones first and in between, so one answer leads to the next */
function order(cards: Card[], first?: string) {
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

const blocked = () => !!document.querySelector('[aria-modal="true"]') || document.documentElement.hasAttribute("data-tree-full");

export default function RosaAsks() {
  const path = usePathname();
  const away = STATIC || /^\/(admin|sort|share)/.test(path ?? "");
  if (away) return null;
  return <Deck />;
}

function Deck() {
  const { t, lang } = useLang();
  const q = t.quiz;
  const [deck, setDeck] = useState<Card[] | null>(null);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<"ask" | "thanks" | "done">("ask");
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [helped, setHelped] = useState(0);
  const [opener, setOpener] = useState(0);
  const [by, setBy] = useState("");
  const loading = useRef(false);
  const sent = useRef<string | undefined>(undefined);

  // a question sent with a link (?q=…) opens right away, even after "enough for now"
  useEffect(() => {
    try {
      setBy(localStorage.getItem(NAME) ?? "");
      setHelped(Number(sessionStorage.getItem(HELPED)) || 0);
    } catch {}
    const u = new URL(location.href);
    const want = u.searchParams.get("q");
    if (want) {
      sent.current = want;
      u.searchParams.delete("q");
      history.replaceState(history.state, "", u.pathname + u.search + u.hash);
    }
  }, []);

  const show = useCallback(
    async (force = false, engaged = false) => {
      if (loading.current) return;
      const saved = read();
      if (!force && saved.closedAt && Date.now() - saved.closedAt < REST) return;
      loading.current = true;
      const r = await fetch(`/api/quiz${sent.current ? `?q=${encodeURIComponent(sent.current)}` : ""}`).catch(() => null);
      const d = (r?.ok ? await r.json() : { on: false, cards: [] }) as { on: boolean; cards: Card[] };
      if (!d.on) return;
      const local: Card[] = [...t.quiz.words.map((_, n) => ({ id: `w-${n}`, kind: "words" as const, n })), ...t.quiz.memories.map((_, n) => ({ id: `m-${n}`, kind: "memory" as const, n }))];
      const done = new Set(saved.done);
      const all = [...d.cards, ...local].filter((c) => !done.has(c.id) || c.id === sent.current);
      const sorted = order(all, sent.current);
      if (!sorted.length) return;
      setDeck(sorted);
      setI(0);
      setPhase("ask");
      setOpener(engaged ? 3 : Math.floor(Math.random() * 3));
      setOpen(true);
    },
    [t]
  );

  // once they have looked around a little: some time on the site and a scroll, or a bit longer;
  // or a little after they shared a memory or got an answer from her (once that window is closed)
  useEffect(() => {
    if (open) return;
    const t0 = Date.now();
    let scrolled = false;
    let engagedAt = 0;
    try {
      if (sessionStorage.getItem("roza-quiz-engaged")) {
        sessionStorage.removeItem("roza-quiz-engaged");
        engagedAt = Date.now() + 2500;
      }
    } catch {}
    const onScroll = () => (scrolled ||= window.scrollY > window.innerHeight * 0.6);
    const onEngaged = (e: Event) => (engagedAt = Date.now() + ((e as CustomEvent<{ delay?: number }>).detail?.delay ?? 6000));
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("roza:engaged", onEngaged);
    const id = window.setInterval(() => {
      if (blocked()) return;
      const s = (Date.now() - t0) / 1000;
      const engaged = !!engagedAt && Date.now() > engagedAt;
      if (engaged || (sent.current ? s > 1.2 : (scrolled && s > 14) || s > 40)) {
        window.clearInterval(id);
        show(!!sent.current, engaged);
      }
    }, 1000);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("roza:engaged", onEngaged);
    };
  }, [open, show]);

  // stays out of the way while a window (a photo, the add-memory steps, the full-screen tree) is open
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setHidden(blocked()), 500);
    return () => window.clearInterval(id);
  }, [open]);

  const close = () => {
    write({ ...read(), closedAt: Date.now() });
    sent.current = undefined;
    setOpen(false);
    loading.current = false;
  };
  const markDone = (id: string) => {
    const s = read();
    write({ ...s, done: Array.from(new Set([...s.done, id])) });
  };
  const answered = (id: string, name?: string) => {
    markDone(id);
    if (name) {
      setBy(name);
      try {
        localStorage.setItem(NAME, name);
      } catch {}
    }
    const n = helped + 1;
    setHelped(n);
    try {
      sessionStorage.setItem(HELPED, String(n));
    } catch {}
    setPhase("thanks");
  };
  const next = (skip?: string) => {
    if (skip) markDone(skip);
    if (deck && i + 1 < deck.length) {
      setI(i + 1);
      setPhase("ask");
    } else setPhase("done");
  };

  const card = deck?.[i];
  const thanks = useMemo(() => q.thanks[Math.floor(Math.random() * q.thanks.length)], [q, helped]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {open && !hidden && card && (
        <motion.section
          key="rosa-asks"
          aria-label={q.eyebrow}
          initial={{ opacity: 0, y: 28, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ type: "spring", visualDuration: 0.5, bounce: 0.15 }}
          className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] z-[65] md:inset-x-auto md:bottom-6 md:end-6 md:w-[25rem]"
        >
          <motion.div
            layout
            transition={{ type: "spring", visualDuration: 0.4, bounce: 0.1 }}
            data-lenis-prevent
            className="max-h-[min(66svh,38rem)] overflow-y-auto rounded-[22px] bg-paper shadow-[0_22px_50px_-20px_rgba(70,35,45,0.5),0_2px_6px_rgba(70,35,45,0.08)] ring-1 ring-line"
          >
            <motion.div layout="position" className="flex items-center gap-3 px-4 pt-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/rosa-avatar.webp" alt="" className="h-11 w-11 shrink-0 rounded-full bg-blush object-cover ring-[3px] ring-white shadow-[0_6px_16px_-8px_rgba(118,46,73,0.5)]" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[0.8rem] text-rose">{q.eyebrow}</span>
                {phase === "ask" && <span className="truncate text-[0.92rem] text-ink-soft">{q.openers[opener]}</span>}
              </span>
              <button type="button" onClick={close} aria-label={q.close} title={q.close} className="-me-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-blush/50 hover:text-burgundy">
                <X className="h-5 w-5" strokeWidth={1.6} aria-hidden />
              </button>
            </motion.div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${phase}-${card.id}`}
                initial={{ opacity: 0, x: lang === "he" ? -18 : 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: lang === "he" ? 18 : -18 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="px-4 pb-4 pt-3"
              >
                {phase === "ask" && <Question card={card} by={by} onAnswered={(name) => answered(card.id, name)} onSkip={() => next(card.id)} />}
                {phase === "thanks" && (
                  <div className="flex flex-col gap-4" role="status">
                    <div className="flex items-start gap-3">
                      <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", visualDuration: 0.45, bounce: 0.45 }} className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blush/70 text-rose">
                        <Heart className="h-[1.1rem] w-[1.1rem]" fill="currentColor" aria-hidden />
                      </motion.span>
                      <div className="flex flex-col gap-1">
                        <p className="font-display text-[1.3rem] leading-snug text-burgundy">{thanks}</p>
                        <p className="text-[0.9rem] text-ink-soft">{q.helped(helped)}</p>
                      </div>
                    </div>
                    <Dots n={helped} />
                    {i + 1 < (deck?.length ?? 0) ? (
                      <div className="flex flex-col gap-2">
                        <span className="text-[1rem] text-charcoal">{q.more}</span>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => next()} className={cn(buttonClass.primary, "min-h-11 px-6")}>
                            {q.yes}
                          </button>
                          <button type="button" onClick={close} className={cn(buttonClass.secondary, "min-h-11 px-5")}>
                            {q.close}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={close} className={cn(buttonClass.secondary, "min-h-11 w-fit px-5")}>
                        {q.close}
                      </button>
                    )}
                  </div>
                )}
                {phase === "done" && (
                  <div className="flex flex-col gap-3">
                    <p className="font-display text-[1.25rem] leading-snug text-burgundy">{q.done}</p>
                    <button type="button" onClick={close} className={cn(buttonClass.secondary, "min-h-11 w-fit px-5")}>
                      {q.close}
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

/** one small rose for each thing they helped with today */
function Dots({ n }: { n: number }) {
  return (
    <div aria-hidden className="flex flex-wrap gap-1.5">
      {Array.from({ length: Math.min(n, 12) }, (_, k) => (
        <motion.span key={k} initial={k === n - 1 ? { scale: 0 } : false} animate={{ scale: 1 }} transition={{ type: "spring", visualDuration: 0.4, bounce: 0.5, delay: 0.15 }} className="h-2 w-2 rounded-full bg-rose/70" />
      ))}
    </div>
  );
}

function Question({ card, by, onAnswered, onSkip }: { card: Card; by: string; onAnswered: (name?: string) => void; onSkip: () => void }) {
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

  const question =
    card.kind === "photo-when"
      ? q.photoWhen
      : card.kind === "photo-who"
        ? q.photoWho
        : card.kind === "fact"
          ? (lang === "ru" && card.textRu) || card.text
          : card.kind === "born"
            ? q.born(card.name, card.gender === "f", card.personId === ROSA)
            : card.kind === "words"
              ? q.words[card.n]
              : card.kind === "memory"
                ? q.memories[card.n]
                : "";
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
      <h2 className="font-display text-[1.35rem] leading-snug text-burgundy">{question}</h2>
      {photo && (
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
