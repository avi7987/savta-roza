"use client";

import { AnimatePresence, motion, useMotionValue, useTransform } from "motion/react";
import { useState } from "react";
import { Heart, RefreshCcw } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { PhotoFill, SectionHead } from "./ui";

const CARDS = [11, 12, 13, 14];

function Burst() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.6, rotate: 0 }}
            animate={{ x: Math.cos(a) * 180, y: Math.sin(a) * 180, opacity: 0, scale: 1.2, rotate: 200 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            className="absolute h-4 w-3 rounded-[60%_40%_60%_40%] bg-rosa"
            style={{ backgroundColor: i % 3 === 0 ? "#f3c77a" : i % 2 ? "#f7a8c4" : "#e0457b" }}
          />
        );
      })}
    </div>
  );
}

function Card({ seed, onDone, top, depth }: { seed: number; onDone: (dir: number) => void; top: boolean; depth: number }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-14, 14]);
  return (
    <motion.div
      drag={top ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 110) onDone(Math.sign(info.offset.x));
      }}
      style={{ x, rotate, zIndex: 10 - depth }}
      initial={{ scale: 0.9, y: 30, opacity: 0 }}
      animate={{ scale: 1 - depth * 0.05, y: depth * 16, opacity: depth > 2 ? 0 : 1 }}
      exit={{ x: 400, opacity: 0, rotate: 20, transition: { duration: 0.4 } }}
      className="absolute inset-0 cursor-grab touch-pan-y rounded-[2rem] bg-white p-3 shadow-[0_30px_70px_-30px_rgba(42,31,36,0.5)] ring-1 ring-ink/5 active:cursor-grabbing"
    >
      <PhotoFill seed={seed} className="h-full w-full rounded-[1.5rem] [filter:sepia(0.45)]" />
    </motion.div>
  );
}

export default function HelpSwipe() {
  const { t } = useLang();
  const [idx, setIdx] = useState(0);
  const [burst, setBurst] = useState(0);
  const [thanks, setThanks] = useState(false);
  const remaining = CARDS.slice(idx);

  const next = (answered: boolean) => {
    if (answered) {
      setBurst((b) => b + 1);
      setThanks(true);
      setTimeout(() => setThanks(false), 1600);
    }
    setIdx((i) => i + 1);
  };

  return (
    <section id="help" className="relative bg-gradient-to-b from-cream to-blush/60 py-28">
      <SectionHead title={t.help.title} sub={t.help.sub} />
      <div className="mx-auto mt-14 grid max-w-5xl items-center gap-10 px-5 md:grid-cols-2">
        <div className="relative mx-auto aspect-[4/5] w-full max-w-sm">
          <AnimatePresence>
            {remaining
              .slice(0, 3)
              .reverse()
              .map((seed) => {
                const depth = remaining.indexOf(seed);
                return <Card key={seed} seed={seed} depth={depth} top={depth === 0} onDone={() => next(false)} />;
              })}
          </AnimatePresence>
          {burst > 0 && <Burst key={burst} />}
          {remaining.length === 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 flex flex-col items-center justify-center gap-5 rounded-[2rem] bg-white text-center ring-1 ring-ink/5">
              <Heart className="h-12 w-12 fill-rosa text-rosa" aria-hidden />
              <p className="px-6 text-2xl font-bold text-ink">{t.help.done}</p>
              <button type="button" onClick={() => setIdx(0)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-white">
                <RefreshCcw className="h-4 w-4" aria-hidden />
                {t.help.again}
              </button>
            </motion.div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <p className="text-3xl font-bold leading-tight text-ink">{t.help.q}</p>
          <div className="grid grid-cols-3 gap-3">
            {t.help.decades.map((d) => (
              <motion.button
                key={d}
                type="button"
                disabled={remaining.length === 0}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => next(true)}
                className="min-h-14 rounded-2xl bg-white text-lg font-medium text-ink ring-1 ring-ink/10 transition-colors hover:bg-rosa hover:text-white disabled:opacity-40"
              >
                {t.album.decadeLabel(d)}
              </motion.button>
            ))}
          </div>
          <button type="button" onClick={() => next(false)} disabled={remaining.length === 0} className="w-fit py-2 text-ink-soft underline underline-offset-4 hover:text-ink disabled:opacity-40">
            {t.help.skip}
          </button>
          <div className="h-12" aria-live="polite">
            <AnimatePresence>
              {thanks && (
                <motion.span
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="inline-flex items-center gap-2 rounded-full bg-sage px-5 py-3 text-white"
                >
                  <Heart className="h-4 w-4 fill-white" aria-hidden />
                  {t.help.thanks}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
