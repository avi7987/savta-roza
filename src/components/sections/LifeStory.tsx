"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Play } from "lucide-react";
import type { Photo } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { ease } from "@/lib/motion";
import { decadeLabel, decadeOf, isEstimate } from "@/lib/photoDate";
import { useLightbox } from "../Lightbox";
import { STATIC, TLink } from "../Transition";
import { usePhotos } from "../gallery/usePhotos";
import { Container, SectionIntro, buttonClass, cn } from "../ui";

type Notes = Record<string, { title?: string; text?: string; titleRu?: string; textRu?: string }>;

const FEATURED = 5;
const ROTATE_MS = 7000;

const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

/** a fixed-shape tile; the full, uncropped photo opens in the viewer */
function Tile({ photo, onOpen, label, className }: { photo: Photo; onOpen: () => void; label: string; className?: string }) {
  return (
    <button type="button" onClick={onOpen} aria-label={label} className={cn("group relative block h-full w-full cursor-zoom-in overflow-hidden rounded-[var(--radius-photo)] bg-mount", className)}>
      <AnimatePresence initial={false}>
        <motion.img
          key={photo.id}
          src={photo.src}
          alt=""
          loading="lazy"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease }}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.2s] group-hover:scale-[1.03]"
        />
      </AnimatePresence>
      {photo.kind === "video" && (
        <span className="absolute bottom-2 start-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white">
          <Play className="h-4 w-4" fill="currentColor" aria-hidden />
        </span>
      )}
    </button>
  );
}

/** a few chosen photos per decade, a different choice on every visit, slowly changing while you look */
function useFeatured(all: Photo[], count: number, active: boolean) {
  const [shown, setShown] = useState<Photo[]>(() => all.slice(0, count));
  const reduce = useReducedMotion();

  useEffect(() => setShown(shuffle(all).slice(0, count)), [all, count]);

  useEffect(() => {
    if (!active || reduce || all.length <= count) return;
    let slot = 0;
    const id = setInterval(() => {
      setShown((cur) => {
        const rest = all.filter((p) => !cur.some((c) => c.id === p.id));
        if (!rest.length) return cur;
        const next = [...cur];
        next[slot % next.length] = rest[Math.floor(Math.random() * rest.length)];
        slot++;
        return next;
      });
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [active, reduce, all, count]);

  return shown;
}

function Decade({ decade, photos, note, index }: { decade: number; photos: Photo[]; note?: { title?: string; text?: string }; index: number }) {
  const { t, lang } = useLang();
  const { open } = useLightbox();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { margin: "-15% 0px -15% 0px" });
  const picked = useFeatured(photos, FEATURED, inView);
  // the mosaic has room for 1, 2, 3 (one large + two) or 5 (one large + four)
  const shown = picked.length === 4 ? picked.slice(0, 3) : picked;
  const label = decadeLabel(decade, lang);
  const approx = photos.some((p) => isEstimate(p.when));
  const flip = index % 2 === 1;

  return (
    <motion.article
      ref={ref}
      id={`story-${decade}`}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.9, ease }}
      className="grid scroll-mt-28 gap-8 lg:grid-cols-12 lg:gap-14"
    >
      <div className={cn("flex flex-col gap-4 lg:col-span-4 lg:pt-6", flip && "lg:order-2")}>
        <span className="font-display text-[clamp(3rem,7vw,5.5rem)] leading-none tabular-nums text-dusty/70">{decade}</span>
        <h3 className="font-display text-[1.9rem] font-normal leading-tight text-burgundy">{note?.title || label}</h3>
        {note?.text && <p className="whitespace-pre-line text-[1.05rem] leading-[1.85] text-charcoal/85">{note.text}</p>}
        {photos.length > 0 && (
          <TLink href={`/gallery#d-${decade}`} className="w-fit text-[0.95rem] text-burgundy underline decoration-dusty/50 underline-offset-4">
            {t.story.seeAll(photos.length, label)}
          </TLink>
        )}
        {approx && <span className="text-[0.8rem] text-ink-soft">≈ {t.story.estimated}</span>}
      </div>

      {shown.length > 0 && (
        <div
          className={cn(
            "grid gap-3 sm:gap-4 lg:col-span-8",
            shown.length <= 2 && (shown.length === 1 ? "grid-cols-1" : "grid-cols-2"),
            shown.length === 3 && "grid-cols-2 sm:grid-cols-3 sm:grid-rows-2",
            shown.length === 5 && "grid-cols-2 sm:grid-cols-4 sm:grid-rows-2"
          )}
        >
          {shown.map((p, i) => (
            <div
              key={i}
              className={cn(
                shown.length === 1 && "aspect-[4/3]",
                shown.length === 2 && "aspect-[4/5]",
                shown.length >= 3 && (i === 0 ? "col-span-2 aspect-[4/3] sm:row-span-2 sm:aspect-auto" : "aspect-square")
              )}
            >
              <Tile photo={p} label={`${t.gallery.open} · ${label}`} onOpen={() => open(photos, Math.max(0, photos.findIndex((x) => x.id === p.id)))} />
            </div>
          ))}
        </div>
      )}
    </motion.article>
  );
}

