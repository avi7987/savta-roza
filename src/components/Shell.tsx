"use client";

import Lenis from "lenis";
import { MotionConfig } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { LangProvider } from "@/lib/i18n";
import { TransitionProvider } from "./Transition";

/** Gentle smooth scrolling; switched off entirely for visitors who prefer reduced motion. */
function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);
  return null;
}

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <LangProvider>
      <MotionConfig reducedMotion="user">
        <TransitionProvider>
          <SmoothScroll />
          {children}
        </TransitionProvider>
      </MotionConfig>
    </LangProvider>
  );
}
