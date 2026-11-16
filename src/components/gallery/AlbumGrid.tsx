"use client";

import { motion } from "motion/react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ImageOff, Mic, Play } from "lucide-react";
import type { Photo } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { isEstimate } from "@/lib/photoDate";
import { ease } from "@/lib/motion";
import { canShare } from "../Lightbox";
import { cn } from "../ui";

/** the white border of a print, on each side, and the room under it for the caption */
const PAD = { sm: 6, lg: 9 };
const CAPTION = { sm: 52, lg: 58 };

type Item = { photo: Photo; width: number; index: number };
type Row = { items: Item[]; height: number; featured: boolean; short?: boolean };

const sameStory = (a: Photo, b: Photo) => !!a.memoryId && a.memoryId === b.memoryId && !!a.caption && JSON.stringify(a.caption) === JSON.stringify(b.caption);

const ratioOf = (p: Photo) => (p.kind === "audio" ? 1 : Math.min(2.4, Math.max(0.45, p.ratio || 1)));

/**
 * Lays the prints out in rows of equal height, each picture at its own shape (never cropped),
 * and now and then gives one with a caption a row of its own, larger: a restrained, album-like rhythm.
 */
function layout(photos: Photo[], width: number): Row[] {
  if (!width) return [];
  const small = width < 640;
  const gap = small ? 12 : 22;
  const pad = small ? PAD.sm : PAD.lg;
  const target = small ? 150 : width < 1000 ? 210 : 250;
  const maxPerRow = small ? 2 : 5;

  // featured: a captioned photo roughly every eighth, never two close together, not on tiny sets
  const featured = new Set<number>();
  if (photos.length >= 6) {
    let last = -8;
    photos.forEach((p, i) => {
      if (p.kind !== "audio" && p.caption && i - last >= 8 && i > 1) {
        featured.add(i);
        last = i;
      }
    });
  }

  const rows: Row[] = [];
  let cur: number[] = [];
  const close = (stretch: boolean) => {
    if (!cur.length) return;
    const ratios = cur.map((i) => ratioOf(photos[i]));
    const free = width - gap * (cur.length - 1) - pad * 2 * cur.length;
    let h = free / ratios.reduce((a, b) => a + b, 0);
    const short = !stretch && h > target;
    if (short) h = target;
    rows.push({ items: cur.map((i, k) => ({ photo: photos[i], index: i, width: ratios[k] * h + pad * 2 })), height: h, featured: false, short });
    cur = [];
  };

  photos.forEach((p, i) => {
    if (featured.has(i)) {
      close(false);
      const r = ratioOf(p);
      const h = Math.min(small ? 300 : 460, (width - pad * 2) / r);
      rows.push({ items: [{ photo: p, index: i, width: r * h + pad * 2 }], height: h, featured: true });
      return;
    }
    cur.push(i);
    const free = width - gap * (cur.length - 1) - pad * 2 * cur.length;
    const h = free / cur.reduce((a, j) => a + ratioOf(photos[j]), 0);
    if (h <= target || cur.length >= maxPerRow) close(true);
  });
  close(false);

  // a single print left alone at the end borrows one from the row before it
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  if (last && prev && !last.featured && !prev.featured && last.items.length === 1 && prev.items.length >= 3) {
    const moved = prev.items.map((it) => it.index);
    const tail = [moved.pop()!, last.items[0].index];
    rows.splice(rows.length - 2, 2);
    cur = moved;
    close(true);
    cur = tail;
    close(false);
  }
  return rows;
}

