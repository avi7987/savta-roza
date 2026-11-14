"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ImagePlus } from "lucide-react";
import type { Photo } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { decadeLabel, decadeOf } from "@/lib/photoDate";
import { RoseBud } from "../Botanical";
import { LanguageSwitcher } from "../Header";
import { LightboxProvider, useLightbox } from "../Lightbox";
import { TLink } from "../Transition";
import SearchButton from "../Search";
import { Container, buttonClass, cn } from "../ui";
import AlbumGrid from "./AlbumGrid";
import { usePhotos } from "./usePhotos";

type Kind = "all" | "image" | "video" | "audio";
type Decade = number | "undated" | null;

const KINDS: Kind[] = ["all", "image", "video", "audio"];

function Browser() {
  const { t, lang } = useLang();
  const { photos, loaded } = usePhotos();
  const { open } = useLightbox();
  const [kind, setKind] = useState<Kind>("all");
  const [decade, setDecade] = useState<Decade>(null);
  const [year, setYear] = useState<number | null>(null);

  // arriving with #d-1960, #y-1968 or #y-undated (from the life story)
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (h.startsWith("d-")) setDecade(Number(h.slice(2)) || null);
    else if (h === "y-undated") setDecade("undated");
    else if (h.startsWith("y-") && Number(h.slice(2))) {
      setDecade(decadeOf(Number(h.slice(2))));
      setYear(Number(h.slice(2)));
    }
  }, []);

  // oldest first, the way a life is told; undated at the end
  const sorted = useMemo(() => [...photos].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999)), [photos]);
  const ofKind = useMemo(() => sorted.filter((p) => kind === "all" || p.kind === kind || (kind === "image" && !p.kind)), [sorted, kind]);
  const counts = useMemo(() => Object.fromEntries(KINDS.map((k) => [k, sorted.filter((p) => k === "all" || p.kind === k || (k === "image" && !p.kind)).length])) as Record<Kind, number>, [sorted]);
  const decades = useMemo(() => Array.from(new Set(ofKind.filter((p) => p.year).map((p) => decadeOf(p.year!)))), [ofKind]);
  const hasUndated = ofKind.some((p) => !p.year);
  const years = useMemo(() => (typeof decade === "number" ? Array.from(new Set(ofKind.filter((p) => p.year && decadeOf(p.year) === decade).map((p) => p.year!))) : []), [ofKind, decade]);

  const shown = useMemo(
    () =>
      ofKind.filter((p) => {
        if (decade === "undated") return !p.year;
        if (typeof decade === "number") return !!p.year && decadeOf(p.year) === decade && (!year || p.year === year);
        return true;
      }),
    [ofKind, decade, year]
  );

  // grouped by decade under quiet headings
  const groups = useMemo(() => {
    const g: { key: string; label: string; list: Photo[] }[] = [];
    for (const p of shown) {
      const key = p.year ? String(decadeOf(p.year)) : "undated";
      let cur = g.find((x) => x.key === key);
      if (!cur) g.push((cur = { key, label: p.year ? decadeLabel(decadeOf(p.year), lang) : t.gallery.undated, list: [] }));
      cur.list.push(p);
    }
    return g;
  }, [shown, lang, t]);

  const openPhoto = (p: Photo) => open(shown, shown.indexOf(p));
  const chip = (on: boolean) =>
    cn("min-h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-[0.92rem] transition-colors", on ? "bg-burgundy text-white" : "bg-white text-charcoal ring-1 ring-charcoal/10 hover:ring-burgundy/40");

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-ivory/90 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <Container wide className="flex h-[4.5rem] items-center justify-between gap-4">
          <TLink href="/" className="group inline-flex min-h-11 items-center gap-2 text-[0.95rem] text-burgundy">
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 ltr:rotate-180 ltr:group-hover:-translate-x-1" strokeWidth={1.5} aria-hidden />
            {t.share.back}
          </TLink>
          <span className="hidden items-center gap-2 text-burgundy sm:flex">
            <RoseBud className="h-8 w-6" still />
            <span className="font-display text-xl">{t.nav.gallery}</span>
          </span>
          <span className="flex items-center gap-1">
            <SearchButton />
            <LanguageSwitcher />
          </span>
        </Container>
      </header>

      <main id="content">
        <Container wide className="pb-[var(--spacing-section)] pt-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex flex-col gap-3">
              <h1 className="text-[clamp(2.4rem,5vw,4rem)] font-light leading-tight text-burgundy">{t.gallery.title}</h1>
              <p className="max-w-xl text-lg leading-relaxed text-ink-soft">{t.album.lead}</p>
            </div>
            <TLink href="/share" className={buttonClass.primary}>
              <ImagePlus className="h-4 w-4" aria-hidden />
              {t.nav.share}
            </TLink>
          </div>

          {photos.length > 0 && (
            <div className="sticky top-[calc(4.5rem+env(safe-area-inset-top,0px))] z-30 -mx-[var(--spacing-gutter)] mt-8 flex flex-col gap-2 bg-ivory/92 px-[var(--spacing-gutter)] py-3 backdrop-blur-md">
              <div role="group" aria-label={t.album.type} className="flex gap-2 overflow-x-auto">
                {KINDS.filter((k) => k === "all" || counts[k] > 0).map((k) => (
                  <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={chip(kind === k)}>
                    {t.album.kinds[k]} <span className="tabular-nums opacity-60">{counts[k]}</span>
                  </button>
                ))}
              </div>
              {(decades.length > 1 || (decades.length > 0 && hasUndated)) && (
                <div role="group" aria-label={t.gallery.jump} className="flex gap-1.5 overflow-x-auto pb-0.5">
                  <button type="button" aria-pressed={decade === null} onClick={() => (setDecade(null), setYear(null))} className={chip(decade === null)}>
                    {t.album.allYears}
                  </button>
                  {decades.map((d) => (
                    <button key={d} type="button" aria-pressed={decade === d} onClick={() => (setDecade(d), setYear(null))} className={chip(decade === d)}>
                      {decadeLabel(d, lang)}
                    </button>
                  ))}
                  {hasUndated && (
                    <button type="button" aria-pressed={decade === "undated"} onClick={() => (setDecade("undated"), setYear(null))} className={chip(decade === "undated")}>
                      {t.gallery.undated}
                    </button>
                  )}
                </div>
              )}
              {years.length > 1 && (
                <div role="group" aria-label={t.album.year} className="flex gap-1 overflow-x-auto">
                  {years.map((y) => (
                    <button key={y} type="button" aria-pressed={year === y} onClick={() => setYear(year === y ? null : y)} className={cn("min-h-9 shrink-0 rounded-full px-3 text-[0.85rem] tabular-nums", year === y ? "text-burgundy underline underline-offset-4" : "text-ink-soft")}>
                      {y}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {loaded && photos.length === 0 && (
            <div className="mt-16 flex flex-col items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-dusty/50 px-6 py-20 text-center">
              <RoseBud className="h-12 w-8" still />
              <p className="font-display text-2xl text-charcoal">{t.gallery.emptyTitle}</p>
              <p className="max-w-md text-ink-soft">{t.gallery.emptyLead}</p>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-14">
            {groups.map((g) => (
              <section key={g.key} aria-label={g.label}>
                <div className="mb-4 flex items-baseline gap-3">
                  <h2 className="font-display text-[clamp(1.6rem,3vw,2.3rem)] font-light text-burgundy">{g.label}</h2>
                  <span className="text-[0.85rem] tabular-nums text-ink-soft">{t.gallery.items(g.list.length)}</span>
                </div>
                {g.key === "undated" && <p className="-mt-2 mb-4 max-w-xl text-ink-soft">{t.gallery.undatedLead}</p>}
                <AlbumGrid photos={g.list} onOpen={openPhoto} />
              </section>
            ))}
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
