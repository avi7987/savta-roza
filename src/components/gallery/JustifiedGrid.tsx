"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import type { Photo } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { formatDate, isEstimate } from "@/lib/photoDate";
import { cn } from "../ui";

/**
 * Rows of photos at their true proportions, each row stretched to the full width
 * (like Google Photos). Nothing is cropped; the last row keeps its natural height.
 */
export default function JustifiedGrid({ photos, onOpen, rowHeight = 220, gap = 6, className, showYear }: { photos: Photo[]; onOpen: (p: Photo) => void; rowHeight?: number; gap?: number; className?: string; showYear?: boolean }) {
  const { t, lang } = useLang();
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const target = width && width < 640 ? Math.round(rowHeight * 0.6) : rowHeight;
  const rows: { items: Photo[]; height: number }[] = [];
  if (width) {
    let cur: Photo[] = [];
    let sum = 0;
    for (const p of photos) {
      const r = Math.min(Math.max(p.ratio, 0.4), 3);
      cur.push(p);
      sum += r;
      const natural = sum * target + gap * (cur.length - 1);
      if (natural >= width) {
        rows.push({ items: cur, height: (width - gap * (cur.length - 1)) / sum });
        cur = [];
        sum = 0;
      }
    }
    if (cur.length) rows.push({ items: cur, height: Math.min(target, (width - gap * (cur.length - 1)) / sum) });
  }

  return (
    <div ref={box} className={cn("flex flex-col", className)} style={{ gap }}>
      {rows.map((row, i) => (
        <div key={i} className="flex" style={{ gap, height: row.height }}>
          {row.items.map((p) => {
            const w = Math.min(Math.max(p.ratio, 0.4), 3) * row.height;
            const est = isEstimate(p.when);
            const label = formatDate(p.when, lang);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onOpen(p)}
                aria-label={`${p.kind === "video" ? t.gallery.video : t.gallery.open}${label ? ` · ${label}` : ""}`}
                className="group relative shrink-0 cursor-zoom-in overflow-hidden rounded-[3px] bg-mount"
                style={{ width: w, height: row.height }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 ease-[var(--ease-gentle)] group-hover:scale-[1.04]" />
                <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-charcoal/55 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" />
                {label && (
                  <span aria-hidden className="pointer-events-none absolute bottom-1.5 start-2 text-[0.75rem] text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                    {label}
                  </span>
                )}
                {p.kind === "video" && (
                  <span aria-hidden className="absolute end-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-charcoal/55 text-white">
                    <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />
                  </span>
                )}
                {showYear && p.year && (
                  <span aria-hidden className="absolute bottom-1.5 end-1.5 rounded-full bg-white/90 px-2 text-[0.72rem] leading-5 tabular-nums text-charcoal group-hover:opacity-0">
                    {est ? "≈ " : ""}
                    {p.year}
                  </span>
                )}
                {est && !showYear && (
                  <span aria-hidden className="absolute start-1.5 top-1.5 rounded-full bg-white/85 px-1.5 text-[0.7rem] leading-5 text-burgundy">
                    ≈
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