function Print({ item, height, featured, repeat, place, onOpen }: { item: Item; height: number; featured: boolean; repeat: boolean; place: number; onOpen: () => void }) {
  const { t, l } = useLang();
  const p = item.photo;
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const full = p.caption ? l(p.caption) : "";
  // a story's caption is written once, under its first print, not repeated under each
  const title = repeat ? "" : full;
  const date = p.year ? `${isEstimate(p.when) ? "≈ " : ""}${p.year}` : t.gallery.undated;
  // a slight tilt and a strip of tape on some prints only, steady from visit to visit
  const tilt = item.index % 7 === 3 ? -0.6 : item.index % 7 === 5 ? 0.5 : 0;
  const tape = featured || item.index % 5 === 2;

  return (
    // laid on the page as it scrolls into view: from a little lower and slightly askew, one after another along the row, once
    <motion.li
      className="relative shrink-0"
      style={{ width: item.width }}
      initial={{ opacity: 0, y: 18, rotate: item.index % 2 ? 1.4 : -1.4 }}
      whileInView={{ opacity: 1, y: 0, rotate: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.9, ease, delay: place * 0.07 }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${t.gallery.open}: ${full || l(p.alt)}, ${date}`}
        className="group block w-full cursor-zoom-in bg-white p-[6px] pb-0 text-start shadow-[0_1px_2px_rgba(60,40,30,0.12),0_4px_12px_rgba(60,40,30,0.06)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(60,40,30,0.12),0_10px_24px_rgba(60,40,30,0.1)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-burgundy sm:p-[9px] sm:pb-0"
        style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined }}
      >
        {tape && <span aria-hidden className="absolute -top-2 left-1/2 z-10 h-4 w-14 -translate-x-1/2 -rotate-2 bg-[#eadcc0]/55" />}
        <span className="relative block overflow-hidden bg-mount" style={{ height }}>
          {p.kind === "audio" ? (
            <span className="flex h-full w-full flex-col items-center justify-center gap-2 bg-blush/60 p-3 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-rose shadow-[var(--shadow-paper)]">
                <Mic className="h-5 w-5" strokeWidth={1.5} aria-hidden />
              </span>
              <span className="text-[0.85rem] text-burgundy">{t.album.recording}</span>
            </span>
          ) : state === "failed" ? (
            <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-[0.8rem] text-ink-soft">
              <ImageOff className="h-5 w-5" strokeWidth={1.5} aria-hidden />
              {t.album.loadFailed}
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              data-print={canShare(p) ? p.id : undefined}
              src={p.src}
              alt={l(p.alt)}
              loading="lazy"
              decoding="async"
              onLoad={() => setState("ready")}
              onError={() => setState("failed")}
              className={cn("h-full w-full object-cover transition-opacity duration-700", state === "ready" ? "opacity-100" : "opacity-0")}
            />
          )}
          {p.kind === "video" && (
            <span className="absolute bottom-2 start-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white">
              <Play className="h-3.5 w-3.5" fill="currentColor" aria-hidden />
            </span>
          )}
        </span>
        <span className="flex flex-col justify-center gap-0.5 px-0.5" style={{ height: featured ? CAPTION.lg + 6 : undefined, minHeight: CAPTION.sm }}>
          {title && <span className={cn("line-clamp-1 font-hand leading-snug text-charcoal", featured ? "text-[1.1rem]" : "text-[0.92rem] sm:text-[1rem]")}>{title}</span>}
          <span className="text-[0.78rem] tabular-nums text-ink-soft sm:text-[0.82rem]">{date}</span>
        </span>
      </button>
    </motion.li>
  );
}

/**
 * One decade's prints. Every picture keeps its own shape; the viewer opens it whole, with all
 * that is known about it.
 */
export default function AlbumGrid({ photos, onOpen }: { photos: Photo[]; onOpen: (p: Photo) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const rows = useMemo(() => layout(photos, width), [photos, width]);

  return (
    <div ref={box} className="w-full">
      {rows.map((r, i) => (
        <ul key={i} className={cn("flex gap-3 sm:gap-[22px]", (r.featured || r.short) && "justify-center", i > 0 && "mt-4 sm:mt-7")}>
          {r.items.map((it, k) => (
            <Print key={it.photo.id} item={it} place={k} height={r.height} featured={r.featured} repeat={!r.featured && it.index > 0 && sameStory(photos[it.index - 1], it.photo)} onOpen={() => onOpen(it.photo)} />
          ))}
        </ul>
      ))}
    </div>
  );
}
