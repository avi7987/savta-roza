"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { BookHeart, Check, ChevronDown, Heart, HelpCircle, Images, MessageCircleHeart, Users } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { STATIC } from "../Transition";
import { Container, Eyebrow, Pill, Segmented, buttonClass, cn, paper } from "../ui";
import { Dots, HELPED, NAME, Question, loadCards, noteAnswer, order, questionText, read, type Card } from "./parts";

/*
  Every question she has right now, on one page, for whoever would rather choose than wait for the
  small card: pick a topic, open a question, answer it in place, and go on to the next one.
*/

type Kind = "all" | "photos" | "words" | "facts" | "memories" | "family";
const kindOf = (c: Card): Exclude<Kind, "all"> =>
  c.kind === "photo-when" || c.kind === "photo-who" ? "photos" : c.kind === "words" ? "words" : c.kind === "fact" ? "facts" : c.kind === "memory" ? "memories" : "family";
const ICON = { photos: Images, words: MessageCircleHeart, facts: HelpCircle, memories: BookHeart, family: Users };

export default function QuestionsView() {
  const { t, lang } = useLang();
  const q = t.quiz;
  const p = q.page;
  const [cards, setCards] = useState<Card[] | null>(null);
  const [on, setOn] = useState(true);
  const [kind, setKind] = useState<Kind>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [thanked, setThanked] = useState<string | null>(null);
  const [answered, setAnswered] = useState<string[]>([]);
  const [helped, setHelped] = useState(0);
  const [by, setBy] = useState("");

  useEffect(() => {
    if (STATIC) return setOn(false);
    try {
      setBy(localStorage.getItem(NAME) ?? "");
      setHelped(Number(sessionStorage.getItem(HELPED)) || 0);
    } catch {}
    setAnswered(read().answered);
    loadCards(t).then((d) => {
      setOn(d.on);
      setCards(order(d.cards));
    });
  }, [t]);

  // the ones they already answered go to the end, still open for one more word
  const list = useMemo(() => {
    const all = (cards ?? []).filter((c) => kind === "all" || kindOf(c) === kind);
    const done = new Set(answered);
    return [...all.filter((c) => !done.has(c.id)), ...all.filter((c) => done.has(c.id))];
  }, [cards, kind, answered]);
  const counts = useMemo(() => {
    const n: Record<Kind, number> = { all: 0, photos: 0, words: 0, facts: 0, memories: 0, family: 0 };
    for (const c of cards ?? [])
      if (!answered.includes(c.id)) {
        n.all++;
        n[kindOf(c)]++;
      }
    return n;
  }, [cards, answered]);
  const kinds = (["all", "photos", "words", "facts", "memories", "family"] as Kind[]).filter((k) => k === "all" || (cards ?? []).some((c) => kindOf(c) === k));

  const scrollTo = (id: string) =>
    requestAnimationFrame(() => {
      const el = document.getElementById(`qq-${id}`);
      if (!el) return;
      const lenis = (window as unknown as { __lenis?: { scrollTo: (el: HTMLElement, o: { offset: number }) => void } }).__lenis;
      if (lenis) lenis.scrollTo(el, { offset: -96 });
      else el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  const openOne = (id: string | null) => {
    setThanked(null);
    setOpenId(id);
    if (id) setTimeout(() => scrollTo(id), 280);
  };
  const nextAfter = (id: string) => {
    const done = new Set(answered);
    const k = list.findIndex((c) => c.id === id);
    const after = [...list.slice(k + 1), ...list.slice(0, k)].find((c) => !done.has(c.id) && c.id !== id);
    openOne(after?.id ?? null);
  };
  const onAnswered = (id: string, name?: string) => {
    if (name) setBy(name);
    setHelped(noteAnswer(id, name));
    setThanked(id);
  };
  // once they move on, the answered one takes its place at the end of the list
  const moveOn = (id: string) => {
    const done = new Set(answered);
    const k = list.findIndex((c) => c.id === id);
    const after = [...list.slice(k + 1), ...list.slice(0, k)].find((c) => !done.has(c.id) && c.id !== id);
    setAnswered((a) => Array.from(new Set([...a, id])));
    openOne(after?.id ?? null);
  };
  const close = (id: string) => {
    if (thanked === id) setAnswered((a) => Array.from(new Set([...a, id])));
    openOne(null);
  };

  return (
    <main id="content" className="pt-[4.5rem]">
      <Container className="py-12 md:py-20">
        <div className="mx-auto max-w-3xl">
        <header className="flex flex-col items-start gap-4">
          <Eyebrow
            icon={
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/images/rosa-avatar.webp" alt="" className="-ms-2 h-7 w-7 rounded-full bg-blush object-cover ring-2 ring-white" />
            }
          >
            {q.eyebrow}
          </Eyebrow>
          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="font-display text-[clamp(2.4rem,5.2vw,4rem)] font-light leading-[1.05] text-burgundy">
            {p.title}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }} className="max-w-xl text-lg leading-relaxed text-ink-soft">
            {p.lead}
          </motion.p>
          {helped > 0 && (
            <div className="flex items-center gap-3 text-[0.92rem] text-ink-soft">
              <span>{q.helped(helped)}</span>
              <Dots n={helped} />
            </div>
          )}
        </header>

        {!on ? (
          <p className="mt-12 text-ink-soft">{p.off}</p>
        ) : !cards ? (
          <p className="mt-12 text-ink-soft" role="status">
            {p.loading}
          </p>
        ) : (
          <>
            <div className="sticky top-[4.5rem] z-10 -mx-[var(--spacing-gutter)] mt-10 overflow-x-auto bg-[linear-gradient(to_bottom,var(--color-ivory)_75%,transparent)] px-[var(--spacing-gutter)] pb-5 pt-3 [scrollbar-width:none]">
              <Segmented
                label={p.filter}
                value={kind}
                onChange={(k) => (setKind(k), openOne(null))}
                className="flex-nowrap! whitespace-nowrap bg-paper/95 shadow-[0_8px_20px_-14px_rgba(70,35,45,0.35)] backdrop-blur-md"
                options={kinds.map((k) => ({
                  id: k,
                  label: (
                    <>
                      {p.kinds[k]}
                      {counts[k] > 0 && <span className="ms-1.5 text-[0.8rem] tabular-nums text-rose">{counts[k]}</span>}
                    </>
                  ),
                }))}
              />
            </div>
            <p className="text-[0.9rem] text-ink-soft">{p.count(counts[kind])}</p>

            {list.length === 0 ? (
              <p className="mt-10 text-ink-soft">{p.empty}</p>
            ) : (
              <ul className="mt-5 flex flex-col gap-3">
                {list.map((c, k) => {
                  const open = openId === c.id;
                  const done = answered.includes(c.id);
                  const kd = kindOf(c);
                  const Icon = ICON[kd];
                  const photo = c.kind === "photo-when" || c.kind === "photo-who" ? c : null;
                  const text = questionText(c, q, lang);
                  return (
                    <motion.li
                      key={c.id}
                      id={`qq-${c.id}`}
                      layout="position"
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: Math.min(k, 10) * 0.04, ease: [0.22, 1, 0.36, 1], layout: { type: "spring", visualDuration: 0.4, bounce: 0.1 } }}
                      className={cn(paper, "scroll-mt-24 overflow-hidden transition-shadow", open && "shadow-[0_22px_50px_-24px_rgba(70,35,45,0.45)] ring-1 ring-blush", done && !open && "opacity-75")}
                    >
                      <button type="button" onClick={() => (open ? close(c.id) : openOne(c.id))} aria-expanded={open} aria-label={open ? p.fold : undefined} className="flex w-full items-center gap-4 p-3 text-start sm:p-4">
                        {photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photo.src} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-[12px] bg-mount object-cover ring-1 ring-line sm:h-16 sm:w-16" />
                        ) : (
                          <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[12px] bg-blush/45 text-rose sm:h-16 sm:w-16">
                            <Icon className="h-6 w-6" strokeWidth={1.5} />
                          </span>
                        )}
                        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <span className="font-display text-[1.15rem] leading-snug text-burgundy sm:text-[1.25rem]">{text}</span>
                          <span className="flex flex-wrap items-center gap-2">
                            <Pill className="text-[0.74rem]">{p.kinds[kd]}</Pill>
                            {done && (
                              <span className="inline-flex items-center gap-1 text-[0.8rem] text-rose">
                                <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                                {p.answered}
                              </span>
                            )}
                          </span>
                        </span>
                        <span className={cn("hidden shrink-0 rounded-full px-3 py-1.5 text-[0.88rem] sm:inline-flex", open ? "text-ink-soft" : "bg-rose/10 text-burgundy")}>{open ? "" : done ? p.again : p.answer}</span>
                        <ChevronDown aria-hidden className={cn("h-5 w-5 shrink-0 text-ink-soft transition-transform duration-300", open && "rotate-180")} strokeWidth={1.6} />
                      </button>

                      <AnimatePresence initial={false}>
                        {open && (
                          <motion.div
                            key="body"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ type: "spring", visualDuration: 0.4, bounce: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-line px-4 pb-5 pt-4 sm:px-5">
                              <AnimatePresence mode="wait" initial={false}>
                                {thanked === c.id ? (
                                  <motion.div key="thanks" role="status" initial={{ opacity: 0, x: lang === "he" ? -16 : 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col gap-4">
                                    <div className="flex items-start gap-3">
                                      <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", visualDuration: 0.45, bounce: 0.45 }} className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blush/70 text-rose">
                                        <Heart className="h-[1.1rem] w-[1.1rem]" fill="currentColor" aria-hidden />
                                      </motion.span>
                                      <div className="flex flex-col gap-1">
                                        <p className="font-display text-[1.3rem] leading-snug text-burgundy">{q.thanks[helped % q.thanks.length]}</p>
                                        <p className="text-[0.9rem] text-ink-soft">{q.helped(helped)}</p>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <button type="button" onClick={() => moveOn(c.id)} className={cn(buttonClass.primary, "min-h-11 px-6")}>
                                        {p.next}
                                      </button>
                                      <button type="button" onClick={() => close(c.id)} className={cn(buttonClass.secondary, "min-h-11 px-5")}>
                                        {p.fold}
                                      </button>
                                    </div>
                                  </motion.div>
                                ) : (
                                  <motion.div key="ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex flex-col gap-3">
                                    {photo && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={photo.src} alt="" className="max-h-[22rem] w-full rounded-[14px] bg-mount object-contain ring-1 ring-line" />
                                    )}
                                    <Question bare card={c} by={by} onAnswered={(name) => onAnswered(c.id, name)} onSkip={() => nextAfter(c.id)} />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </>
        )}
        </div>
      </Container>
    </main>
  );
}
