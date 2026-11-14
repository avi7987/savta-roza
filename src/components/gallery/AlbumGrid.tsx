"use client";

import { motion } from "motion/react";
import { Mic, Play } from "lucide-react";
import type { Photo } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { ease } from "@/lib/motion";
import { cn } from "../ui";

/**
 * which tiles stand two rows tall: upright photos, spaced apart, and as many as make
 * the last row of a three-column grid come out full (a tall tile fills two cells)
 */
function tallSet(photos: Photo[]) {
  const cands: number[] = [];
  photos.forEach((p, i) => {
    if (p.kind !== "audio" && p.ratio < 0.9 && (!cands.length || i - cands[cands.length - 1] >= 4)) cands.push(i);
  });
  const n = photos.length;
  const want = Math.max(1, Math.round(n / 6));
  let k = -1;
  for (let c = 0; c <= cands.length; c++) if ((n + c) % 3 === 0 && (k < 0 || Math.abs(c - want) < Math.abs(k - want))) k = c;
  if (k < 0) k = Math.min(cands.length, n >= 5 ? want : 0);
  // spread the chosen ones evenly among the candidates
  const pick = Array.from({ length: k }, (_, j) => cands[Math.floor(((j + 0.5) * cands.length) / k)]);
  return new Set(pick.map((i) => photos[i].id));
}

/**
 * The album: an even grid of medium-sized pictures, like a printed proof sheet,
 * with an upright photo standing taller now and then. Thumbnails are cropped to fit;
 * the whole picture, uncropped, opens in the viewer.
 */
export default function AlbumGrid({ photos, onOpen }: { photos: Photo[]; onOpen: (p: Photo) => void }) {
  const { t, l } = useLang();
  const tall = tallSet(photos);
  return (
    <ul className="grid grid-cols-2 gap-2 [grid-auto-flow:dense] auto-rows-[42vw] sm:grid-cols-3 sm:auto-rows-[clamp(10rem,21vw,17rem)] sm:gap-4 lg:gap-5">
      {photos.map((p, i) => (
        <motion.li
          key={p.id}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -5% 0px" }}
          transition={{ duration: 0.6, ease, delay: (i % 3) * 0.05 }}
          className={cn(tall.has(p.id) && "row-span-2")}
        >
          <button
            type="button"
            onClick={() => onOpen(p)}
            aria-label={`${t.gallery.open}: ${l(p.alt)}${p.year ? `, ${p.year}` : ""}`}
            className="group relative block h-full w-full cursor-zoom-in overflow-hidden rounded-[6px] bg-mount"
          >
            {p.kind === "audio" ? (
              <span className="flex h-full w-full flex-col items-center justify-center gap-3 bg-blush/60 p-4 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-rose shadow-[var(--shadow-paper)]">
                  <Mic className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                </span>
                <span className="line-clamp-2 font-display text-[1.05rem] leading-snug text-burgundy">{p.caption ? l(p.caption) : t.album.recording}</span>
                {p.contributor && <span className="text-[0.78rem] text-ink-soft">{p.contributor}</span>}
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-[1.1s] ease-[var(--ease-gentle)] group-hover:scale-[1.035]" />
            )}
            {p.kind === "video" && (
              <span className="absolute bottom-2 start-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white">
                <Play className="h-3.5 w-3.5" fill="currentColor" aria-hidden />
              </span>
            )}
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[6px] ring-1 ring-inset ring-black/5" />
          </button>
        </motion.li>
      ))}
    </ul>
  );
}