function Undated({ photos }: { photos: Photo[] }) {
  const { t } = useLang();
  const { open } = useLightbox();
  const list = photos.slice(0, 12);
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-dusty/50 bg-white/50 p-6 sm:p-10">
      <h3 className="font-display text-[1.7rem] text-burgundy">{t.story.undatedTitle}</h3>
      <p className="mt-2 max-w-2xl text-ink-soft">{t.story.undatedLead}</p>
      <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {list.map((p, i) => (
          <div key={p.id} className="aspect-square">
            <Tile photo={p} label={t.gallery.open} onOpen={() => open(photos, i)} />
          </div>
        ))}
      </div>
      {photos.length > list.length && (
        <TLink href="/gallery#y-undated" className="mt-5 inline-block text-[0.95rem] text-burgundy underline decoration-dusty/50 underline-offset-4">
          {t.gallery.viewAll(photos.length)}
        </TLink>
      )}
    </div>
  );
}

/** Her life, decade by decade, told by whatever the family has shared so far. */
export default function LifeStory() {
  const { t, lang } = useLang();
  const { photos, loaded } = usePhotos();
  const [notes, setNotes] = useState<Notes>({});

  useEffect(() => {
    if (STATIC) return;
    fetch("/api/story")
      .then((r) => (r.ok ? r.json() : { decades: {} }))
      .then((d: { decades: Notes }) => setNotes(d.decades ?? {}))
      .catch(() => {});
  }, []);

  const { decades, undated } = useMemo(() => {
    const by = new Map<number, Photo[]>();
    const none: Photo[] = [];
    for (const p of photos) {
      if (!p.year || !p.src) {
        if (p.src) none.push(p);
        continue;
      }
      const d = decadeOf(p.year);
      by.set(d, [...(by.get(d) ?? []), p]);
    }
    for (const k of Object.keys(notes)) {
      const d = Number(k);
      const n = notes[k];
      if (!by.has(d) && (n.title || n.text || n.titleRu || n.textRu)) by.set(d, []);
    }
    for (const list of by.values()) list.sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
    return { decades: [...by.entries()].sort((a, b) => a[0] - b[0]), undated: none };
  }, [photos, notes]);

  const noteFor = (d: number) => {
    const n = notes[String(d)];
    if (!n) return undefined;
    return lang === "ru" ? { title: n.titleRu || n.title, text: n.textRu || n.text } : { title: n.title || n.titleRu, text: n.text || n.textRu };
  };

  const empty = loaded && decades.length === 0 && undated.length === 0;

  return (
    <section id="story" aria-labelledby="story-title" className="py-[var(--spacing-section)]">
      <Container wide>
        <SectionIntro id="story-title" eyebrow={t.story.eyebrow} title={t.story.title} lead={t.story.lead} />

        {decades.length > 1 && (
          <nav aria-label={t.gallery.jump} className="mt-10 flex flex-wrap gap-2">
            {decades.map(([d]) => (
              <a key={d} href={`#story-${d}`} className="min-h-10 rounded-full border border-charcoal/15 bg-white px-4 py-2 text-[0.9rem] text-charcoal transition-colors hover:border-burgundy hover:text-burgundy">
                {decadeLabel(d, lang)}
              </a>
            ))}
          </nav>
        )}

        {empty ? (
          <div className="mx-auto mt-14 max-w-xl rounded-[var(--radius-card)] border border-dashed border-dusty/50 bg-white/60 p-8 text-center">
            <p className="font-display text-2xl text-burgundy">{t.story.emptyTitle}</p>
            <p className="mt-3 text-ink-soft">{t.story.emptyLead}</p>
            <TLink href="/share" className={cn(buttonClass.primary, "mt-6")}>
              {t.contribute.cta}
            </TLink>
          </div>
        ) : (
          <div className="mt-16 flex flex-col gap-[clamp(4rem,9vw,8rem)]">
            {decades.map(([d, list], i) => (
              <Decade key={d} decade={d} photos={list} note={noteFor(d)} index={i} />
            ))}
            {undated.length > 0 && <Undated photos={undated} />}
          </div>
        )}
      </Container>
    </section>
  );
}
