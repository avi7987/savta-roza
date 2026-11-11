"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BadgeCheck, MessageCircle, Plus, Sparkles } from "lucide-react";
import { useLang } from "@/lib/i18n";
import type { Conf } from "@/lib/dict";
import { PhotoFill, ShimmerLink, cn } from "./ui";
import { Spotlight } from "./fx";

gsap.registerPlugin(ScrollTrigger);

const confStyle: Record<Conf, { cls: string; Icon: typeof BadgeCheck }> = {
  exact: { cls: "bg-sage-soft text-sage", Icon: BadgeCheck },
  witness: { cls: "bg-blush text-rosa-deep", Icon: MessageCircle },
  est: { cls: "bg-honey/25 text-[#8a5a12]", Icon: Sparkles },
};

/**
 * Pinned horizontal story: scrolling down slides the chapters sideways (right-to-left reading in Hebrew),
 * giant years drift at their own speed, cards rise in as they arrive.
 */
export default function Timeline() {
  const { t, dir, lang } = useLang();
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const progress = useMotionValue(0);
  const bar = useSpring(progress, { stiffness: 200, damping: 30 });

  useLayoutEffect(() => {
    const rtl = dir === "rtl";
    const sign = rtl ? 1 : -1;
    const ctx = gsap.context(() => {
      const tr = track.current!;
      const dist = () => Math.max(0, tr.scrollWidth - window.innerWidth);
      const tween = gsap.to(tr, {
        x: () => sign * dist(),
        ease: "none",
        scrollTrigger: {
          trigger: section.current,
          pin: true,
          scrub: 1,
          start: "top top",
          end: () => `+=${dist()}`,
          invalidateOnRefresh: true,
          onUpdate: (s) => progress.set(s.progress),
        },
      });
      const enter = rtl ? "right left" : "left right";
      const leave = rtl ? "left right" : "right left";
      gsap.utils.toArray<HTMLElement>("[data-year]").forEach((el) => {
        gsap.fromTo(el, { xPercent: -sign * 30 }, { xPercent: sign * 30, ease: "none", scrollTrigger: { trigger: el, containerAnimation: tween, start: enter, end: leave, scrub: true } });
      });
      gsap.utils.toArray<HTMLElement>("[data-rise]").forEach((el) => {
        gsap.from(el, {
          y: 120,
          rotate: rtl ? -4 : 4,
          opacity: 0,
          ease: "power2.out",
          scrollTrigger: { trigger: el, containerAnimation: tween, start: rtl ? "right 10%" : "left 90%", end: rtl ? "right 55%" : "left 45%", scrub: true },
        });
      });
      gsap.utils.toArray<HTMLElement>("[data-photo]").forEach((el, i) => {
        gsap.fromTo(
          el,
          { y: 80 + (i % 3) * 40, rotate: (i % 2 ? 1 : -1) * 18, scale: 0.7 },
          {
            y: 0,
            rotate: Number(el.dataset.photo),
            scale: 1,
            ease: "back.out(1.4)",
            scrollTrigger: { trigger: el, containerAnimation: tween, start: rtl ? "right 0%" : "left 100%", end: rtl ? "right 50%" : "left 50%", scrub: true },
          }
        );
      });
    }, section);
    const fontsReady = (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
    fontsReady?.then(() => ScrollTrigger.refresh());
    return () => ctx.revert();
  }, [dir, lang, progress]);

  const ev = t.timeline.events;

  return (
    <section id="timeline" ref={section} className="relative z-10 h-[100svh] overflow-hidden bg-gradient-to-b from-cream via-blush/60 to-cream">
      <div ref={track} className="flex h-full w-max items-center gap-[6vw] ps-[6vw] pe-[10vw]">
        {/* intro panel */}
        <div className="flex w-[80vw] shrink-0 flex-col gap-5 sm:w-[55vw] lg:w-[38vw]">
          <span className="w-fit rounded-full bg-white/80 px-4 py-1 text-sm text-rosa-deep ring-1 ring-rosa/10">{t.timeline.sample}</span>
          <h2 className="text-6xl font-black leading-none tracking-tight text-ink sm:text-8xl">{t.timeline.title}</h2>
          <p className="max-w-md text-lg leading-relaxed text-ink-soft">{t.timeline.sub}</p>
          <div className="flex items-center gap-3 text-sm text-ink-soft">
            <motion.span animate={{ x: dir === "rtl" ? [0, -14, 0] : [0, 14, 0] }} transition={{ repeat: Infinity, duration: 1.6 }} className="text-2xl text-rosa">
              {dir === "rtl" ? "←" : "→"}
            </motion.span>
            {t.timeline.drag}
          </div>
        </div>

        {ev.map((e, i) => {
          const c = confStyle[e.conf];
          return (
            <article key={`${e.year}-${lang}`} className="relative flex h-[72vh] w-[86vw] shrink-0 items-center sm:w-[70vw] lg:w-[58vw]">
              <span
                data-year
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-center text-[34vw] font-black leading-none tracking-tighter text-transparent [-webkit-text-stroke:2px_rgba(224,69,123,0.35)] lg:text-[22vw]"
              >
                {e.year}
              </span>
              <div className="relative grid w-full items-center gap-6 lg:grid-cols-2">
                <div data-rise>
                  <Spotlight className="rounded-[2rem]">
                    <div className="flex flex-col gap-4 rounded-[2rem] bg-white/85 p-6 shadow-[0_40px_90px_-40px_rgba(163,22,74,0.5)] ring-1 ring-ink/5 backdrop-blur sm:p-8">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-4xl font-black tracking-tight text-rosa-deep">{e.year}</span>
                        <span className="font-hand text-4xl font-bold text-rosa">{e.chapter}</span>
                      </div>
                      <h3 className="text-3xl font-bold tracking-tight text-ink">{e.title}</h3>
                      <p className="text-lg leading-relaxed text-ink-soft">{e.body}</p>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm", c.cls)}>
                          <c.Icon className="h-4 w-4" aria-hidden />
                          {t.timeline.conf[e.conf]}
                        </span>
                        <span className="text-sm text-ink-soft">{e.source}</span>
                      </div>
                    </div>
                  </Spotlight>
                </div>
                <div className="relative hidden h-80 lg:block">
                  {[0, 1, 2].map((k) => {
                    const rot = (k - 1) * 7 + (e.hue % 2 ? 3 : -3);
                    return (
                      <div
                        key={k}
                        data-photo={rot}
                        className="absolute w-[46%] rounded-2xl bg-white p-2 pb-7 shadow-2xl ring-1 ring-ink/5"
                        style={{ insetInlineStart: `${k * 26}%`, top: `${[10, 0, 22][k]}%` }}
                      >
                        <div className="animate-[floaty_6s_ease-in-out_infinite]" style={{ animationDelay: `${-k * 2}s` }}>
                          <PhotoFill seed={e.hue * 3 + k} className="aspect-[4/5] rounded-xl" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </article>
          );
        })}

        {/* closing panel */}
        <div data-rise className="flex w-[80vw] shrink-0 flex-col items-start gap-5 sm:w-[50vw] lg:w-[34vw]">
          <h3 className="text-5xl font-black leading-tight tracking-tight text-ink sm:text-6xl">{t.timeline.end}</h3>
          <p className="text-lg text-ink-soft">{t.timeline.endSub}</p>
          <ShimmerLink href="/upload">
            <Plus className="h-5 w-5" aria-hidden />
            {t.add}
          </ShimmerLink>
        </div>
      </div>

      {/* progress rail with chapter dots */}
      <div className="absolute inset-x-[6vw] bottom-8 flex items-center gap-4" dir={dir}>
        <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-ink/10">
          <motion.div style={{ scaleX: bar }} className="absolute inset-0 origin-left rounded-full bg-gradient-to-r from-rosa to-honey rtl:origin-right" />
        </div>
        <div className="flex gap-3 text-sm font-medium text-ink-soft" dir="ltr">
          {ev.map((e) => (
            <span key={e.year}>{e.year}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
