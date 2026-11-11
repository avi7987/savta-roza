"use client";

import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, type ReactNode } from "react";
import { LangProvider, useLang } from "@/lib/i18n";
import { TransitionProvider, useSite } from "./Transition";
import Intro from "./Intro";
import { AmbientPetals, Cursor, ScrollProgress } from "./fx";
import { RoseMark } from "./ui";

gsap.registerPlugin(ScrollTrigger);

function SmoothScroll() {
  const { ready } = useSite();
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 1.2, smoothWheel: true, anchors: { offset: -20 }, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    lenisRef.current = lenis;
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    const l = lenisRef.current;
    if (!l) return;
    if (ready) {
      l.start();
      setTimeout(() => ScrollTrigger.refresh(), 300);
    } else l.stop();
  }, [ready]);

  return null;
}

export function Footer() {
  const { t } = useLang();
  return (
    <footer className="relative z-10 border-t border-ink/5 bg-white/60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-10 text-ink-soft">
        <span className="flex items-center gap-2">
          <RoseMark className="h-5 w-5 text-rosa" />
          {t.footer.love}
        </span>
        <span className="text-sm">{t.footer.private}</span>
      </div>
    </footer>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <LangProvider>
      <TransitionProvider>
        <SmoothScroll />
        <ScrollProgress />
        <AmbientPetals />
        {children}
        <Cursor />
        <Intro />
      </TransitionProvider>
    </LangProvider>
  );
}
