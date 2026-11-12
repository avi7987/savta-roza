import type { Transition, Variants } from "motion/react";

/** One motion vocabulary for the whole site: slow, soft, never bouncy. */
export const ease = [0.22, 1, 0.36, 1] as const;

export const dur = { quick: 0.35, base: 0.8, slow: 1.4 } as const;

export const base: Transition = { duration: dur.base, ease };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: base },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: dur.slow, ease } },
};

/** photograph uncovered from the bottom, settling from a slight zoom */
export const imageReveal: Variants = {
  hidden: { clipPath: "inset(100% 0% 0% 0%)" },
  show: { clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 1.3, ease } },
};

export const stagger = (gap = 0.09, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

export const inView = { once: true, margin: "0px 0px -12% 0px" } as const;
