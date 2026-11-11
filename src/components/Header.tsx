"use client";

import Link from "next/link";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { cn, RoseMark } from "./ui";
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

export default function Header() {
  const { t } = useLang();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 40));

  const links = [
    { href: "#timeline", label: t.nav.life },
    { href: "#album", label: t.nav.album },
    { href: "#videos", label: t.nav.videos },
    { href: "#help", label: t.nav.help },
  ];

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      className="fixed inset-x-0 top-3 z-50 flex justify-center px-3"
    >
      <div
        className={cn(
          "flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 rounded-full px-3 py-2 transition-all duration-500 sm:px-5",
          scrolled ? "bg-white/75 shadow-[0_8px_40px_-12px_rgba(163,22,74,0.25)] ring-1 ring-ink/5 backdrop-blur-xl" : "bg-transparent"
        )}
      >
        <Link href="/" className="flex items-center gap-2 text-ink">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blush text-rosa">
            <RoseMark className="h-6 w-6" />
          </span>
          <span className="text-lg font-bold tracking-tight">{t.brand}</span>
        </Link>
        <nav aria-label="main" className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-4 py-2 text-[15px] text-ink-soft transition-colors hover:bg-blush hover:text-rosa-deep">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <LangToggle compact />
          <Link
            href="/upload"
            className="hidden min-h-11 items-center gap-1.5 rounded-full bg-ink px-5 text-sm font-medium text-white transition-transform hover:scale-[1.03] sm:inline-flex"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t.add}
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
