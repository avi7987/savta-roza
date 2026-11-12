"use client";

import { motion } from "motion/react";
import { notes } from "@/content";
import type { Note } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { ease } from "@/lib/motion";
import { RoseBud } from "../Botanical";
import { Container, PlaceholderTag, SectionIntro, cn } from "../ui";

const tilt = [-1.6, 1.2, -0.8, 1.8];

function Paper({ n, i }: { n: Note; i: number }) {
  const { l } = useLang();
  const common = "relative flex flex-col gap-5 shadow-[var(--shadow-paper)]";

  const body =
    n.kind === "quote" ? (
      <div className={cn(common, "bg-transparent px-2 py-6 shadow-none")}>
        <span aria-hidden className="font-display text-7xl leading-[0.5] text-dusty">“</span>
        <blockquote className="font-display text-[clamp(1.7rem,2.8vw,2.4rem)] font-light leading-[1.3] text-burgundy">{l(n.text)}</blockquote>
        {n.from && <span className="font-hand text-xl text-rose">— {l(n.from)}</span>}
      </div>
    ) : n.kind === "letter" ? (
      <div className={cn(common, "folded bg-[#fffdf9] px-7 py-9 sm:px-10")}>
        <span className="label">{n.from && l(n.from)}</span>
        <p className="font-display text-[1.25rem] leading-[1.8] text-charcoal/90">{l(n.text)}</p>
        <RoseBud className="absolute -bottom-3 end-6 h-12 w-8 opacity-70" />
      </div>
    ) : (
      <div className={cn(common, "ruled bg-[#fdfaf6] px-7 pb-8 pt-[30px] sm:px-9")}>
        <p className="font-hand text-[1.6rem] leading-[32px] text-charcoal/85">{l(n.text)}</p>
        {n.from && <span className="text-[0.85rem] leading-8 text-ink-soft">{l(n.from)}</span>}
      </div>
    );

  return (
    <motion.figure
      initial={{ opacity: 0, y: 30, rotate: 0 }}
      whileInView={{ opacity: 1, y: 0, rotate: n.kind === "quote" ? 0 : tilt[i % tilt.length] }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 1, ease, delay: i * 0.1 }}
      className="flex flex-col gap-3"
    >
      {body}
      {n.placeholder && <PlaceholderTag short className="ms-2" />}
    </motion.figure>
  );
}

export default function Letters() {
  const { t } = useLang();
  const [quote, letter, note, message] = notes;
  return (
    <section id="letters" aria-labelledby="letters-title" className="overflow-hidden bg-blush/35 py-[var(--spacing-section)]">
      <Container>
        <SectionIntro id="letters-title" eyebrow={t.letters.eyebrow} title={t.letters.title} lead={t.letters.lead} layout="split" />
        <div className="mt-16 grid items-start gap-x-10 gap-y-14 md:grid-cols-12">
          {quote && (
            <div className="md:col-span-6">
              <Paper n={quote} i={0} />
            </div>
          )}
          {letter && (
            <div className="md:col-span-5 md:col-start-8 md:mt-16">
              <Paper n={letter} i={1} />
            </div>
          )}
          {note && (
            <div className="md:col-span-4 md:col-start-2">
              <Paper n={note} i={2} />
            </div>
          )}
          {message && (
            <div className="md:col-span-5 md:col-start-7 md:-mt-6">
              <Paper n={message} i={3} />
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
