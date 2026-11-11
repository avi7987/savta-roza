"use client";

import { AnimatePresence, motion, useInView, useScroll, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CalendarHeart, Check, Home, Play, Users, Wand2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { PhotoFill, SectionHead, cn } from "./ui";

const icons = { year: CalendarHeart, place: Home, people: Users } as const;
const DURATION = 14000;

export default function VideoInsight() {
  const { t, lang } = useLang();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px" });
  const [p, setP] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: stage, offset: ["start end", "start 25%"] });
  const sp = useSpring(scrollYProgress, { stiffness: 90, damping: 20 });
  const scale = useTransform(sp, [0, 1], [0.72, 1]);
  const rotateX = useTransform(sp, [0, 1], [28, 0]);
  const radius = useTransform(sp, [0, 1], [80, 32]);
  const panelX = useTransform(sp, [0.4, 1], [120, 0]);
  const panelO = useTransform(sp, [0.4, 1], [0, 1]);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now() - p * DURATION;
    const tick = (now: number) => {
      setP(((now - start) % DURATION) / DURATION);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  const lines = t.video.lines;
  const lineIdx = Math.min(lines.length - 1, Math.floor(p * 0.8 * lines.length));
  const chipsShown = p > 0.5 ? Math.min(3, Math.floor((p - 0.5) / 0.08) + 1) : 0;
  const added = p > 0.78;

  return (
    <section id="videos" className="relative z-10 overflow-hidden py-28">
      <SectionHead title={t.video.title} sub={t.video.sub} />
      <div ref={stage} className="mx-auto mt-14 grid max-w-6xl gap-6 px-5 [perspective:1400px] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* player */}
        <motion.div
          ref={ref}
          style={{ scale, rotateX, borderRadius: radius }}
          className="relative origin-bottom overflow-hidden bg-ink shadow-[0_40px_100px_-40px_rgba(163,22,74,0.6)]"
        >
          <motion.div animate={{ scale: 1 + p * 0.12 }} transition={{ ease: "linear", duration: 0.1 }} className="aspect-video">
            <PhotoFill seed={5} className="h-full w-full" />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 p-6">
            <AnimatePresence mode="wait">
              <motion.p
                key={`${lineIdx}-${lang}`}
                initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8 }}
                className="max-w-xl text-xl font-medium text-white sm:text-2xl"
              >
                {lines[lineIdx]}
              </motion.p>
            </AnimatePresence>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink">
                <Play className="h-5 w-5" aria-hidden />
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25" dir="ltr">
                <div className="h-full rounded-full bg-gradient-to-r from-rosa to-honey" style={{ width: `${p * 100}%` }} />
              </div>
              <span className="text-sm tabular-nums text-white/80" dir="ltr">
                0{Math.floor((p * 260) / 60)}:{String(Math.floor(p * 260) % 60).padStart(2, "0")}
              </span>
            </div>
          </div>
        </motion.div>

        {/* AI panel */}
        <motion.div style={{ x: panelX, opacity: panelO }} className="flex flex-col gap-4">
          <div className="rounded-[2rem] bg-white p-6 ring-1 ring-ink/5 shadow-[0_20px_60px_-30px_rgba(42,31,36,0.3)]">
            <h3 className="mb-3 text-sm font-medium tracking-wide text-ink-soft">{t.video.transcript}</h3>
            <ul className="flex flex-col gap-2">
              {lines.map((l, i) => (
                <li
                  key={i}
                  className={cn(
                    "rounded-xl px-3 py-2 text-[15px] leading-snug transition-all duration-500",
                    i === lineIdx ? "bg-blush text-ink" : i < lineIdx ? "text-ink-soft" : "text-ink/30"
                  )}
                >
                  {l}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-ink to-[#4a2335] p-6 text-white">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-white/80">
              <Wand2 className="h-4 w-4 text-honey" aria-hidden />
              {t.video.found}
            </h3>
            <div className="flex min-h-12 flex-wrap gap-2">
              <AnimatePresence>
                {t.video.chips.slice(0, chipsShown).map((c) => {
                  const Icon = icons[c.kind as keyof typeof icons];
                  return (
                    <motion.span
                      key={`${c.kind}-${lang}`}
                      initial={{ opacity: 0, scale: 0.6, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ type: "spring", stiffness: 300, damping: 18 }}
                      className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm ring-1 ring-white/20"
                    >
                      <Icon className="h-4 w-4 text-petal" aria-hidden />
                      {c.label}
                    </motion.span>
                  );
                })}
              </AnimatePresence>
            </div>
            <AnimatePresence>
              {added && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-sage px-4 py-2 text-sm text-white"
                >
                  <Check className="h-4 w-4" aria-hidden />
                  {t.video.added}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
