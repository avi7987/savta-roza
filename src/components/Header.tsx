"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import type { Lang } from "@/content/types";
import { profile } from "@/content";
import { RoseBud } from "./Botanical";
import { TLink, getLenis } from "./Transition";
import { cn } from "./ui";
import { ease } from "@/lib/motion";

export function LanguageSwitcher({ className, large }: { className?: string; large?: boolean }) {
  const { lang, setLang, t } = useLang();
  const opts: { id: Lang; label: string; full: string }[] = [
    { id: "he", label: "עב", full: "עברית" },
    { id: "ru", label: "RU", full: "Русский" },
  ];
  return (
    <div role="group" aria-label={t.nav.language} className={cn("flex items-center gap-1", className)}>
      {opts.map((o, i) => (
        <span key={o.id} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden className="h-3.5 w-px bg-charcoal/20" />}
          <button
            type="button"
            lang={o.id}
            onClick={() => setLang(o.id)}
            aria-pressed={lang === o.id}
            aria-label={o.full}
            className={cn(
              "relative flex min-h-11 min-w-11 items-center justify-center px-2 transition-colors",
              large ? "text-lg" : "text-[0.9rem]",
              lang === o.id ? "text-burgundy" : "text-ink-soft hover:text-charcoal"
            )}
          >
            {large ? o.full : o.label}
            {lang === o.id && <motion.span layoutId={large ? "lang-u-l" : "lang-u"} className="absolute inset-x-2 bottom-2 h-px bg-burgundy" transition={{ duration: 0.4, ease }} />}
          </button>
        </span>
      ))}
    </div>
  );
}

const LINKS = [
  { id: "top", key: "home", href: "/#top" },
  { id: "story", key: "story", href: "/#story" },
  { id: "family", key: "family", href: "/#family" },
  { id: "memories", key: "memories", href: "/#memories" },
  { id: "gallery", key: "gallery", href: "/gallery" },
] as const;

export default function Header() {
  const { t, l } = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string>("top");
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" }
    );
    ["top", "story", "family", "timeline", "gallery", "memories", "letters", "media", "contribute"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, []);

  useEffect(() => {
    const lenis = getLenis();
    if (open) {
      lenis?.stop();
      setTimeout(() => closeRef.current?.focus(), 50);
    } else lenis?.start();
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
        menuBtn.current?.focus();
      }
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  const navActive = (id: string) => active === id || (id === "story" && active === "timeline") || (id === "gallery" && active === "media") || (id === "memories" && (active === "letters" || active === "contribute"));

  return (
    <>
      <a href="#content" className="sr-only z-[90] rounded bg-white px-4 py-2 text-burgundy focus:not-sr-only focus:fixed focus:start-4 focus:top-4">
        {t.skip}
      </a>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-500",
          scrolled ? "bg-ivory/90 shadow-[0_1px_0_var(--color-line)] backdrop-blur-md" : "bg-transparent"
        )}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="mx-auto flex h-[4.5rem] max-w-[96rem] items-center gap-6 px-[var(--spacing-gutter)]">
          <TLink href="/#top" className="flex items-center gap-2.5 text-burgundy">
            <RoseBud className="h-8 w-6" still />
            <span className="font-display text-[1.35rem] leading-none">{l(profile.name)}</span>
          </TLink>

          <nav aria-label={t.nav.menu} className="ms-auto hidden items-center gap-1 md:flex">
            {LINKS.map((link) => (
              <TLink
                key={link.id}
                href={link.href}
                aria-current={navActive(link.id) ? "true" : undefined}
                className={cn("relative px-3.5 py-3 text-[0.95rem] transition-colors", navActive(link.id) ? "text-burgundy" : "text-charcoal/75 hover:text-charcoal")}
              >
                {t.nav[link.key]}
                {navActive(link.id) && <motion.span layoutId="nav-u" className="absolute inset-x-3.5 bottom-2 h-px bg-burgundy" transition={{ duration: 0.5, ease }} />}
              </TLink>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-2 md:ms-4">
            <LanguageSwitcher className="hidden sm:flex" />
            <TLink
              href="/share"
              className="hidden min-h-11 items-center rounded-full border border-rose/40 px-5 text-[0.92rem] text-burgundy transition-colors hover:border-rose hover:bg-rose hover:text-white sm:inline-flex"
            >
              {t.nav.share}
            </TLink>
            <button
              ref={menuBtn}
              type="button"
              onClick={() => setOpen(true)}
              aria-label={t.nav.menu}
              aria-expanded={open}
              aria-controls="mobile-menu"
              className="flex h-11 w-11 items-center justify-center text-burgundy md:hidden"
            >
              <Menu className="h-6 w-6" strokeWidth={1.4} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label={t.nav.menu}
            data-lenis-prevent
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-[80] flex flex-col overflow-y-auto bg-ivory px-[var(--spacing-gutter)] pb-10"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            <div className="flex h-[4.5rem] items-center justify-between">
              <span className="flex items-center gap-2.5 text-burgundy">
                <RoseBud className="h-8 w-6" still />
                <span className="font-display text-[1.35rem]">{l(profile.name)}</span>
              </span>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label={t.nav.close} className="flex h-11 w-11 items-center justify-center text-burgundy">
                <X className="h-6 w-6" strokeWidth={1.4} aria-hidden />
              </button>
            </div>
            <nav aria-label={t.nav.menu} className="mt-10 flex flex-col">
              {LINKS.map((link, i) => (
                <motion.div key={link.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.05, duration: 0.5, ease }}>
                  <TLink href={link.href} onClick={() => setOpen(false)} className="flex items-baseline gap-4 border-b border-line py-4">
                    <span className="font-display text-[2.1rem] font-light leading-tight text-charcoal">{t.nav[link.key]}</span>
                  </TLink>
                </motion.div>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-6 pt-10">
              <LanguageSwitcher large />
              <TLink href="/share" onClick={() => setOpen(false)} className="inline-flex min-h-12 w-fit items-center rounded-full bg-rose px-7 text-white">
                {t.nav.share}
              </TLink>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
