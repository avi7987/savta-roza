"use client";

import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Photo } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { ease } from "@/lib/motion";
import { formatDate, sourceLabel } from "@/lib/photoDate";
import ArchivalImage from "./ArchivalImage";
import { getLenis } from "./Transition";
import { PlaceholderTag } from "./ui";
import Portal from "./Portal";
import { DecadePicker, RemovalRequest } from "./PhotoActions";
import type { PhotoDate } from "@/lib/photoDate";

type Ctx = { open: (photos: Photo[], index: number) => void };
const LightboxCtx = createContext<Ctx>({ open: () => {} });
export const useLightbox = () => useContext(LightboxCtx);

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ photos: Photo[]; index: number } | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const open = useCallback((photos: Photo[], index: number) => {
    returnFocus.current = document.activeElement as HTMLElement;
    setState({ photos, index });
  }, []);

  const close = useCallback(() => {
    setState(null);
    setTimeout(() => returnFocus.current?.focus(), 50);
  }, []);

  return (
    <LightboxCtx.Provider value={{ open }}>
      {children}
      <Portal>
      <AnimatePresence>{state && <ImageLightbox key="lb" photos={state.photos} index={state.index} onIndex={(i) => setState({ ...state, index: i })} onClose={close} />}</AnimatePresence>
      </Portal>
    </LightboxCtx.Provider>
  );
}

function ImageLightbox({ photos, index, onIndex, onClose }: { photos: Photo[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const { t, l, dir, lang } = useLang();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState(0);
  const [dated, setDated] = useState<Record<string, PhotoDate>>({});
  const base = photos[index];
  const photo = dated[base.id] ? { ...base, when: dated[base.id] } : base;
  const many = photos.length > 1;

  const go = useCallback(
    (step: number) => {
      if (!many) return;
      setDirection(step);
      onIndex((index + step + photos.length) % photos.length);
    },
    [index, many, onIndex, photos.length]
  );

  useEffect(() => {
    getLenis()?.stop();
    closeRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // the arrow pointing toward the reading direction moves forward
      if (e.key === "ArrowLeft") go(dir === "rtl" ? 1 : -1);
      if (e.key === "ArrowRight") go(dir === "rtl" ? -1 : 1);
      if (e.key === "Tab" && dialog.current) {
        const f = dialog.current.querySelectorAll<HTMLElement>("button, input, textarea");
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      getLenis()?.start();
    };
  }, [dir, go, onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const swipe = info.offset.x;
    if (Math.abs(swipe) < 60) return;
    // swiping toward the start of the line goes forward
    const forward = dir === "rtl" ? swipe > 0 : swipe < 0;
    go(forward ? 1 : -1);
  };

  const Prev = dir === "rtl" ? ChevronRight : ChevronLeft;
  const Next = dir === "rtl" ? ChevronLeft : ChevronRight;
  const shift = (dir === "rtl" ? -1 : 1) * 40;

  return (
    <motion.div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={l(photo.alt)}
      data-lenis-prevent
      className="fixed inset-0 z-[95] flex flex-col bg-[#231a1d]/95 text-ivory backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease }}
    >
      <div className="flex items-center justify-between px-[var(--spacing-gutter)] pt-[max(1rem,env(safe-area-inset-top))]">
        <span className="text-sm tabular-nums text-ivory/60">{many ? t.lightbox.of(index + 1, photos.length) : ""}</span>
        <button ref={closeRef} type="button" onClick={onClose} aria-label={t.lightbox.close} className="flex h-12 w-12 items-center justify-center rounded-full text-ivory/80 transition-colors hover:bg-white/10 hover:text-white">
          <X className="h-6 w-6" strokeWidth={1.3} aria-hidden />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-20">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.figure
            key={photo.id}
            custom={direction}
            initial={{ opacity: 0, x: direction * shift, scale: 0.985 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -direction * shift }}
            transition={{ duration: 0.55, ease }}
            drag={many ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.4}
            onDragEnd={onDragEnd}
            className="flex max-h-full w-full max-w-5xl touch-pan-y flex-col items-center gap-5 overflow-y-auto py-2"
          >
            <div className="w-full" style={{ maxWidth: `min(100%, calc(72svh * ${photo.ratio}))` }}>
              {photo.kind === "video" && photo.full ? (
                <video key={photo.full} src={photo.full} poster={photo.src} controls playsInline preload="metadata" className="w-full rounded-[var(--radius-photo)] bg-black" style={{ aspectRatio: photo.ratio }} />
              ) : (
                <ArchivalImage photo={{ ...photo, src: photo.full ?? photo.src }} reveal={false} sizes="90vw" />
              )}
            </div>
            <figcaption className="flex max-w-xl flex-col items-center gap-2 text-center">
              {photo.caption && <span className="font-display text-xl text-ivory">{l(photo.caption)}</span>}
              {photo.when?.source === "ai" && photo.when.clues && <span className="max-w-md text-[0.82rem] text-ivory/50">{photo.when.clues}</span>}
              <span className="flex flex-wrap items-center justify-center gap-x-3 text-sm text-ivory/60">
                {photo.when ? (
                  <span>
                    {formatDate(photo.when, lang)} · {sourceLabel(photo.when, lang)}
                  </span>
                ) : photo.date ? (
                  <span>{l(photo.date)}</span>
                ) : photo.memoryId ? (
                  <span>{sourceLabel(undefined, lang)}</span>
                ) : null}
                {photo.contributor && (
                  <span>
                    {t.lightbox.by}: {photo.contributor}
                  </span>
                )}
                {photo.placeholder && <PlaceholderTag short className="border-ivory/30 text-ivory/70" />}
              </span>
              {photo.memoryId && photo.file && (!base.when || base.when.source === "ai") && (
                <DecadePicker key={`d-${photo.id}`} memoryId={photo.memoryId} file={photo.file} tone="dark" onDated={(d) => setDated((m) => ({ ...m, [photo.id]: d }))} />
              )}
              {photo.memoryId && photo.file && <RemovalRequest key={`r-${photo.id}`} memoryId={photo.memoryId} file={photo.file} requested={photo.removalRequested} tone="dark" />}
            </figcaption>
          </motion.figure>
        </AnimatePresence>

        {many && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label={t.lightbox.prev} className="absolute start-2 top-1/2 hidden h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full text-ivory/70 transition-colors hover:bg-white/10 hover:text-white sm:flex">
              <Prev className="h-7 w-7" strokeWidth={1.2} aria-hidden />
            </button>
            <button type="button" onClick={() => go(1)} aria-label={t.lightbox.next} className="absolute end-2 top-1/2 hidden h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full text-ivory/70 transition-colors hover:bg-white/10 hover:text-white sm:flex">
              <Next className="h-7 w-7" strokeWidth={1.2} aria-hidden />
            </button>
          </>
        )}
      </div>

      {many && (
        <div className="flex justify-center gap-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:hidden">
          <button type="button" onClick={() => go(-1)} aria-label={t.lightbox.prev} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 text-ivory/80">
            <Prev className="h-6 w-6" strokeWidth={1.2} aria-hidden />
          </button>
          <button type="button" onClick={() => go(1)} aria-label={t.lightbox.next} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 text-ivory/80">
            <Next className="h-6 w-6" strokeWidth={1.2} aria-hidden />
          </button>
        </div>
      )}
    </motion.div>
  );
}
