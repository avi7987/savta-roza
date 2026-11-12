"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { BadgeCheck, MessageCircle, Plus, Sparkles } from "lucide-react";
import { milestones, photoById } from "@/content";
import type { Confidence, Milestone } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { ease } from "@/lib/motion";
import ArchivalImage from "../ArchivalImage";
import { useLightbox } from "../Lightbox";
import { Container, PlaceholderTag, SectionIntro, cn } from "../ui";

const confIcon: Record<Confidence, typeof BadgeCheck> = { exact: BadgeCheck, witness: MessageCircle, estimate: Sparkles };

function ConfidenceMark({ c }: { c: Confidence }) {
  const { t } = useLang();
  const Icon = confIcon[c];
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.82rem] text-sage-deep">
      <Icon className="h-4 w-4" strokeWidth={1.4} aria-hidden />
      {t.timeline.conf[c]}
    </span>
  );
}

function TimelineItem({ m, index }: { m: Milestone; index: number }) {
  const { t, l } = useLang();
  const { open } = useLightbox();
  const [expanded, setExpanded] = useState(false);
  const pics = m.photoIds.map((id) => photoById(id)!).filter(Boolean);
  const hasMore = !!m.details?.length;
  const detailsId = `tl-${m.id}`;

  return (
    <motion.li
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.8, ease, delay: (index % 3) * 0.05 }}
      className="relative grid grid-cols-[4.5rem_1fr] gap-x-5 pb-14 last:pb-0 sm:grid-cols-[7.5rem_1fr] sm:gap-x-10"
    >
      {/* date marker */}
      <div className="relative pt-1 text-end">
        {m.year ? (
          <span className="font-display text-[clamp(1.6rem,3vw,2.4rem)] font-light leading-none text-burgundy tabular-nums">{l(m.year)}</span>
        ) : (
          <span className="inline-block border-b border-dashed border-dusty/60 pb-1 font-display text-lg text-dusty" aria-label={t.placeholderShort}>
            {t.timeline.year}
          </span>
        )}
        <span aria-hidden className="absolute -end-[0.78rem] top-3 h-2.5 w-2.5 rounded-full border border-burgundy bg-ivory sm:-end-[1.56rem]" />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-[clamp(1.6rem,2.6vw,2.1rem)] font-normal leading-tight text-charcoal">{l(m.title)}</h3>
        <p className="max-w-xl text-[1.05rem] leading-relaxed text-ink-soft">{l(m.summary)}</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {m.confidence && <ConfidenceMark c={m.confidence} />}
          {m.source && <span className="text-[0.82rem] text-ink-soft">{l(m.source)}</span>}
          {m.placeholder && <PlaceholderTag short />}
        </div>

        {pics.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-3" aria-label={t.timeline.photos(pics.length)}>
            {pics.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => open(pics, i)}
                  aria-label={l(p.alt)}
                  className="block w-28 cursor-zoom-in bg-white p-1.5 shadow-[var(--shadow-paper)] transition-transform duration-500 hover:-translate-y-1 sm:w-36"
                  style={{ rotate: `${i % 2 ? 1.5 : -1.2}deg` }}
                >
                  <ArchivalImage photo={p} labelled={false} reveal={false} className="[&>div]:shadow-none" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {hasMore && (
          <>
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded}
              aria-controls={detailsId}
              className="mt-1 inline-flex w-fit items-center gap-2 py-2 text-[0.95rem] text-burgundy"
            >
              <motion.span animate={{ rotate: expanded ? 45 : 0 }} transition={{ duration: 0.35, ease }} className="flex h-6 w-6 items-center justify-center rounded-full border border-burgundy/30">
                <Plus className="h-3.5 w-3.5" aria-hidden />
              </motion.span>
              {expanded ? t.timeline.less : t.timeline.more}
            </button>
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  id={detailsId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.5, ease }}
                  className="overflow-hidden"
                >
                  <div className="flex max-w-xl flex-col gap-3 border-s border-dusty/40 ps-5 pt-1">
                    {m.details!.map((d, i) => (
                      <p key={i} className="text-[1rem] leading-relaxed text-charcoal/80">
                        {l(d)}
                      </p>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </motion.li>
  );
}

export default function LifeTimeline() {
  const { t } = useLang();
  return (
    <section id="timeline" aria-labelledby="timeline-title" className="bg-paper/70 py-[var(--spacing-section)] shadow-[0_-1px_0_var(--color-line),0_1px_0_var(--color-line)]">
      <Container className="grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-32">
            <SectionIntro id="timeline-title" eyebrow={t.timeline.eyebrow} title={t.timeline.title} lead={t.timeline.lead} />
            <dl className="mt-10 flex flex-col gap-3 border-t border-line pt-6">
              <dt className="label">{t.timeline.confHelp}</dt>
              {(["exact", "witness", "estimate"] as Confidence[]).map((c) => (
                <dd key={c}>
                  <ConfidenceMark c={c} />
                </dd>
              ))}
            </dl>
          </div>
        </div>
        <ol className={cn("relative lg:col-span-7 lg:col-start-6")}>
          <span aria-hidden className="absolute bottom-2 start-[calc(4.5rem+0.62rem)] top-3 w-px bg-gradient-to-b from-burgundy/40 via-dusty/30 to-transparent sm:start-[calc(7.5rem+1.25rem)]" />
          {milestones.map((m, i) => (
            <TimelineItem key={m.id} m={m} index={i} />
          ))}
        </ol>
      </Container>
    </section>
  );
}
