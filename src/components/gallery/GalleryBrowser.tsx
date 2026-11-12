"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ImagePlus } from "lucide-react";
import type { CategoryId, Photo } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { ease } from "@/lib/motion";
import { decadeLabel, decadeOf, isEstimate } from "@/lib/photoDate";
import { RoseBud } from "../Botanical";
import { LanguageSwitcher } from "../Header";
import { LightboxProvider, useLightbox } from "../Lightbox";
import { TLink, getLenis } from "../Transition";
import { Container, buttonClass, cn } from "../ui";
import JustifiedGrid from "./JustifiedGrid";
import { usePhotos } from "./usePhotos";

type YearGroup = { year: number | null; photos: Photo[] };
type DecadeGroup = { decade: number | null; years: YearGroup[] };

/** decades, newest first, each with its years; undated photos at the end */
function group(photos: Photo[]): DecadeGroup[] {
  const byYear = new Map<number | null, Photo[]>();
  for (const p of photos) {
    const y = p.year ?? null;
    byYear.set(y, [...(byYear.get(y) ?? []), p]);
  }
  const years = [...byYear.entries()].sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : b - a));
  const decades: DecadeGroup[] = [];
  for (const [year, list] of years) {
    const d = year === null ? null : decadeOf(year);
    let g = decades.find((x) => x.decade === d);
    if (!g) decades.push((g = { decade: d, years: [] }));
    g.years.push({ year, photos: list });
  }
  return decades;
}

const anchor = (y: number | null) => (y === null ? "y-undated" : `y-${y}`);
const scrollTo = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const lenis = getLenis();
  if (lenis) lenis.scrollTo(el, { offset: -132, duration: 1.1 });
  else window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 132, behavior: "smooth" });
};

