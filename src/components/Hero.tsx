"use client";

import dynamic from "next/dynamic";
import { motion, useInView, useScroll, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { BlurText, ShimmerLink } from "./ui";
import { Magnetic } from "./fx";
import { useSite } from "./Transition";

const RoseScene = dynamic(() => import("./RoseScene"), { ssr: false });

export default function Hero() {
  const { t, dir, lang } = useLang();
  const { ready } = useSite();
  const ref = useRef<HTMLElement>(null);
  const [wide, setWide] = useState(true);
  const inView = useInView(ref);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 80, damping: 20 });
  const textY = useTransform(smooth, [0, 1], [0, -160]);
  const textScale = useTransform(smooth, [0, 1], [1, 0.9]);
  const blur = useTransform(smooth, [0, 0.7], ["blur(0px)", "blur(10px)"]);
  const fade = useTransform(smooth, [0, 0.75], [1, 0]);
  const tracking = useTransform(smooth, [0, 1], ["-0.02em", "0.12em"]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const roseX = wide ? (dir === "rtl" ? -1.55 : 1.55) : 0;

  return (
    <section ref={ref} className="relative h-[135svh]">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 start-[-10%] h-[38rem] w-[38rem] animate-aurora rounded-full bg-petal/60 blur-3xl" />
          <div className="absolute top-1/3 end-[-15%] h-[34rem] w-[34rem] animate-aurora rounded-full bg-honey/30 blur-3xl [animation-delay:-6s]" />
          <div className="absolute bottom-[-20%] start-1/3 h-[30rem] w-[30rem] animate-aurora rounded-full bg-sage-soft blur-3xl [animation-delay:-12s]" />
        </div>

        <div className="absolute inset-0">
          <RoseScene roseX={roseX} active={inView} compact={!wide} ready={ready} scroll={smooth} />
        </div>

        <motion.div
          style={{ y: textY, scale: textScale, opacity: fade, filter: blur }}
          className="relative z-10 mx-auto flex h-full max-w-6xl items-end px-5 pb-20 pt-32 lg:items-center lg:pb-0"
        >
          {ready && (
            <div className="flex max-w-xl flex-col gap-6 rounded-[2rem] bg-cream/40 p-2 backdrop-blur-[2px] lg:bg-transparent lg:backdrop-blur-0">
              <motion.span
                key={`k-${lang}`}
                initial={{ opacity: 0, y: 10, rotate: -4 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ delay: 0.2, duration: 0.8 }}
                className="w-fit font-hand text-4xl font-bold text-rosa sm:text-5xl"
              >
                {t.hero.kicker}
              </motion.span>
              <motion.div style={{ letterSpacing: tracking }}>
                <BlurText
                  key={`t-${lang}`}
                  as="h1"
                  text={t.hero.title}
                  delay={0.3}
                  className="bg-gradient-to-br from-ink via-rosa-deep to-rosa bg-clip-text pb-2 text-6xl font-black leading-[1.02] text-transparent sm:text-8xl"
                />
              </motion.div>
              <BlurText key={`s-${lang}`} as="p" text={t.hero.subtitle} delay={0.7} className="text-2xl font-medium text-ink sm:text-3xl" />
              <motion.p
                key={`i-${lang}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1, duration: 0.9 }}
                className="text-lg leading-relaxed text-ink-soft"
              >
                {t.hero.intro}
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.35, duration: 0.9 }} className="flex flex-wrap gap-3">
                <ShimmerLink href="/upload">
                  <Plus className="h-5 w-5" aria-hidden />
                  {t.add}
                </ShimmerLink>
                <Magnetic>
                  <a
                    href="#timeline"
                    className="inline-flex min-h-12 items-center rounded-full bg-white/80 px-7 text-base font-medium text-ink ring-1 ring-ink/10 backdrop-blur transition hover:bg-white"
                  >
                    {t.hero.cta2}
                  </a>
                </Magnetic>
              </motion.div>
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }} className="w-fit rounded-full bg-white/70 px-3 py-1 text-xs text-ink-soft ring-1 ring-ink/5">
                {t.demo}
              </motion.span>
            </div>
          )}
        </motion.div>

        <motion.a
          href="#memories"
          aria-label={t.hero.scroll}
          style={{ opacity: fade }}
          className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 text-sm text-ink-soft lg:flex"
        >
          {t.hero.scroll}
          <span className="flex h-10 w-6 justify-center rounded-full border border-ink/25 pt-2">
            <motion.span animate={{ y: [0, 12, 0], opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 1.8 }} className="h-2 w-1 rounded-full bg-rosa" />
          </span>
        </motion.a>
      </div>
    </section>
  );
}
