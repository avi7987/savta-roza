"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { photos as allPhotos } from "@/content";
import type { CategoryId, Photo } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { ease } from "@/lib/motion";
import ArchivalImage from "../ArchivalImage";
import { useLightbox } from "../Lightbox";
import { Container, PlaceholderTag, SectionIntro, buttonClass, cn } from "../ui";
import { TLink } from "../Transition";
import JustifiedGrid from "../gallery/JustifiedGrid";
import { usePhotos } from "../gallery/usePhotos";
import { decadeLabel, decadeOf } from "@/lib/photoDate";

/** photos that belong to the album (portraits and video covers live elsewhere) */
const albumPhotos = allPhotos.filter((p) => p.category);

function GalleryItem({ photo, onOpen, index }: { photo: Photo; onOpen: () => void; index: number }) {
  const { l, t } = useLang();
  return (
    <motion.figure
      layout
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      transition={{ duration: 0.8, ease, delay: Math.min(index, 6) * 0.06 }}
      className="mb-[clamp(1.25rem,2.5vw,2.25rem)] break-inside-avoid"
    >
      <button type="button" onClick={onOpen} aria-label={`${t.gallery.open}: ${l(photo.alt)}`} className="group block w-full cursor-zoom-in overflow-hidden rounded-[var(--radius-photo)]">
        <div className="transition-transform duration-[1.2s] ease-[var(--ease-gentle)] group-hover:scale-[1.03]">
          <ArchivalImage photo={photo} reveal={false} labelled={false} sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw" />
        </div>
      </button>
      <figcaption className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-display text-[1.05rem] text-charcoal/85">{l(photo.caption)}</span>
        {photo.date && <span className="text-[0.8rem] tabular-nums text-ink-soft">{l(photo.date)}</span>}
      </figcaption>
    </motion.figure>
  );
}

/** the family's own photos: a taste of the album, with the way into the full gallery */
function GalleryPreview({ photos }: { photos: Photo[] }) {
  const { t, lang } = useLang();
  const { open } = useLightbox();
  const decades = Array.from(new Set(photos.map((p) => (p.year ? decadeOf(p.year) : null)).filter((d): d is number => d !== null))).sort((a, b) => b - a);
  const preview = photos.slice(0, 18);
  return (
    <section id="gallery" aria-labelledby="gallery-title" className="py-[var(--spacing-section)]">
      <Container wide>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionIntro id="gallery-title" eyebrow={t.gallery.eyebrow} title={t.gallery.title} lead={t.gallery.lead} />
          {decades.length > 0 && (
            <nav aria-label={t.gallery.jump} className="flex flex-wrap gap-2 lg:max-w-[34rem] lg:justify-end">
              {decades.map((d) => (
                <TLink key={d} href={`/gallery#d-${d}`} className="min-h-10 rounded-full border border-charcoal/15 bg-white px-4 py-2 text-[0.9rem] text-charcoal transition-colors hover:border-burgundy hover:text-burgundy">
                  {decadeLabel(d, lang)}
                </TLink>
              ))}
            </nav>
          )}
        </div>
        <JustifiedGrid photos={preview} onOpen={(p) => open(preview, preview.indexOf(p))} rowHeight={240} className="mt-12" />
        <div className="mt-10 flex justify-center">
          <TLink href="/gallery" className={buttonClass.primary}>
            {t.gallery.viewAll(photos.length)}
          </TLink>
        </div>
      </Container>
    </section>
  );
}

export default function PhotoGallery() {
  const { photos } = usePhotos();
  return photos.length ? <GalleryPreview photos={photos} /> : <PlaceholderGallery />;
}

function PlaceholderGallery() {
  const { t } = useLang();
  const { open } = useLightbox();
  const [filter, setFilter] = useState<CategoryId | null>(null);

  // only offer categories that actually have photographs
  const categories = useMemo(() => Array.from(new Set(albumPhotos.map((p) => p.category!))), []);
  const shown = albumPhotos.filter((p) => !filter || p.category === filter);
  const feature = !filter ? shown.find((p) => p.size === "feature") : undefined;
  const rest = shown.filter((p) => p !== feature);
  const ordered = feature ? [feature, ...rest] : rest;
  const anyPlaceholder = shown.some((p) => p.placeholder);

  return (
    <section id="gallery" aria-labelledby="gallery-title" className="py-[var(--spacing-section)]">
      <Container wide>
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <SectionIntro id="gallery-title" eyebrow={t.gallery.eyebrow} title={t.gallery.title} lead={t.gallery.lead} />
          {categories.length > 1 && (
            <div role="group" aria-label={t.gallery.eyebrow} className="flex flex-wrap gap-x-1 gap-y-1 lg:max-w-[34rem] lg:justify-end">
              {[null, ...categories].map((c) => {
                const on = filter === c;
                return (
                  <button
                    key={c ?? "all"}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFilter(c)}
                    className={cn("relative min-h-11 px-3 text-[0.95rem] transition-colors", on ? "text-burgundy" : "text-ink-soft hover:text-charcoal")}
                  >
                    {c ? t.gallery.categories[c] : t.gallery.all}
                    {on && <motion.span layoutId="gal-u" className="absolute inset-x-3 bottom-2 h-px bg-burgundy" transition={{ duration: 0.45, ease }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {anyPlaceholder && <PlaceholderTag className="mt-8" />}

        <div className="mt-12">
          <AnimatePresence mode="popLayout">
            {feature && (
              <motion.figure key={`f-${feature.id}`} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-[clamp(1.5rem,3vw,3rem)]">
                <button type="button" onClick={() => open(ordered, 0)} aria-label={`${t.gallery.open}`} className="group block w-full cursor-zoom-in overflow-hidden rounded-[var(--radius-photo)]">
                  <div className="transition-transform duration-[1.2s] ease-[var(--ease-gentle)] group-hover:scale-[1.02]">
                    <ArchivalImage photo={feature} sizes="96vw" maxVh={64} className="mx-auto" />
                  </div>
                </button>
              </motion.figure>
            )}
          </AnimatePresence>
          <div className="columns-2 gap-[clamp(1rem,2vw,2rem)] md:columns-3 xl:columns-4">
            <AnimatePresence mode="popLayout">
              {rest.map((p, i) => (
                <GalleryItem key={`${filter}-${p.id}`} photo={p} index={i} onOpen={() => open(ordered, ordered.indexOf(p))} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </Container>
    </section>
  );
}
