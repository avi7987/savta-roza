"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { profile } from "@/content";
import { useLang } from "@/lib/i18n";
import { ease } from "@/lib/motion";
import { RoseBranch } from "../Botanical";
import { TLink } from "../Transition";
import { buttonClass } from "../ui";

const enter = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, delay, ease },
});

export default function Hero() {
  const { t, l, lang } = useLang();
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const photoY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -70]);
  const branchY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -30]);


  return (
    <section id="top" ref={ref} aria-labelledby="hero-title" className="relative overflow-hidden pb-[clamp(4rem,9vw,8rem)] pt-[calc(4.5rem+env(safe-area-inset-top,0px))]">
      {/* soft daylight from the window side */}
      <div aria-hidden className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black_55%,transparent)] bg-[radial-gradient(60rem_40rem_at_85%_0%,rgba(232,212,211,0.55),transparent_70%),radial-gradient(40rem_30rem_at_0%_100%,rgba(167,181,160,0.12),transparent_70%)] rtl:bg-[radial-gradient(60rem_40rem_at_15%_0%,rgba(232,212,211,0.55),transparent_70%),radial-gradient(40rem_30rem_at_100%_100%,rgba(167,181,160,0.12),transparent_70%)]" />

      <div className="relative mx-auto grid max-w-[96rem] items-center gap-y-14 px-[var(--spacing-gutter)] pt-8 md:grid-cols-12 md:gap-x-8 md:pt-6 lg:min-h-[calc(100svh-4.5rem)]">
        {/* words */}
        <div key={lang} className="order-2 flex flex-col md:order-1 md:col-span-6 lg:col-span-5 lg:col-start-1">
          <motion.p {...enter(0.15)} className="font-hand text-[1.7rem] leading-none text-rose">
            {l(profile.kicker)}
          </motion.p>
          <motion.h1
            id="hero-title"
            initial={{ opacity: 0, y: 26, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1.2, delay: 0.25, ease }}
            className="mt-4 text-[clamp(3.6rem,9.5vw,8.5rem)] font-light leading-[0.95] text-burgundy"
          >
            {l(profile.name)}
          </motion.h1>
          {profile.years && (
            <motion.p {...enter(0.45)} className="mt-4 font-display text-xl tracking-wide text-ink-soft">
              {l(profile.years)}
            </motion.p>
          )}
          <motion.div {...enter(0.5)} className="mt-8 flex items-center gap-4">
            <span aria-hidden className="hidden h-px w-14 shrink-0 bg-dusty sm:block" />
            <p className="font-display text-[clamp(1.35rem,2.2vw,1.85rem)] leading-snug text-charcoal">{l(profile.dedication)}</p>
          </motion.div>
          <motion.p {...enter(0.62)} className="mt-6 max-w-[30rem] text-[1.08rem] leading-[1.85] text-ink-soft">
            {l(profile.intro)}
          </motion.p>
          <motion.div {...enter(0.75)} className="mt-10 flex flex-wrap items-center gap-3">
            <TLink href="/#story" className={buttonClass.primary}>
              {t.hero.primary}
            </TLink>
            <TLink href="/share" className={buttonClass.secondary}>
              {t.hero.secondary}
            </TLink>
          </motion.div>
        </div>

        {/* the photograph */}
        <div className="relative order-1 md:order-2 md:col-span-6 lg:col-span-6 lg:col-start-7">
          <div className="relative mx-auto w-[78%] max-w-[min(30rem,calc((100svh_-_19rem)*0.8))] md:w-[74%]">
            <motion.div style={{ y: branchY }} className="pointer-events-none absolute -end-[26%] top-[8%] z-0 hidden h-[88%] w-[40%] md:block" aria-hidden>
              <RoseBranch className="h-full w-full" delay={0.6} />
            </motion.div>

            <motion.figure style={{ y: photoY }} className="relative z-10">
              <motion.div
                aria-hidden
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.4, delay: 0.2, ease }}
                className="absolute inset-x-[4%] bottom-[2%] top-[4%] rounded-full bg-[radial-gradient(circle_at_50%_42%,#efdcd9_0%,#e8d4d3_52%,rgba(232,212,211,0)_71%)]"
              />
              <motion.img
                src="/images/rosa-portrait.webp"
                alt={t.hero.portraitAlt}
                width={900}
                height={862}
                fetchPriority="high"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.3, delay: 0.35, ease }}
                className="relative block h-auto w-full"
              />
              <figcaption className="relative mt-1 text-center text-[0.8rem] text-ink-soft">{t.hero.portraitNote}</figcaption>
            </motion.figure>
          </div>
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4, duration: 1 }} className="mx-auto mt-14 hidden max-w-[96rem] items-center gap-4 px-[var(--spacing-gutter)] text-[0.82rem] text-ink-soft lg:flex">
        <span aria-hidden className="h-px w-10 bg-charcoal/25" />
        {t.hero.scroll}
      </motion.div>
    </section>
  );
}
