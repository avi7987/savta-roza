"use client";

import { motion, useReducedMotion } from "motion/react";
import { ease } from "@/lib/motion";

/*
  Hand-drawn botanical line work. Each drawing is used once, in one place, so the
  site never repeats the same flower. They draw themselves in slowly the first time
  they are seen and then stay still.
*/

type DrawProps = { className?: string; delay?: number; still?: boolean };

function useDraw(delay = 0, still = false) {
  const reduce = useReducedMotion();
  if (reduce || still) return () => ({});
  return (i: number, len = 2.2) => ({
    initial: { pathLength: 0, opacity: 0 },
    whileInView: { pathLength: 1, opacity: 1 },
    viewport: { once: true, margin: "0px 0px -10% 0px" },
    transition: { pathLength: { duration: len, delay: delay + i * 0.18, ease }, opacity: { duration: 0.3, delay: delay + i * 0.18 } },
  });
}

const ink = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, vectorEffect: "non-scaling-stroke" as const };

/** Long-stemmed open rose with leaves and a bud. Used beside the hero portrait. */
export function RoseBranch({ className, delay = 0, still }: DrawProps) {
  const d = useDraw(delay, still);
  return (
    <svg viewBox="0 0 200 420" className={className} aria-hidden="true">
      <defs>
        <filter id="wash" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="9" />
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      {/* watercolor wash behind the bloom */}
      <motion.ellipse
        cx="101"
        cy="90"
        rx="40"
        ry="36"
        fill="var(--color-dusty)"
        opacity="0.16"
        filter="url(#wash)"
        initial={{ scale: 0.6, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 0.16 }}
        viewport={{ once: true }}
        transition={{ duration: 2.4, delay: delay + 0.8, ease }}
      />
      <motion.ellipse cx="70" cy="146" rx="9" ry="13" fill="var(--color-dusty)" opacity="0.12" filter="url(#wash)" initial={{ opacity: 0 }} whileInView={{ opacity: 0.12 }} viewport={{ once: true }} transition={{ duration: 2, delay: delay + 1.4 }} />
      <g {...ink} stroke="var(--color-sage-deep)" strokeWidth="1">
        <motion.path d="M100 410 C102 340 96 280 104 210 S98 140 100 122" {...d(0, 2.6)} />
        <motion.path d="M99 205 C88 190 78 176 71 158" {...d(1)} />
        <motion.path d="M103 262 C120 248 146 246 160 252 C146 266 122 272 103 262 Z" {...d(2)} />
        <motion.path d="M103 262 C124 256 142 253 160 252" {...d(3)} strokeOpacity="0.6" />
        <motion.path d="M100 322 C82 306 58 304 44 312 C58 326 82 330 100 322 Z" {...d(3)} />
        <motion.path d="M100 322 C80 314 60 312 44 312" {...d(4)} strokeOpacity="0.6" />
        <motion.path d="M102 176 C114 166 132 164 140 168 C130 178 114 182 102 176 Z" {...d(4)} />
        <motion.path d="M92 122 C86 130 80 132 74 130 M108 122 C114 130 122 132 128 128" {...d(5)} />
        <motion.path d="M71 158 C64 160 60 164 58 170 M71 158 C77 160 81 164 83 170" {...d(5)} />
        <motion.path d="M101 300 l6 -4 M98 362 l-6 -3 M103 232 l5 -3" {...d(6, 1)} />
      </g>
      <g {...ink} stroke="var(--color-burgundy)" strokeWidth="1.1">
        <motion.path d="M70 92 C66 70 82 52 100 52 C120 52 136 68 131 92 C127 112 112 122 100 122 C86 122 73 112 70 92 Z" {...d(1, 2.4)} />
        <motion.path d="M100 78 c-8 0 -12 6 -10 12 c2 6 10 8 15 4 c5 -4 4 -12 -2 -15 c-8 -4 -19 1 -21 10 c-2 10 6 19 17 19 c11 0 20 -9 19 -20" {...d(2, 2.6)} />
        <motion.path d="M78 74 C84 64 96 60 106 63 M122 76 C118 66 110 60 100 60" {...d(3)} />
        <motion.path d="M72 100 C80 112 94 116 104 114 M128 98 C124 108 116 114 106 116" {...d(4)} />
        <motion.path d="M70 92 C58 86 56 74 64 66 C68 72 70 80 74 84 M131 92 C143 86 146 74 138 64 C134 70 132 78 127 84" {...d(5)} />
        <motion.path d="M71 158 C62 151 62 139 70 130 C78 139 79 151 71 158 Z M70 131 C69 140 70 150 71 158" {...d(6)} />
      </g>
    </svg>
  );
}

