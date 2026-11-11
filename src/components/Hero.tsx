"use client";

import dynamic from "next/dynamic";
import { motion, useInView, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, Plus } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { BlurText, ShimmerLink } from "./ui";

const RoseScene = dynamic(() => import("./RoseScene"), { ssr: false });

export default function Hero() {
  const { t, dir, lang } = useLang();
  const ref = useRef<HTMLElement>(null);
  const [wide, setWide] = useState(true);
  const inView = useInView(ref);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const textY = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const roseX = wide ? (dir === "rtl" ? -1.55 : 1.55) : 0;

  return (
    <section ref={ref} className="relative min-h-[100svh] overflow-hidden">
      {/* aurora background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 start-[-10%] h-[38rem] w-[38rem] animate-aurora rounded-full bg-petal/60 blur-3xl" />
        <div className="absolute top-1/3 end-[-15%] h-[34rem] w-[34rem] animate-aurora rounded-full bg-honey/30 blur-3xl [animation-delay:-6s]" />
        <div className="absolute bottom-[-20%] start-1/3 h-[30rem] w-[30rem] animate-aurora rounded-full bg-sage-soft blur-3xl [animation-delay:-12s]" />
      </div>

      <motion.div style={{ opacity: fade }} className="absolute inset-0">
        <RoseScene roseX={roseX} active={inView} compact={!wide} />
      </motion.div>

      <motion.div
        style={{ y: textY, opacity: fade }}
        className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl items-end px-5 pb-24 pt-32 lg:items-center lg:pb-0"
      >
        <div className="flex max-w-xl flex-col gap-6 rounded-[2rem] bg-cream/40 p-2 backdrop-blur-[2px] lg:bg-transparent lg:backdrop-blur-0">
          <motion.span
            key={`k-${lang}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="font-hand text-4xl font-bold text-rosa sm:text-5xl"
          >
            {t.hero.kicker}
          </motion.span>
          <BlurText
            key={`t-${lang}`}
            as="h1"
            text={t.hero.title}
            delay={0.5}
            className="bg-gradient-to-br from-ink via-rosa-deep to-rosa bg-clip-text pb-2 text-6xl font-black leading-[1.02] tracking-tight text-transparent sm:text-8xl"
          />
          <BlurText key={`s-${lang}`} as="p" text={t.hero.subtitle} delay={0.9} className="text-2xl font-medium text-ink sm:text-3xl" />
          <motion.p
            key={`i-${lang}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.3, duration: 0.9 }}
            className="text-lg leading-relaxed text-ink-soft"
          >
            {t.hero.intro}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6, duration: 0.9 }} className="flex flex-wrap gap-3">
            <ShimmerLink href="/upload">
              <Plus className="h-5 w-5" aria-hidden />
              {t.add}
            </ShimmerLink>
            <a
              href="#timeline"
              className="inline-flex min-h-12 items-center rounded-full bg-white/80 px-7 text-base font-medium text-ink ring-1 ring-ink/10 backdrop-blur transition hover:bg-white"
            >
              {t.hero.cta2}
            </a>
          </motion.div>
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="w-fit rounded-full bg-white/70 px-3 py-1 text-xs text-ink-soft ring-1 ring-ink/5">
            {t.demo}
          </motion.span>
        </div>
      </motion.div>

      <motion.a
        href="#memories"
        style={{ opacity: fade }}
        className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 text-sm text-ink-soft lg:flex"
      >
        {t.hero.scroll}
        <motion.span animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.8 }}>
          <ArrowDown className="h-5 w-5" aria-hidden />
        </motion.span>
      </motion.a>
    </section>
  );
}
