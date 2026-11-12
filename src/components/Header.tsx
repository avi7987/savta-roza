"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useEffect, useState } from "react";
import { Menu, Plus, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { cn, RoseMark } from "./ui";
import { Magnetic } from "./fx";
import { TLink, useSite } from "./Transition";
import type { Lang } from "@/lib/dict";

export function LangToggle({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLang();
  const opts: { id: Lang; label: string }[] = [
    { id: "he", label: compact ? "עב" : "עברית" },
    { id: "ru", label: compact ? "RU" : "Русский" },
  ];
  return (
    <div role="group" aria-label="Language / שפה" className="relative flex rounded-full bg-white/70 p-1 ring-1 ring-ink/10 backdrop-blur">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => setLang(o.id)}
          aria-pressed={lang === o.id}
          className={cn("relative min-h-10 rounded-full px-4 text-sm transition-colors", lang === o.id ? "text-white" : "text-ink-soft hover:text-ink")}
        >
          {lang === o.id && (
            <motion.span layoutId={compact ? "lang-pill-c" : "lang-pill"} className="absolute inset-0 rounded-full bg-rosa" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

const SECTIONS = ["timeline", "album", "videos", "help"] as const;

export default function Header() {
  const { t } = useLang();
  const { ready } = useSite();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const lenis = (window as unknown as { __lenis?: { stop: () => void; start: () => void } }).__lenis;
    if (open) lenis?.stop();
    else lenis?.start();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  const jump = (id: string) => {
    setOpen(false);
    setTimeout(() => {
      const el = document.getElementById(id);
      const lenis = (window as unknown as { __lenis?: { start: () => void; scrollTo: (t: HTMLElement, o?: object) => void } }).__lenis;
      if (!el) return;
      if (lenis) {
        lenis.start();
        lenis.scrollTo(el, { duration: 1.4 });
      } else el.scrollIntoView({ behavior: "smooth" });
    }, 350);
  };

  useMotionValueEvent(scrollY, "change", (v) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(v > 40);
    setHidden(v > 600 && v > prev + 4);
    if (v < prev - 4) setHidden(false);
  });

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-50% 0px -50% 0px" }
    );
    const els = [...SECTIONS, "memories"].map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    els.forEach((el) => io.observe(el));
    const top = () => window.scrollY < 300 && setActive(null);
    window.addEventListener("scroll", top, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", top);
    };
  }, []);

  const labels: Record<(typeof SECTIONS)[number], string> = { timeline: t.nav.life, album: t.nav.album, videos: t.nav.videos, help: t.nav.help };
  const pill = hovered ?? active;

  return (
    <>
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={ready ? { y: hidden ? -100 : 0, opacity: 1 } : { y: -80, opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-3 z-50 flex justify-center px-3"
    >
      <div
        className={cn(
          "flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 rounded-full px-3 py-2 transition-all duration-500 sm:px-5",
          scrolled ? "bg-white/70 shadow-[0_8px_40px_-12px_rgba(163,22,74,0.25)] ring-1 ring-ink/5 backdrop-blur-xl" : "bg-transparent"
        )}
      >
        <TLink href="/" className="group flex items-center gap-2 text-ink">
          <motion.span whileHover={{ rotate: 25, scale: 1.1 }} className="flex h-10 w-10 items-center justify-center rounded-full bg-blush text-rosa">
            <RoseMark className="h-6 w-6" />
          </motion.span>
          <AnimatePresence mode="wait">
            <motion.span
              key={t.brand}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="text-lg font-bold tracking-tight"
            >
              {t.brand}
            </motion.span>
          </AnimatePresence>
        </TLink>
        <nav aria-label="main" className="hidden flex-1 items-center justify-center gap-1 lg:flex" onMouseLeave={() => setHovered(null)}>
          {SECTIONS.map((id) => (
            <a
              key={id}
              href={`#${id}`}
              onMouseEnter={() => setHovered(id)}
              aria-current={active === id ? "true" : undefined}
              className={cn("relative rounded-full px-4 py-2 text-[15px] transition-colors", pill === id ? "text-rosa-deep" : "text-ink-soft")}
            >
              {pill === id && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-blush" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
              <span className="relative">{labels[id]}</span>
            </a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <LangToggle compact />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t.nav.menu}
            aria-expanded={open}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-ink ring-1 ring-ink/10 backdrop-blur lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <Magnetic className="hidden sm:inline-flex">
            <TLink
              href="/upload"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink px-5 text-sm font-medium text-white transition-colors hover:bg-rosa-deep"
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t.add}
            </TLink>
          </Magnetic>
        </div>
      </div>
    </motion.header>

    <AnimatePresence>
      {open && (
        <motion.div
          key="menu"
          role="dialog"
          aria-modal="true"
          aria-label={t.nav.menu}
          data-lenis-prevent
          initial={{ clipPath: "circle(0% at 90% 4%)" }}
          animate={{ clipPath: "circle(150% at 90% 4%)" }}
          exit={{ clipPath: "circle(0% at 90% 4%)" }}
          transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
          className="fixed inset-0 z-[80] flex flex-col overflow-y-auto bg-gradient-to-br from-blush via-cream to-[#fbe7d6] px-6 pb-10 pt-6 lg:hidden"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-lg font-bold text-ink">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-rosa">
                <RoseMark className="h-6 w-6" />
              </span>
              {t.brand}
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label={t.nav.close} className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink ring-1 ring-ink/10">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <nav aria-label="main" className="mt-12 flex flex-col gap-2">
            {(["memories", ...SECTIONS] as const).map((id, i) => (
              <motion.button
                key={id}
                type="button"
                onClick={() => jump(id)}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.07, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="group flex items-baseline gap-4 border-b border-ink/10 py-4 text-start"
              >
                <span className="text-sm tabular-nums text-rosa">0{i + 1}</span>
                <span className="text-4xl font-black tracking-tight text-ink transition-colors group-hover:text-rosa-deep sm:text-5xl">
                  {id === "memories" ? t.nav.memories : labels[id]}
                </span>
              </motion.button>
            ))}
          </nav>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="mt-auto flex flex-wrap items-center gap-3 pt-10">
            <TLink
              href="/upload"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-gradient-to-br from-rosa to-rosa-deep px-6 font-medium text-white"
            >
              <Plus className="h-5 w-5" aria-hidden />
              {t.add}
            </TLink>
            <LangToggle />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
