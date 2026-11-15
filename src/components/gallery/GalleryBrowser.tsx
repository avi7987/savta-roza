"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ImagePlus } from "lucide-react";
import type { Photo } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { decadeLabel, decadeOf } from "@/lib/photoDate";
import { RoseBud } from "../Botanical";
import { LanguageSwitcher } from "../Header";
import { LightboxProvider, useLightbox } from "../Lightbox";
import { TLink } from "../Transition";
import SearchButton from "../Search";
import { Container, cn } from "../ui";
import AlbumGrid from "./AlbumGrid";
import { usePhotos } from "./usePhotos";

type Kind = "all" | "image" | "video" | "audio";

const KINDS: Kind[] = ["all", "image", "video", "audio"];
const sectionId = (key: string) => `album-${key}`;

function Browser() {
  const { t, lang } = useLang();
  const { photos, loaded } = usePhotos();
  const { open } = useLightbox();
  const [kind, setKind] = useState<Kind>("all");
  const [active, setActive] = useState<string>("top");
  const tabs = useRef<HTMLDivElement>(null);
  const jumping = useRef(0);

  // oldest first, the way a life is told; undated at the end
  const sorted = useMemo(() => [...photos].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999)), [photos]);
  const counts = useMemo(() => Object.fromEntries(KINDS.map((k) => [k, sorted.filter((p) => k === "all" || p.kind === k || (k === "image" && !p.kind)).length])) as Record<Kind, number>, [sorted]);
  const shown = useMemo(() => sorted.filter((p) => kind === "all" || p.kind === kind || (kind === "image" && !p.kind)), [sorted, kind]);

  // one album page per decade
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

  const scrollTo = (key: string, smooth = true) => {
    jumping.current = Date.now();
    setActive(key);
    if (key === "top") return window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
    document.getElementById(sectionId(key))?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  };

  // arriving with #d-1960, #y-1968 or #y-undated (from the life story)
  useEffect(() => {
    if (!groups.length) return;
    const h = window.location.hash.slice(1);
    const y = Number(h.slice(2));
    const key = h === "y-undated" ? "undated" : h.startsWith("d-") && y ? String(y) : h.startsWith("y-") && y ? String(decadeOf(y)) : null;
    if (key && groups.some((g) => g.key === key)) requestAnimationFrame(() => scrollTo(key, false));
    // only on arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.length > 0]);

  // the tab of the page being looked at is the highlighted one
  useEffect(() => {
    const els = groups.map((g) => document.getElementById(sectionId(g.key))).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const onScroll = () => {
      if (Date.now() - jumping.current < 900) return;
      const line = window.innerHeight * 0.35;
      let cur = "top";
      for (const el of els) if (el.getBoundingClientRect().top <= line) cur = el.id.slice(6);
      setActive(cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [groups]);

  // keep the highlighted tab in view on a narrow screen
  useEffect(() => {
    const el = tabs.current?.querySelector<HTMLElement>(`[data-key="${active}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [active]);

  const openPhoto = (p: Photo) => open(shown, shown.indexOf(p));
  const tab = (key: string, label: string) => (
    <button
      key={key}
      type="button"
      data-key={key}
      aria-current={active === key ? "true" : undefined}
      onClick={() => scrollTo(key)}
      className={cn(
        "min-h-11 shrink-0 whitespace-nowrap rounded-t-[8px] border border-b-0 px-4 font-display text-[1rem] transition-colors",
        active === key ? "border-line bg-paper text-burgundy" : "border-transparent text-ink-soft hover:text-burgundy"
      )}
    >
      {label}
    </button>
  );

  return (
    <>
      <header className="sticky top-0 z-40 bg-ivory/95 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <Container wide className="flex h-14 items-center justify-between gap-4 sm:h-16">
          <TLink href="/" className="group inline-flex min-h-11 items-center gap-2 text-[0.95rem] text-burgundy">
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 ltr:rotate-180 ltr:group-hover:-translate-x-1" strokeWidth={1.5} aria-hidden />
            {t.share.back}
          </TLink>
          <span className="flex items-center gap-1">
            <SearchButton />
            <LanguageSwitcher />
          </span>
        </Container>
        {groups.length > 1 && (
          <Container wide>
            <nav aria-label={t.album.decades} className="border-b border-line">
              <div ref={tabs} className="-mx-[var(--spacing-gutter)] flex gap-1 overflow-x-auto px-[var(--spacing-gutter)] [scrollbar-width:none] sm:mx-0 sm:justify-center sm:px-0">
                {tab("top", t.album.top)}
                {groups.map((g) => tab(g.key, g.label))}
              </div>
            </nav>
          </Container>
        )}
      </header>

      <main id="content">
        <Container wide className="pb-36 pt-8 sm:pt-12">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
            <RoseBud className="h-10 w-7" still />
            <h1 className="font-display text-[clamp(2.1rem,5vw,3.6rem)] font-light leading-tight text-burgundy">{t.album.coverTitle}</h1>
            <p className="font-hand text-[1.05rem] leading-relaxed text-ink-soft sm:text-[1.15rem]">{t.album.coverLead}</p>
            {counts.all > 0 && KINDS.filter((k) => k !== "all" && counts[k] > 0).length > 1 && (
              <div role="group" aria-label={t.album.type} className="mt-2 flex flex-wrap justify-center gap-x-1 text-[0.95rem]">
                {KINDS.filter((k) => k === "all" || counts[k] > 0).map((k, i) => (
                  <span key={k} className="flex items-center">
                    {i > 0 && <span aria-hidden className="px-1 text-dusty">·</span>}
                    <button type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={cn("min-h-11 px-2", kind === k ? "text-burgundy underline decoration-dusty underline-offset-[6px]" : "text-ink-soft hover:text-burgundy")}>
                      {t.album.kinds[k]}
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {!loaded && <p className="mt-16 text-center text-ink-soft">{t.album.loading}</p>}

          {loaded && photos.length === 0 && (
            <div className="mx-auto mt-14 flex max-w-xl flex-col items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-dusty/50 px-6 py-16 text-center">
              <p className="font-display text-2xl text-charcoal">{t.gallery.emptyTitle}</p>
              <p className="max-w-md text-ink-soft">{t.gallery.emptyLead}</p>
            </div>
          )}

          <div className="mt-10 flex flex-col gap-8 sm:mt-14 sm:gap-12">
            {groups.map((g) => (
              <section
                key={g.key}
                id={sectionId(g.key)}
                aria-label={g.label}
                className="scroll-mt-32 rounded-[4px] border border-line/80 bg-paper px-3 pb-8 pt-6 shadow-[0_1px_2px_rgba(60,40,30,0.05),0_12px_32px_-12px_rgba(60,40,30,0.12)] sm:scroll-mt-36 sm:px-10 sm:pb-12 sm:pt-9"
              >
                <div className="mb-6 flex items-baseline justify-between gap-3 px-1 sm:mb-8">
                  <h2 className="font-hand text-[1.7rem] leading-tight text-burgundy sm:text-[2.1rem]">{g.label}</h2>
                  <span className="text-[0.85rem] tabular-nums text-ink-soft">{t.gallery.items(g.list.length)}</span>
                </div>
                {g.key === "undated" && <p className="-mt-3 mb-6 max-w-xl px-1 text-ink-soft">{t.gallery.undatedLead}</p>}
                <AlbumGrid photos={g.list} onOpen={openPhoto} />
              </section>
            ))}
          </div>
        </Container>
        <TLink
          href="/share"
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-1/2 z-30 hidden min-h-12 -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-burgundy md:inline-flex px-6 text-[1rem] text-white shadow-[0_8px_24px_-6px_rgba(90,30,50,0.45)] transition-transform hover:-translate-y-0.5 sm:bottom-8 sm:left-auto sm:end-8 sm:translate-x-0"
        >
          <ImagePlus className="h-5 w-5" strokeWidth={1.6} aria-hidden />
          {t.album.add}
        </TLink>
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
