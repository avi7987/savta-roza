"use client";

import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Photo } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { ease } from "@/lib/motion";
import ArchivalImage from "./ArchivalImage";
import { getLenis } from "./Transition";
import { PlaceholderTag } from "./ui";
import Portal from "./Portal";
import PhotoInfo from "./PhotoInfo";

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
  const { t, l, dir } = useLang();
  const { open } = useLightbox();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState(0);
  // what changed while the viewer is open (a date, a note), on top of the list it was opened with
  const [patches, setPatches] = useState<Record<string, Partial<Photo>>>({});
  const base = photos[index];
  const photo = { ...base, ...patches[base.id] };
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
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === "Escape") onClose();
      // the arrow pointing toward the reading direction moves forward
      if (!typing && e.key === "ArrowLeft") go(dir === "rtl" ? 1 : -1);
      if (!typing && e.key === "ArrowRight") go(dir === "rtl" ? -1 : 1);
      if (e.key === "Tab" && dialog.current) {
        const f = dialog.current.querySelectorAll<HTMLElement>("button:not([disabled]), input, textarea, audio, video");
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

  const jump = (p: Photo) => {
    const i = photos.findIndex((x) => x.id === p.id);
    if (i >= 0) onIndex(i);
    else open([p], 0);
  };

  const Prev = dir === "rtl" ? ChevronRight : ChevronLeft;
  const Next = dir === "rtl" ? ChevronLeft : ChevronRight;
  const shift = (dir === "rtl" ? -1 : 1) * 40;
  const uploaded = !!photo.memoryId;

  return (
    <motion.div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={l(photo.alt)}
      data-lenis-prevent
      className="fixed inset-0 z-[95] flex flex-col overflow-y-auto bg-[#231a1d] text-ivory lg:flex-row lg:overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease }}
    >
      {/* the picture */}
      <div className="relative flex shrink-0 flex-col lg:min-h-0 lg:flex-1">
        <div className="flex items-center justify-between px-[var(--spacing-gutter)] pt-[max(0.75rem,env(safe-area-inset-top))]">
          <span className="text-sm tabular-nums text-ivory/60">{many ? t.lightbox.of(index + 1, photos.length) : ""}</span>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t.lightbox.close} className="flex h-12 w-12 items-center justify-center rounded-full text-ivory/80 transition-colors hover:bg-white/10 hover:text-white">
            <X className="h-6 w-6" strokeWidth={1.3} aria-hidden />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 pb-4 sm:px-16 lg:pb-10">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.figure
              key={photo.id}
              custom={direction}
              initial={{ opacity: 0, x: direction * shift, scale: 0.985 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -direction * shift }}
              transition={{ duration: 0.5, ease }}
              drag={many ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.4}
              onDragEnd={onDragEnd}
              className="flex w-full touch-pan-y justify-center"
            >
              {photo.kind === "audio" ? (
                <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-ivory p-6 text-charcoal">
                  <span className="font-display text-2xl text-burgundy">{photo.caption ? l(photo.caption) : t.album.recording}</span>
                  <audio src={photo.full} controls preload="metadata" className="w-full" />
                </div>
              ) : photo.kind === "video" && photo.full ? (
                <video key={photo.full} src={photo.full} poster={photo.src} controls playsInline preload="metadata" className="max-h-[56svh] w-auto max-w-full rounded-[6px] bg-black lg:max-h-[82svh]" style={{ aspectRatio: photo.ratio }} />
              ) : uploaded ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.full ?? photo.src} alt={l(photo.alt)} className="max-h-[56svh] w-auto max-w-full select-none rounded-[4px] object-contain lg:max-h-[84svh] lg:shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]" draggable={false} />
              ) : (
                <div className="w-full max-w-3xl">
                  <ArchivalImage photo={{ ...photo, src: photo.full ?? photo.src }} reveal={false} sizes="90vw" />
                </div>
              )}
            </motion.figure>
          </AnimatePresence>

          {many && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label={t.lightbox.prev} className="absolute start-1 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-ivory/80 transition-colors hover:bg-white/10 hover:text-white sm:h-14 sm:w-14 sm:bg-transparent">
                <Prev className="h-7 w-7" strokeWidth={1.2} aria-hidden />
              </button>
              <button type="button" onClick={() => go(1)} aria-label={t.lightbox.next} className="absolute end-1 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-ivory/80 transition-colors hover:bg-white/10 hover:text-white sm:h-14 sm:w-14 sm:bg-transparent">
                <Next className="h-7 w-7" strokeWidth={1.2} aria-hidden />
              </button>
            </>
          )}
        </div>
      </div>

      {/* what we know about it */}
      <aside aria-label={t.info.title} className="bg-ivory px-[var(--spacing-gutter)] py-8 text-charcoal lg:w-[27rem] lg:shrink-0 lg:overflow-y-auto lg:px-8 lg:py-10" data-lenis-prevent>
        {uploaded ? (
          <PhotoInfo key={photo.id} photo={photo} onChange={(patch) => setPatches((m) => ({ ...m, [photo.id]: { ...m[photo.id], ...patch } }))} onJump={jump} />
        ) : (
          <div className="flex flex-col gap-2">
            {photo.caption && <h2 className="font-display text-2xl text-burgundy">{l(photo.caption)}</h2>}
            {photo.placeholder && <PlaceholderTag short />}
          </div>
        )}
      </aside>
    </motion.div>
  );
}
