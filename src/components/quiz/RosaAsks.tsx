"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Heart, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { STATIC, TLink } from "../Transition";
import { buttonClass, cn } from "../ui";
import { Dots, HELPED, NAME, Question, loadCards, markDone, noteAnswer, order, read, write, type Card } from "./parts";

/*
  "Grandma asks": one small card at a time, in her voice, asking something the site does not know.
  It comes once the visitor has looked around (or right after they shared or asked something),
  never over an open window, and never again the same question for the same person. After an
  answer she thanks them and offers one more; "enough for now" puts it away until a later visit.
  It can also be folded into a small round button and opened again later, and every question is
  on a page of its own (/questions) for whoever wants to choose.
*/

/** after "enough for now", she waits this long before asking again */
const REST = 8 * 60 * 60 * 1000;
/** folded away for a moment: stays folded on the next pages of this visit */
const MIN = "roza-quiz-min";

const blocked = () => !!document.querySelector('[aria-modal="true"]') || document.documentElement.hasAttribute("data-tree-full");

export default function RosaAsks() {
  const path = usePathname();
  const away = STATIC || /^\/(admin|sort|share|questions)/.test(path ?? "");
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
  const [min, setMin] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [helped, setHelped] = useState(0);
  const [opener, setOpener] = useState(0);
  const [by, setBy] = useState("");
  const loading = useRef(false);
  const sent = useRef<string | undefined>(undefined);

  const show = useCallback(
    async (force = false, engaged = false, folded = false) => {
      if (loading.current) return;
      const saved = read();
      if (!force && saved.closedAt && Date.now() - saved.closedAt < REST) return;
      loading.current = true;
      const d = await loadCards(t, sent.current);
      if (!d.on) return;
      const done = new Set(saved.done);
      const sorted = order(d.cards.filter((c) => !done.has(c.id) || c.id === sent.current), sent.current);
      if (!sorted.length) return;
      setDeck(sorted);
      setI(0);
      setPhase("ask");
      setOpener(engaged ? 3 : Math.floor(Math.random() * 3));
      setMin(folded);
      setOpen(true);
    },
    [t]
  );

  // a question sent with a link (?q=…) opens right away, even after "enough for now";
  // folded earlier in this visit: the small button is back at once on the next page
  useEffect(() => {
    let folded = false;
    try {
      setBy(localStorage.getItem(NAME) ?? "");
      setHelped(Number(sessionStorage.getItem(HELPED)) || 0);
      folded = sessionStorage.getItem(MIN) === "1";
    } catch {}
    const u = new URL(location.href);
    const want = u.searchParams.get("q");
    if (want) {
      sent.current = want;
      u.searchParams.delete("q");
      history.replaceState(history.state, "", u.pathname + u.search + u.hash);
    } else if (folded) show(true, false, true);
  }, [show]);

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

  const fold = (v: boolean) => {
    setMin(v);
    try {
      if (v) sessionStorage.setItem(MIN, "1");
      else sessionStorage.removeItem(MIN);
    } catch {}
  };
  const close = () => {
    write({ ...read(), closedAt: Date.now() });
    sent.current = undefined;
    fold(false);
    setOpen(false);
    loading.current = false;
  };
  const answered = (id: string, name?: string) => {
    if (name) setBy(name);
    setHelped(noteAnswer(id, name));
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
  const left = deck ? deck.length - i - (phase === "ask" ? 0 : 1) : 0;
  const thanks = useMemo(() => q.thanks[Math.floor(Math.random() * q.thanks.length)], [q, helped]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = open && !hidden && !!card;
  const all = (
    <TLink href="/questions" className="inline-flex min-h-10 w-fit items-center text-[0.9rem] text-burgundy underline decoration-dusty/50 decoration-1 underline-offset-[6px] transition-colors hover:decoration-burgundy">
      {q.all}
    </TLink>
  );

  return (
    <>
      {/* folded: a small round button with her face, at the same corner, to open the card again */}
      <AnimatePresence>
        {shown && min && (
          <motion.button
            key="rosa-asks-min"
            type="button"
            onClick={() => fold(false)}
            aria-label={`${q.eyebrow}: ${q.unfold}`}
            initial={{ opacity: 0, y: 16, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.85 }}
            transition={{ type: "spring", visualDuration: 0.45, bounce: 0.3 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.96 }}
            className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] end-3 z-[65] flex items-center gap-2.5 rounded-full bg-paper py-1.5 pe-4 ps-1.5 shadow-[0_14px_34px_-14px_rgba(70,35,45,0.55),0_2px_6px_rgba(70,35,45,0.08)] ring-1 ring-line md:bottom-6 md:end-6"
          >
            <span className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/rosa-avatar.webp" alt="" className="h-10 w-10 rounded-full bg-blush object-cover ring-2 ring-white" />
              {left > 0 && (
                <span aria-hidden className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose px-1 text-[0.7rem] tabular-nums text-white ring-2 ring-paper">
                  {left > 9 ? "9+" : left}
                </span>
              )}
            </span>
            <span className="flex flex-col text-start leading-tight">
              <span className="text-[0.92rem] text-burgundy">{q.eyebrow}</span>
              <span className="text-[0.78rem] text-ink-soft">{q.unfold}</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shown && (
          <motion.section
            key="rosa-asks"
            aria-label={q.eyebrow}
            aria-hidden={min || undefined}
            inert={min}
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={min ? { opacity: 0, y: 40, scale: 0.9, transitionEnd: { visibility: "hidden" } } : { opacity: 1, y: 0, scale: 1, visibility: "visible" }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: "spring", visualDuration: min ? 0.35 : 0.5, bounce: min ? 0 : 0.15 }}
            style={{ transformOrigin: lang === "he" ? "bottom left" : "bottom right" }}
            className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] z-[65] md:inset-x-auto md:bottom-6 md:end-6 md:w-[25rem]"
          >
            <motion.div
              layout
              transition={{ type: "spring", visualDuration: 0.4, bounce: 0.1 }}
              data-lenis-prevent
              className="max-h-[min(66svh,38rem)] overflow-y-auto rounded-[22px] bg-paper shadow-[0_22px_50px_-20px_rgba(70,35,45,0.5),0_2px_6px_rgba(70,35,45,0.08)] ring-1 ring-line"
            >
              <motion.div layout="position" className="flex items-center gap-2 px-4 pt-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/rosa-avatar.webp" alt="" className="me-1 h-11 w-11 shrink-0 rounded-full bg-blush object-cover ring-[3px] ring-white shadow-[0_6px_16px_-8px_rgba(118,46,73,0.5)]" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[0.8rem] text-rose">{q.eyebrow}</span>
                  {phase === "ask" && <span className="truncate text-[0.92rem] text-ink-soft">{q.openers[opener]}</span>}
                </span>
                <button type="button" onClick={() => fold(true)} aria-label={q.fold} title={q.fold} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-blush/50 hover:text-burgundy">
                  <ChevronDown className="h-5 w-5" strokeWidth={1.6} aria-hidden />
                </button>
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
                      {all}
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
    </>
  );
}
