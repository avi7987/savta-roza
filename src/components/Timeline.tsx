"use client";

import { AnimatePresence, motion, useScroll, useSpring } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BadgeCheck, MessageCircle, Sparkles } from "lucide-react";
import { useLang } from "@/lib/i18n";
import type { Conf } from "@/lib/dict";
import { PhotoFill, SectionHead, cn } from "./ui";

gsap.registerPlugin(ScrollTrigger);

const confStyle: Record<Conf, { cls: string; Icon: typeof BadgeCheck }> = {
  exact: { cls: "bg-sage-soft text-sage", Icon: BadgeCheck },
  witness: { cls: "bg-blush text-rosa-deep", Icon: MessageCircle },
  est: { cls: "bg-honey/25 text-[#8a5a12]", Icon: Sparkles },
};

export default function Timeline() {
  const { t, lang } = useLang();
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: listRef, offset: ["start 60%", "end 60%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  useEffect(() => {
    const els = listRef.current?.querySelectorAll<HTMLElement>("[data-idx]");
    if (!els) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.idx));
        });
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [lang]);

  // GSAP parallax on the floating photo layers
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
        const depth = Number(el.dataset.parallax);
        gsap.fromTo(el, { y: 60 * depth }, { y: -60 * depth, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
      });
    }, listRef);
    return () => ctx.revert();
  }, [lang]);

  const ev = t.timeline.events;

  return (
    <section id="timeline" className="relative bg-gradient-to-b from-cream via-blush/50 to-cream py-28">
      <SectionHead eyebrow={t.timeline.sample} title={t.timeline.title} sub={t.timeline.sub} />

      <div className="mx-auto mt-16 grid max-w-6xl gap-10 px-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* sticky giant year */}
        <div className="hidden lg:block">
          <div className="sticky top-32 flex h-[60vh] flex-col justify-center">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={`${ev[active].year}-${lang}`}
                initial={{ opacity: 0, y: 60, filter: "blur(16px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -60, filter: "blur(16px)" }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-2"
              >
                <span className="font-hand text-5xl font-bold text-rosa">{ev[active].chapter}</span>
                <span className="bg-gradient-to-b from-rosa-deep to-petal bg-clip-text text-[10rem] font-black leading-none tracking-tighter text-transparent">
                  {ev[active].year}
                </span>
              </motion.div>
            </AnimatePresence>
            <div className="mt-8 flex gap-2" aria-hidden>
              {ev.map((_, i) => (
                <motion.span key={i} animate={{ width: i === active ? 40 : 10, opacity: i === active ? 1 : 0.35 }} className="h-2.5 rounded-full bg-rosa" />
              ))}
            </div>
          </div>
        </div>

        <ol ref={listRef} className="relative flex flex-col gap-24 ps-10">
          <span aria-hidden className="absolute inset-y-0 start-3 w-0.5 rounded-full bg-ink/10" />
          <motion.span aria-hidden style={{ scaleY: progress }} className="absolute inset-y-0 start-3 w-0.5 origin-top rounded-full bg-gradient-to-b from-rosa to-honey" />
          {ev.map((e, i) => {
            const c = confStyle[e.conf];
            return (
              <li key={`${e.year}-${lang}`} data-idx={i} className="relative">
                <motion.span
                  aria-hidden
                  animate={{ scale: i === active ? 1.35 : 1, backgroundColor: i <= active ? "#e0457b" : "#ffffff" }}
                  className="absolute -start-[2.15rem] top-3 h-4 w-4 rounded-full border-2 border-rosa"
                />
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-15% 0px" }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "relative rounded-[2rem] bg-white/80 p-6 shadow-[0_30px_80px_-40px_rgba(163,22,74,0.45)] ring-1 ring-ink/5 backdrop-blur transition-transform duration-500 sm:p-8",
                    i === active && "lg:-translate-y-1"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-3xl font-black text-rosa-deep lg:hidden">{e.year}</span>
                    <span className="font-hand text-3xl font-bold text-rosa lg:hidden">{e.chapter}</span>
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm", c.cls)}>
                      <c.Icon className="h-4 w-4" aria-hidden />
                      {t.timeline.conf[e.conf]}
                    </span>
                  </div>
                  <h3 className="mt-4 text-3xl font-bold tracking-tight text-ink">{e.title}</h3>
                  <p className="mt-2 text-lg leading-relaxed text-ink-soft">{e.body}</p>
                  <div className="relative mt-6 h-44">
                    {[0, 1, 2].map((k) => (
                      <div
                        key={k}
                        data-parallax={k + 1}
                        className="absolute top-0 rounded-2xl bg-white p-2 pb-6 shadow-xl ring-1 ring-ink/5"
                        style={{ insetInlineStart: `${k * 30}%`, rotate: `${(k - 1) * 5 + (e.hue % 2 ? 2 : -2)}deg`, width: "38%" }}
                      >
                        <PhotoFill seed={e.hue * 3 + k} className="h-28 rounded-xl" />
                      </div>
                    ))}
                  </div>
                  <p className="mt-6 text-sm text-ink-soft">{e.source}</p>
                </motion.div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