function Browser() {
  const { t, lang } = useLang();
  const { photos, loaded } = usePhotos();
  const { open } = useLightbox();
  const [filter, setFilter] = useState<CategoryId | null>(null);
  const [active, setActive] = useState<string>("");

  const shown = useMemo(() => photos.filter((p) => !filter || p.category === filter), [photos, filter]);
  const groups = useMemo(() => group(shown), [shown]);
  const ordered = useMemo(() => groups.flatMap((d) => d.years.flatMap((y) => y.photos)), [groups]);
  const categories = useMemo(() => Array.from(new Set(photos.map((p) => p.category).filter(Boolean))) as CategoryId[], [photos]);

  // highlight the year being looked at in the scrubber
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-140px 0px -70% 0px" });
    document.querySelectorAll("[data-year-anchor]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [groups]);

  // arriving with #y-1968 or #d-1960 (from the home page or the timeline)
  useEffect(() => {
    if (!loaded) return;
    const h = window.location.hash.slice(1);
    if (!h) return;
    const target = h.startsWith("d-") ? document.querySelector(`[data-decade="${h.slice(2)}"]`)?.id : h;
    if (target) setTimeout(() => scrollTo(target), 300);
  }, [loaded]);

  const openPhoto = (p: Photo) => open(ordered, ordered.indexOf(p));

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-ivory/90 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <Container wide className="flex h-[4.5rem] items-center justify-between gap-4">
          <TLink href="/#gallery" className="group inline-flex min-h-11 items-center gap-2 text-[0.95rem] text-burgundy">
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 ltr:rotate-180 ltr:group-hover:-translate-x-1" strokeWidth={1.5} aria-hidden />
            {t.share.back}
          </TLink>
          <span className="hidden items-center gap-2 text-burgundy sm:flex">
            <RoseBud className="h-8 w-6" still />
            <span className="font-display text-xl">{t.gallery.pageTitle}</span>
          </span>
          <LanguageSwitcher />
        </Container>
        {groups.length > 1 && (
          <nav aria-label={t.gallery.jump} className="border-t border-line/60 lg:hidden">
            <Container wide className="flex gap-1 overflow-x-auto py-1.5">
              {groups.map((g) => {
                const id = anchor(g.years[0].year);
                return (
                  <button key={g.decade ?? "u"} type="button" onClick={() => scrollTo(id)} className="min-h-10 shrink-0 whitespace-nowrap rounded-full px-3 text-[0.85rem] text-charcoal/80">
                    {g.decade === null ? t.gallery.undated : decadeLabel(g.decade, lang)}
                  </button>
                );
              })}
            </Container>
          </nav>
        )}
      </header>

      <main id="content">
        <Container wide className="pb-[var(--spacing-section)] pt-10">
          <div className="flex flex-col gap-4">
            <h1 className="text-[clamp(2.4rem,5vw,4rem)] font-light leading-tight text-burgundy">{t.gallery.title}</h1>
            <p className="max-w-2xl text-lg leading-relaxed text-ink-soft">{t.gallery.pageLead}</p>
            {photos.length > 0 && <p className="text-sm tabular-nums text-ink-soft">{t.gallery.items(photos.length)}</p>}
          </div>

          {categories.length > 1 && (
            <div role="group" aria-label={t.gallery.eyebrow} className="mt-8 flex flex-wrap gap-2">
              {[null, ...categories].map((c) => (
                <button
                  key={c ?? "all"}
                  type="button"
                  aria-pressed={filter === c}
                  onClick={() => setFilter(c)}
                  className={cn("min-h-10 rounded-full border px-4 text-[0.9rem] transition-colors", filter === c ? "border-burgundy bg-burgundy text-white" : "border-charcoal/15 bg-white text-charcoal hover:border-burgundy/40")}
                >
                  {c ? t.gallery.categories[c] : t.gallery.all}
                </button>
              ))}
            </div>
          )}

          {loaded && photos.length === 0 && (
            <div className="mt-16 flex flex-col items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-dusty/50 px-6 py-20 text-center">
              <RoseBud className="h-12 w-8" still />
              <p className="font-display text-2xl text-charcoal">{t.gallery.emptyTitle}</p>
              <p className="max-w-md text-ink-soft">{t.gallery.emptyLead}</p>
              <TLink href="/share" className={cn(buttonClass.primary, "mt-2")}>
                <ImagePlus className="h-4 w-4" aria-hidden />
                {t.contribute.cta}
              </TLink>
            </div>
          )}

          <div className="mt-10 flex gap-10">
            <div className="min-w-0 flex-1">
              {groups.map((g) => (
                <section key={g.decade ?? "undated"} aria-label={g.decade === null ? t.gallery.undated : decadeLabel(g.decade, lang)} className="mb-14">
                  <motion.h2
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, ease }}
                    className="mb-2 text-[clamp(2rem,4vw,3.2rem)] font-light text-burgundy"
                  >
                    {g.decade === null ? t.gallery.undated : decadeLabel(g.decade, lang)}
                  </motion.h2>
                  {g.decade === null && <p className="mb-4 max-w-lg text-ink-soft">{t.gallery.undatedLead}</p>}
                  {/* a decade with few photos is one flowing grid, each photo labelled with its year */}
                  {g.decade !== null && g.years.reduce((n, y) => n + y.photos.length, 0) < g.years.length * 3 + 4 && (
                    <div className="relative">
                      {g.years.map((y) => (
                        <span key={y.year} id={anchor(y.year)} data-year-anchor className="absolute -top-2 block" aria-hidden />
                      ))}
                      <p className="mb-3 text-[0.82rem] text-ink-soft">{t.gallery.items(g.years.reduce((n, y) => n + y.photos.length, 0))}</p>
                      <JustifiedGrid photos={g.years.flatMap((y) => y.photos)} onOpen={openPhoto} showYear />
                    </div>
                  )}
                  {(g.decade === null || g.years.reduce((n, y) => n + y.photos.length, 0) >= g.years.length * 3 + 4) && g.years.map((y) => {
                    const allEst = y.photos.every((p) => isEstimate(p.when));
                    return (
                      <div key={y.year ?? "u"} className="mb-6">
                        {y.year !== null && (
                          <div
                            id={anchor(y.year)}
                            data-year-anchor
                            data-decade={g.decade ?? ""}
                            className="sticky top-[calc(4.5rem+env(safe-area-inset-top,0px))] z-10 -mx-2 mb-2 flex items-baseline gap-3 bg-ivory/90 px-2 py-2 backdrop-blur-sm max-lg:top-[calc(7.4rem+env(safe-area-inset-top,0px))]"
                          >
                            <span className="font-display text-2xl text-charcoal tabular-nums">
                              {allEst && <span className="text-dusty">≈ </span>}
                              {y.year}
                            </span>
                            <span className="text-[0.82rem] text-ink-soft">
                              {t.gallery.items(y.photos.length)}
                              {allEst ? ` · ${t.gallery.estimated}` : ""}
                            </span>
                          </div>
                        )}
                        {y.year === null && <span id={anchor(null)} data-year-anchor className="block" />}
                        <JustifiedGrid photos={y.photos} onOpen={openPhoto} />
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>

            {groups.length > 1 && (
              <nav aria-label={t.gallery.jump} className="hidden w-28 shrink-0 lg:block">
                <ol className="sticky top-28 flex max-h-[calc(100svh-9rem)] flex-col gap-0.5 overflow-y-auto border-s border-line ps-3 text-[0.85rem]">
                  {groups.map((g) => (
                    <li key={g.decade ?? "u"} className="mb-2">
                      <button type="button" onClick={() => scrollTo(anchor(g.years[0].year))} className="py-1 font-display text-base text-burgundy">
                        {g.decade === null ? t.gallery.undated : decadeLabel(g.decade, lang)}
                      </button>
                      {g.decade !== null && (
                        <ol className="flex flex-col">
                          {g.years.map((y) => (
                            <li key={y.year}>
                              <button
                                type="button"
                                onClick={() => scrollTo(anchor(y.year))}
                                className={cn("py-0.5 tabular-nums transition-colors", active === anchor(y.year) ? "font-medium text-burgundy" : "text-ink-soft hover:text-charcoal")}
                              >
                                {y.year}
                              </button>
                            </li>
                          ))}
                        </ol>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
            )}
          </div>
        </Container>
      </main>
    </>
  );
}

export default function GalleryBrowser() {
  return (
    <LightboxProvider>
      <Browser />
    </LightboxProvider>
  );
}
