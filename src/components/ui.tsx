"use client";

import { TLink } from "./Transition";
import { Magnetic } from "./fx";
import { motion } from "motion/react";
import type { ReactNode } from "react";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/** Word-by-word blur reveal (Magic UI "BlurFade"/"TextAnimate" style). */
export function BlurText({ text, className, delay = 0, as = "span" }: { text: string; className?: string; delay?: number; as?: "span" | "h1" | "h2" | "p" }) {
  const Tag = motion[as];
  const words = text.split(" ");
  return (
    <Tag className={className} key={text}>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          className="inline-block whitespace-pre"
          initial={{ opacity: 0, filter: "blur(12px)", y: 18 }}
          whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: 0.7, delay: delay + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </Tag>
  );
}

export function FadeIn({ children, className, delay = 0, y = 24 }: { children: ReactNode; className?: string; delay?: number; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Pill button with a moving light sheen (Magic UI "ShimmerButton" style). */
export function ShimmerLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Magnetic>
    <TLink
      href={href}
      data-cursor=""
      className={cn(
        "group relative inline-flex min-h-12 items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-br from-rosa to-rosa-deep px-7 py-3 text-base font-medium text-white shadow-[0_10px_30px_-10px_rgba(224,69,123,0.7)] transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]",
        className
      )}
    >
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <span className="relative flex items-center gap-2">{children}</span>
    </TLink>
    </Magnetic>
  );
}

const fills = [
  ["#f9c9d8", "#f3a6be", "#fde7c9"],
  ["#e8d5c0", "#c9a98a", "#f6e9da"],
  ["#d6e6da", "#9fc2ab", "#f4efe2"],
  ["#fbe1c7", "#f0b98a", "#fdf1e3"],
  ["#e5dcf2", "#c3b0e0", "#fbeff4"],
  ["#f6d2c9", "#e3988a", "#fff1ea"],
];

/** Stand-in for a real family photo: soft duotone composition with grain. */
export function PhotoFill({ seed = 0, label, className }: { seed?: number; label?: string; className?: string }) {
  const [a, b, c] = fills[seed % fills.length];
  const r = (n: number) => ((Math.sin(seed * 9.13 + n * 3.7) + 1) / 2) * 100;
  return (
    <div
      className={cn("grain relative overflow-hidden", className)}
      style={{
        background: `radial-gradient(circle at ${r(1)}% ${r(2)}%, ${b} 0%, transparent 55%), radial-gradient(circle at ${r(3)}% ${r(4)}%, ${c} 0%, transparent 60%), ${a}`,
      }}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full opacity-35" aria-hidden preserveAspectRatio="xMidYMax slice">
        <ellipse cx={40 + (seed % 3) * 10} cy="62" rx="13" ry="16" fill="#fff" fillOpacity="0.55" />
        <rect x={27 + (seed % 3) * 10} y="74" width="26" height="40" rx="12" fill="#fff" fillOpacity="0.45" />
        {seed % 2 === 0 && <ellipse cx="72" cy="66" rx="10" ry="12" fill="#fff" fillOpacity="0.4" />}
      </svg>
    </div>
  );
}

export function RoseMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 6.5c-2.2 0-3.6 1.5-3.6 3.3 0 1.6 1.2 2.7 2.7 2.7 1.3 0 2.2-.9 2.2-2 0-.9-.7-1.5-1.5-1.5" />
      <path d="M8.6 8.4C7.2 9 6.4 10.3 6.4 11.8c0 2.5 2.4 4.4 5.6 4.4s5.6-1.9 5.6-4.4c0-1.6-.9-2.9-2.3-3.5" />
      <path d="M9.2 7.2c.6-1.4 1.6-2.2 2.8-2.2s2.3.8 2.9 2.1" />
      <path d="M12 16.2V22" />
      <path d="M12 19.5c-1.6-.2-2.9-1-3.5-2.4 1.6-.1 2.9.6 3.5 2.4z" />
    </svg>
  );
}

export function SectionHead({ eyebrow, title, sub, className }: { eyebrow?: string; title: string; sub?: string; className?: string }) {
  return (
    <div className={cn("mx-auto flex max-w-2xl flex-col items-center gap-4 text-center", className)}>
      {eyebrow && <span className="rounded-full bg-blush px-4 py-1 text-sm text-rosa-deep">{eyebrow}</span>}
      <BlurText as="h2" text={title} className="text-4xl font-bold tracking-tight text-ink sm:text-6xl" />
      {sub && (
        <FadeIn delay={0.2}>
          <p className="text-lg leading-relaxed text-ink-soft">{sub}</p>
        </FadeIn>
      )}
    </div>
  );
}
