"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Mic, Video } from "lucide-react";
import { photoById } from "@/content";
import type { Memory } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { ease } from "@/lib/motion";
import ArchivalImage from "../ArchivalImage";
import AudioPlayer from "../AudioPlayer";
import { RemovalRequest } from "../PhotoActions";
import { STATIC, TLink } from "../Transition";
import { Container, SectionIntro, buttonClass, cn } from "../ui";

const dateFmt = (iso: string, lang: string) => {
  try {
    return new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export function MemoryCard({ m, index = 0 }: { m: Memory; index?: number }) {
  const { t, lang } = useLang();
  const foreign = m.lang !== lang && !!m.translation;
  const [original, setOriginal] = useState(false);
  const body = foreign && !original ? m.translation! : m.body;
  const photo = m.photoId ? photoById(m.photoId) : undefined;
  const withPhoto = !!(photo || m.photoSrc);
  const tone = index % 3 === 1 ? "bg-[#fbf3f1]" : "bg-white";

  return (
    <motion.article
      id={m.placeholder ? undefined : `m-${m.id}`}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.8, ease, delay: (index % 3) * 0.08 }}
      className={cn(
        "group relative mb-8 flex scroll-mt-28 break-inside-avoid flex-col rounded-[var(--radius-card)] p-6 shadow-[var(--shadow-paper)] ring-1 ring-charcoal/[0.04] transition-[transform,box-shadow] duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] sm:p-8",
        tone
      )}
    >
      {m.placeholder && <span className="mb-3 text-[0.72rem] tracking-wide text-rose">{t.memories.example}</span>}

      {withPhoto && (
        <div className="-mx-2 -mt-2 mb-6 sm:-mx-3 sm:-mt-3">
          {photo ? (
            <ArchivalImage photo={photo} reveal={false} labelled={false} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.photoSrc} alt="" loading="lazy" className="w-full rounded-[var(--radius-photo)]" />
          )}
        </div>
      )}

      {m.title && <h3 className="mb-3 font-display text-[1.6rem] font-normal leading-snug text-burgundy">{m.title}</h3>}

      <p lang={foreign && !original ? lang : m.lang} className={cn("text-[1.05rem] leading-[1.85] text-charcoal/90", !withPhoto && !m.title && "font-display text-[1.35rem] leading-[1.6] text-charcoal")}>
        {body}
      </p>

      {m.mediaKind === "audio" && m.mediaSrc && <AudioPlayer src={m.mediaSrc} title={m.title || m.author} className="mt-5" />}
      {m.mediaKind === "video" && m.mediaSrc && (
        <video src={m.mediaSrc} controls playsInline preload="metadata" className="mt-5 w-full rounded-[var(--radius-photo)] bg-black" />
      )}
      {m.mediaKind && !m.mediaSrc && (
        <span className="mt-4 inline-flex items-center gap-2 text-[0.85rem] text-sage-deep">
          {m.mediaKind === "audio" ? <Mic className="h-4 w-4" strokeWidth={1.4} aria-hidden /> : <Video className="h-4 w-4" strokeWidth={1.4} aria-hidden />}
          {m.mediaKind === "audio" ? t.memories.audio : t.memories.video}
        </span>
      )}

      <footer className="mt-6 flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
        <span className="flex flex-col">
          <span className="font-hand text-xl leading-tight text-rose">{m.author}</span>
          <span className="text-[0.82rem] text-ink-soft">
            {m.relation}
            {m.relation && " · "}
            <time dateTime={m.createdAt}>{dateFmt(m.createdAt, lang)}</time>
          </span>
        </span>
        {!m.placeholder && <RemovalRequest memoryId={m.id} requested={m.removalRequested} />}
        {foreign && (
          <button type="button" onClick={() => setOriginal((o) => !o)} className="min-h-11 text-[0.82rem] text-burgundy underline decoration-dusty/50 underline-offset-4">
            {original ? t.memories.showTranslation : t.memories.original}
          </button>
        )}
      </footer>
    </motion.article>
  );
}

export default function Memories() {
  const { t } = useLang();
  const [list, setList] = useState<Memory[] | null>(null);

  useEffect(() => {
    if (STATIC) return;
    fetch("/api/memories")
      .then((r) => (r.ok ? r.json() : { memories: [] }))
      // photos alone already live in the life story; here go words and recordings
      .then((d: { memories: Memory[] }) => setList((d.memories ?? []).filter((m) => m.body?.trim() || m.mediaKind === "audio")))
      .catch(() => setList([]));
  }, []);


  return (
    <section id="memories" aria-labelledby="memories-title" className="py-[var(--spacing-section)]">
      <Container>
        <SectionIntro id="memories-title" eyebrow={t.memories.eyebrow} title={t.memories.title} lead={t.memories.lead} layout="center" />
        {list && list.length > 0 ? (
          <div className="mt-16 columns-1 gap-8 md:columns-2 lg:columns-3">
            {list.map((m, i) => (
              <MemoryCard key={m.id} m={m} index={i} />
            ))}
          </div>
        ) : list ? (
          <div className="mx-auto mt-14 max-w-xl rounded-[var(--radius-card)] border border-dashed border-dusty/50 bg-white/60 p-8 text-center">
            <p className="font-display text-2xl text-burgundy">{t.memories.empty}</p>
            <p className="mt-3 text-ink-soft">{t.memories.emptyLead}</p>
          </div>
        ) : (
          <div className="mt-16 h-40" aria-hidden />
        )}
        <div className="mt-8 flex justify-center">
          <TLink href="/share" className={buttonClass.secondary}>
            {t.memories.cta}
          </TLink>
        </div>
      </Container>
    </section>
  );
}
