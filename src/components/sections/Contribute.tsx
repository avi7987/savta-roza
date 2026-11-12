"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { photos } from "@/content";
import { useLang } from "@/lib/i18n";
import { ease } from "@/lib/motion";
import ArchivalImage from "../ArchivalImage";
import { TLink } from "../Transition";
import { Container, Item, Reveal, cn } from "../ui";

const DECADES = ["40", "50", "60", "70", "80", "90", "00"];

/** "Help us remember": undated photographs ask visitors for an estimate. Answers are kept as estimates for the family to review. */
function HelpDate() {
  const { t, l } = useLang();
  const undated = photos.filter((p) => p.category && !p.year).slice(0, 4);
  const [i, setI] = useState(0);
  const [thanks, setThanks] = useState(false);
  const photo = undated[i];

  const next = (answered: boolean) => {
    if (answered) {
      setThanks(true);
      setTimeout(() => setThanks(false), 2600);
    }
    setI((n) => n + 1);
  };

  return (
    <div className="flex flex-col gap-6 rounded-[var(--radius-card)] bg-ivory p-6 text-charcoal shadow-[var(--shadow-lift)] sm:p-8">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-[1.7rem] text-burgundy">{t.contribute.helpTitle}</h3>
        <span className="text-[0.72rem] tracking-wide text-rose">{t.contribute.demo}</span>
      </div>
      <p className="text-[0.98rem] text-ink-soft">{t.contribute.helpLead}</p>
      <div className="relative">
        <AnimatePresence mode="wait">
          {photo ? (
            <motion.div key={photo.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.45, ease }} className="mx-auto w-2/3 bg-white p-2 pb-5 shadow-[var(--shadow-paper)]" style={{ rotate: "-1.5deg" }}>
              <ArchivalImage photo={photo} reveal={false} labelled className="[&>div]:shadow-none [&>div]:[filter:sepia(0.18)]" />
            </motion.div>
          ) : (
            <motion.p key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 text-center font-display text-xl text-burgundy">
              {t.contribute.helpDone}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      {photo && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-[1rem] text-charcoal">{t.contribute.helpQ}</legend>
          <div className="flex flex-wrap gap-2">
            {DECADES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => next(true)}
                aria-label={`${t.contribute.decade(d)} · ${l(photo.alt)}`}
                className="min-h-11 rounded-full border border-burgundy/20 px-4 text-[0.92rem] text-charcoal transition-colors hover:border-burgundy hover:bg-burgundy hover:text-white"
              >
                {t.contribute.decade(d)}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => next(false)} className="mt-1 w-fit py-2 text-[0.9rem] text-ink-soft underline decoration-charcoal/20 underline-offset-4 hover:text-charcoal">
            {t.contribute.helpSkip}
          </button>
        </fieldset>
      )}
      <p aria-live="polite" className={cn("min-h-6 text-[0.9rem] text-sage-deep transition-opacity", thanks ? "opacity-100" : "opacity-0")}>
        {thanks ? t.contribute.helpThanks : ""}
      </p>
    </div>
  );
}

export default function Contribute() {
  const { t } = useLang();
  return (
    <section id="contribute" aria-labelledby="contribute-title" className="bg-burgundy py-[var(--spacing-section)] text-ivory">
      <Container className="grid items-center gap-14 lg:grid-cols-12">
        <Reveal className="flex flex-col gap-6 lg:col-span-6">
          <Item as="span" className="label !text-blush">
            {t.contribute.eyebrow}
          </Item>
          <Item as="h2" className="text-[clamp(2.3rem,4.8vw,4rem)] font-light leading-[1.1] text-ivory">
            <span id="contribute-title">{t.contribute.title}</span>
          </Item>
          <Item as="p" className="max-w-lg text-lg leading-relaxed text-ivory/80">
            {t.contribute.lead}
          </Item>
          <Item>
            <TLink
              href="/share"
              className="mt-2 inline-flex min-h-12 items-center rounded-full bg-ivory px-8 font-medium text-burgundy transition-[transform,background-color] duration-300 hover:-translate-y-0.5 hover:bg-white focus-visible:outline-ivory"
            >
              {t.contribute.cta}
            </TLink>
          </Item>
        </Reveal>
        <div className="lg:col-span-5 lg:col-start-8">
          <HelpDate />
        </div>
      </Container>
    </section>
  );
}
