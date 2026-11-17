"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { ease } from "@/lib/motion";
import { STATIC } from "../Transition";
import { AnswerView, Thinking, useAsk } from "../ask/useAsk";
import { Container } from "../ui";

/**
 * "What would you like to know about grandma?" on the home page: one inviting question box,
 * a few questions to start from, and the answer right here, with where it comes from.
 */
const NAME_KEY = "roza-my-name";

/** a family member tells grandma one short detail; it waits for the owner's check before answers use it */
function QuickTell({ question, onClose }: { question?: string; onClose?: () => void }) {
  const { t } = useLang();
  const s = t.search;
  const [answer, setAnswer] = useState("");
  const [by, setBy] = useState(() => {
    try {
      return localStorage.getItem(NAME_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [state, setState] = useState<"idle" | "sending" | "done" | "failed" | "missing">("idle");
  const send = async () => {
    if (answer.trim().length < 3 || by.trim().length < 2) return setState("missing");
    setState("sending");
    try {
      localStorage.setItem(NAME_KEY, by.trim());
    } catch {}
    const r = await fetch("/api/facts/suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer, by, question }) }).catch(() => null);
    setState(r?.ok ? "done" : "failed");
  };
  if (state === "done") return <p role="status" className="rounded-[16px] bg-white/80 px-5 py-4 text-start text-burgundy ring-1 ring-blush">{s.tellThanks}</p>;
  const field = "w-full rounded-[14px] border border-charcoal/15 bg-white px-4 py-3 text-[1rem] text-charcoal outline-none focus:border-rose focus:shadow-[0_0_0_3px_rgba(184,92,120,0.15)]";
  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease }}
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="flex w-full flex-col gap-3 rounded-[20px] bg-white/80 p-5 text-start ring-1 ring-blush"
    >
      <div>
        <h3 className="font-display text-[1.3rem] text-burgundy">{s.tellTitle}</h3>
        <p className="mt-1 text-[0.9rem] text-ink-soft">{s.tellLead}</p>
      </div>
      <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={300} rows={2} dir="auto" aria-label={s.tellTitle} placeholder={s.tellPh} className={field} />
      <input value={by} onChange={(e) => setBy(e.target.value)} maxLength={80} autoComplete="name" aria-label={s.tellName} placeholder={s.tellName} className={field} />
      {state === "missing" && <p role="alert" className="text-[0.9rem] text-burgundy">{s.tellMissing}</p>}
      {state === "failed" && <p role="alert" className="text-[0.9rem] text-burgundy">{s.tellFailed}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={state === "sending"} className="min-h-11 rounded-full bg-burgundy px-6 text-white disabled:opacity-60">
          {state === "sending" ? s.tellSending : s.tellSend}
        </button>
        {onClose && (
          <button type="button" onClick={onClose} className="min-h-11 px-3 text-ink-soft hover:text-charcoal">
            {t.removal.cancel}
          </button>
        )}
      </div>
    </motion.form>
  );
}

export default function AskRosa() {
  const { t, lang } = useLang();
  const s = t.search;
  const { ask, busy, res, reset } = useAsk();
  const [q, setQ] = useState("");
  // the question as it was asked, shown above her answer like a conversation
  const [asked, setAsked] = useState("");
  const [telling, setTelling] = useState(false);
  const [hint, setHint] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const Send = lang === "he" ? ArrowLeft : ArrowRight;

  // the placeholder slowly cycles through example questions
  useEffect(() => {
    if (q) return;
    const id = setInterval(() => setHint((h) => (h + 1) % s.suggestions.length), 3200);
    return () => clearInterval(id);
  }, [q, s.suggestions.length]);

  if (STATIC) return null;

  const go = (text: string) => {
    if (text.trim().length < 3) return;
    setQ(text);
    setAsked(text.trim());
    ask(text);
  };
  const face = (size: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/images/rosa-avatar.webp" alt="" className={`${size} shrink-0 rounded-full bg-blush object-cover ring-4 ring-white shadow-[0_8px_24px_-10px_rgba(118,46,73,0.45)]`} />
  );

  return (
    <section id="ask" aria-labelledby="ask-title" className="relative overflow-hidden py-[clamp(3rem,6vw,5rem)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(48rem_22rem_at_50%_0%,rgba(232,212,211,0.6),transparent_70%),radial-gradient(30rem_18rem_at_50%_100%,rgba(167,181,160,0.14),transparent_70%)]" />
      <Container className="relative flex flex-col items-center gap-6 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ type: "spring", visualDuration: 0.6, bounce: 0.25 }}>
          {face("h-24 w-24 sm:h-28 sm:w-28")}
        </motion.div>
        <motion.span initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease }} className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-[0.85rem] text-burgundy ring-1 ring-blush">
          <Sparkles className="h-4 w-4 text-rose" strokeWidth={1.6} aria-hidden />
          {s.askEyebrow}
        </motion.span>
        <p className="-mb-3 font-hand text-[clamp(1.25rem,2.4vw,1.6rem)] text-burgundy/90">{s.askHello}</p>
        <motion.h2 id="ask-title" initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease, delay: 0.05 }} className="max-w-3xl text-[clamp(2.1rem,4.6vw,3.6rem)] font-light leading-[1.1] text-burgundy">
          {s.askTitle}
        </motion.h2>
        <p className="max-w-xl text-[1rem] leading-relaxed text-ink-soft">{s.askLead}</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            go(q);
          }}
          className="group mt-2 flex w-full max-w-2xl items-center gap-2 rounded-full bg-white p-2 ps-5 shadow-[0_2px_4px_rgba(60,40,30,0.06),0_18px_44px_-18px_rgba(118,46,73,0.35)] ring-1 ring-blush transition-shadow focus-within:shadow-[0_2px_4px_rgba(60,40,30,0.06),0_22px_50px_-16px_rgba(118,46,73,0.45)] focus-within:ring-rose/50"
        >
          <Sparkles className="h-5 w-5 shrink-0 text-rose" strokeWidth={1.5} aria-hidden />
          <div className="relative min-w-0 flex-1">
            <input
              ref={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={300}
              enterKeyHint="send"
              aria-label={s.askTitle}
              className="h-12 w-full bg-transparent text-[1.1rem] text-charcoal outline-none sm:text-[1.2rem]"
            />
            {!q && (
              <AnimatePresence mode="wait">
                <motion.span key={hint} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.4 }} aria-hidden className="pointer-events-none absolute inset-y-0 start-0 flex items-center truncate text-[1.1rem] text-ink-soft sm:text-[1.2rem]">
                  {s.suggestions[hint]}
                </motion.span>
              </AnimatePresence>
            )}
          </div>
          <button type="submit" disabled={busy || q.trim().length < 3} aria-label={s.askButton} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-burgundy text-white transition-[transform,opacity] hover:scale-105 disabled:opacity-40 sm:w-auto sm:gap-2 sm:px-6">
            <span className="hidden sm:inline">{s.askButton}</span>
            <Send className="h-5 w-5" aria-hidden />
          </button>
        </form>

        <div className="flex flex-wrap justify-center gap-2">
          {s.suggestions.map((x) => (
            <button key={x} type="button" onClick={() => go(x)} disabled={busy} className="min-h-10 rounded-full bg-white/70 px-4 text-[0.92rem] text-charcoal ring-1 ring-line transition-colors hover:bg-white hover:text-burgundy hover:ring-blush disabled:opacity-50">
              {x}
            </button>
          ))}
        </div>

        <div aria-live="polite" className="flex w-full max-w-3xl flex-col gap-4">
          {(busy || res) && asked && (
            <motion.p
              dir="auto"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 max-w-[85%] self-end rounded-[20px] rounded-ee-[6px] bg-burgundy px-5 py-3 text-start text-[1.05rem] text-white shadow-[0_8px_20px_-12px_rgba(90,30,50,0.6)]"
            >
              {asked}
            </motion.p>
          )}
          {busy && (
            <div className="flex items-end gap-3 self-start">
              {face("h-11 w-11")}
              <div className="rounded-[20px] rounded-es-[6px] bg-white/85 px-5 py-4 ring-1 ring-blush">
                <Thinking label={s.thinking} />
              </div>
            </div>
          )}
          {res && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", visualDuration: 0.5, bounce: 0 }}
              className="flex w-full items-end gap-3 self-start"
            >
              {face("hidden h-11 w-11 sm:block")}
              <div className="flex min-w-0 flex-1 flex-col items-stretch gap-5 rounded-[24px] rounded-es-[6px] bg-white/80 p-5 text-start ring-1 ring-blush shadow-[0_14px_36px_-22px_rgba(118,46,73,0.45)] sm:p-7">
                <span className="flex items-center gap-2 text-[0.85rem] text-burgundy">
                  {face("h-7 w-7 ring-2 sm:hidden")}
                  {s.rosa}
                </span>
                <AnswerView res={res} chat />
                {"known" in res && !res.known && <QuickTell key={asked} question={asked} />}
                <button
                type="button"
                onClick={() => {
                  reset();
                  setQ("");
                  setAsked("");
                  input.current?.focus();
                }}
                className="self-center text-[0.92rem] text-ink-soft underline decoration-dusty/50 underline-offset-4 hover:text-burgundy"
              >
                {s.another}
              </button>
              </div>
            </motion.div>
          )}
        </div>
        {telling ? (
          <div className="w-full max-w-3xl">
            <QuickTell onClose={() => setTelling(false)} />
          </div>
        ) : (
          !(res && "known" in res && !res.known) && (
            <button type="button" onClick={() => setTelling(true)} className="min-h-11 text-[0.95rem] text-burgundy underline decoration-dusty/50 underline-offset-4">
              {s.tellOpen}
            </button>
          )
        )}
        <p className="text-[0.78rem] text-ink-soft/80">{s.askHint}</p>
      </Container>
    </section>
  );
}
