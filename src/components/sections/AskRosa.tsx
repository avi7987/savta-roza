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
export default function AskRosa() {
  const { t, lang } = useLang();
  const s = t.search;
  const { ask, busy, res, reset } = useAsk();
  const [q, setQ] = useState("");
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
    setQ(text);
    ask(text);
  };

  return (
    <section id="ask" aria-labelledby="ask-title" className="relative overflow-hidden py-[clamp(4rem,8vw,7rem)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(48rem_22rem_at_50%_0%,rgba(232,212,211,0.6),transparent_70%),radial-gradient(30rem_18rem_at_50%_100%,rgba(167,181,160,0.14),transparent_70%)]" />
      <Container className="relative flex flex-col items-center gap-6 text-center">
        <motion.span initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease }} className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-[0.85rem] text-burgundy ring-1 ring-blush">
          <Sparkles className="h-4 w-4 text-rose" strokeWidth={1.6} aria-hidden />
          {s.askEyebrow}
        </motion.span>
        <motion.h2 id="ask-title" initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease, delay: 0.05 }} className="max-w-3xl text-[clamp(2.1rem,4.6vw,3.6rem)] font-light leading-[1.1] text-burgundy">
          {s.askTitle}
        </motion.h2>
        <p className="max-w-xl text-[1rem] leading-relaxed text-ink-soft">{s.askLead}</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(q);
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
                <motion.span key={hint} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.4 }} aria-hidden className="pointer-events-none absolute inset-y-0 start-0 flex items-center truncate text-[1.1rem] text-ink-soft/70 sm:text-[1.2rem]">
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

        <div aria-live="polite" className="w-full max-w-3xl">
          {busy && (
            <div className="mt-4 flex justify-center">
              <Thinking label={s.thinking} />
            </div>
          )}
          {res && (
            <div className="mt-6 flex flex-col items-center gap-5 rounded-[24px] bg-white/60 p-6 ring-1 ring-white sm:p-8">
              <AnswerView res={res} />
              <button
                type="button"
                onClick={() => {
                  reset();
                  setQ("");
                  input.current?.focus();
                }}
                className="text-[0.92rem] text-burgundy underline decoration-dusty/50 underline-offset-4"
              >
                {s.another}
              </button>
            </div>
          )}
        </div>
        <p className="text-[0.78rem] text-ink-soft/80">{s.askHint}</p>
      </Container>
    </section>
  );
}
