"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Photo } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { ease } from "@/lib/motion";

type Props = {
  photo: Photo;
  className?: string;
  /** reveal from the bottom when first seen */
  reveal?: boolean;
  /** draw the archival photo corners */
  mount?: boolean;
  priority?: boolean;
  sizes?: string;
  /** show the alt text inside the empty frame */
  labelled?: boolean;
  /** never taller than this share of the viewport (keeps proportions, never crops) */
  maxVh?: number;
};

/* empty frames take slightly different paper tones, like prints from different years */
const TONES = ["#efe6df", "#ece2de", "#e9e6dd", "#f0e4e1", "#e8e1da"];
const toneOf = (id: string) => TONES[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];

/**
 * A family photograph at its true proportions (never cropped), or, until the real
 * photograph arrives, a quiet empty frame that says what belongs there.
 */
export default function ArchivalImage({ photo, className = "", reveal = true, mount = false, priority = false, sizes = "100vw", labelled = true, maxVh }: Props) {
  const { l, t } = useLang();
  const reduce = useReducedMotion();
  const animate = reveal && !reduce;

  const inner = photo.src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.src}
      alt={l(photo.alt)}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className="h-full w-full object-contain"
    />
  ) : (
    <div role="img" aria-label={`${l(photo.alt)} · ${t.placeholderShort}`} className="relative flex h-full w-full items-center justify-center overflow-hidden" style={{ backgroundColor: toneOf(photo.id) }}>
      {/* soft window light falling across the empty frame */}
      <span aria-hidden className="absolute inset-0 bg-[linear-gradient(125deg,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0)_45%,rgba(118,46,73,0.05)_100%)]" />
      <span aria-hidden className="absolute inset-[6%] border border-burgundy/10" />
      {labelled && (
        <span className="relative flex max-w-[80%] flex-col items-center gap-2 text-center">
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-burgundy/35" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
            <rect x="3" y="6" width="18" height="13" rx="1" />
            <circle cx="12" cy="12.5" r="3.5" />
            <path d="M8 6l1.5-2h5L16 6" />
          </svg>
          <span className="font-display text-[0.95rem] leading-snug text-burgundy/70">{l(photo.alt)}</span>
          <span className="text-[0.7rem] tracking-wide text-ink-soft/80">{t.photoSlot}</span>
        </span>
      )}
    </div>
  );

  return (
    <div className={`${mount ? "mount" : ""} ${className}`} style={maxVh ? { maxWidth: `calc(${maxVh}svh * ${photo.ratio})` } : undefined}>
      <motion.div
        className="relative overflow-hidden rounded-[var(--radius-photo)] shadow-[var(--shadow-print)]"
        style={{ aspectRatio: photo.ratio }}
        initial={animate ? { clipPath: "inset(100% 0% 0% 0%)" } : false}
        whileInView={animate ? { clipPath: "inset(0% 0% 0% 0%)" } : undefined}
        viewport={{ once: true, margin: "0px 0px -8% 0px" }}
        transition={{ duration: 1.3, ease }}
      >
        <motion.div
          className="h-full w-full"
          initial={animate ? { scale: 1.08 } : false}
          whileInView={animate ? { scale: 1 } : undefined}
          viewport={{ once: true, margin: "0px 0px -8% 0px" }}
          transition={{ duration: 1.8, ease }}
        >
          {inner}
        </motion.div>
      </motion.div>
    </div>
  );
}