/** A small closed bud, for dividers and the closing page. */
export function RoseBud({ className, delay = 0, still }: DrawProps) {
  const d = useDraw(delay, still);
  return (
    <svg viewBox="0 0 40 60" className={className} aria-hidden="true">
      <g {...ink} strokeWidth="1">
        <motion.path stroke="var(--color-burgundy)" d="M20 26 C11 20 11 8 20 2 C29 8 29 20 20 26 Z M20 3 C17 10 18 19 20 26 M20 10 C23 13 24 18 22 23" {...d(0, 1.6)} />
        <motion.path stroke="var(--color-sage-deep)" d="M20 26 C14 28 10 31 8 36 M20 26 C26 28 30 31 32 36 M20 26 V58 M20 44 C26 40 32 40 36 42 C31 47 25 48 20 44" {...d(1, 1.8)} />
      </g>
    </svg>
  );
}

/** Horizontal sprig of leaves; for the timeline and section openers. */
export function LeafSprig({ className, delay = 0, still }: DrawProps) {
  const d = useDraw(delay, still);
  return (
    <svg viewBox="0 0 220 60" className={className} aria-hidden="true">
      <g {...ink} stroke="var(--color-sage-deep)" strokeWidth="1">
        <motion.path d="M6 46 C60 42 120 34 214 14" {...d(0, 2)} />
        <motion.path d="M50 42 C46 30 50 20 60 14 C64 26 60 36 50 42 Z" {...d(1)} />
        <motion.path d="M92 37 C100 46 112 50 124 48 C118 38 106 34 92 37 Z" {...d(2)} />
        <motion.path d="M134 29 C130 17 134 8 144 3 C148 15 144 24 134 29 Z" {...d(3)} />
        <motion.path d="M172 22 C180 30 192 33 202 30 C196 21 184 18 172 22 Z" {...d(4)} />
      </g>
    </svg>
  );
}

/** Single open rose seen from above: the closing mark. */
export function RoseTop({ className, delay = 0, still }: DrawProps) {
  const d = useDraw(delay, still);
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <g {...ink} stroke="var(--color-burgundy)" strokeWidth="1">
        <motion.path d="M60 52 c-5 0 -8 4 -7 8 c1 5 7 6 10 3 c4 -3 3 -9 -1 -11 c-6 -3 -14 1 -15 8 c-1 8 5 14 13 14 c9 0 15 -7 14 -16 c-1 -10 -10 -17 -20 -16 c-12 1 -20 11 -19 22 c1 13 13 22 26 21 c14 -1 24 -13 23 -27" {...d(0, 3)} />
        <motion.path d="M30 50 C24 34 38 18 56 18 M90 50 C96 34 82 18 64 18 M30 72 C26 90 42 104 60 104 C78 104 94 90 90 72" {...d(2, 2.4)} />
        <motion.path d="M22 60 C10 50 14 30 30 26 M98 60 C110 50 106 30 90 26 M26 82 C16 96 30 112 46 108 M94 82 C104 96 90 112 74 108" {...d(3, 2.4)} />
      </g>
    </svg>
  );
}

/** Thin rule with a bud in the middle; marks a turn between chapters. */
export function Divider({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-5 ${className ?? ""}`} aria-hidden="true">
      <span className="h-px w-24 bg-line sm:w-40" />
      <RoseBud className="h-10 w-7" delay={0.2} />
      <span className="h-px w-24 bg-line sm:w-40" />
    </div>
  );
}
