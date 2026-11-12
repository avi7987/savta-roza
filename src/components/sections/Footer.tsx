"use client";

import { motion } from "motion/react";
import { profile } from "@/content";
import { useLang } from "@/lib/i18n";
import { ease } from "@/lib/motion";
import { RoseTop } from "../Botanical";
import { LanguageSwitcher } from "../Header";
import { TLink } from "../Transition";
import { Container } from "../ui";

export default function Footer() {
  const { t, l } = useLang();
  const links = [
    { href: "/#story", label: t.nav.story },
    { href: "/#family", label: t.nav.family },
    { href: "/#memories", label: t.nav.memories },
    { href: "/gallery", label: t.nav.gallery },
    { href: "/share", label: t.nav.share },
  ];
  return (
    <footer className="pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[var(--spacing-section)]">
      <Container className="flex flex-col items-center text-center">
        <RoseTop className="h-28 w-28" />
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease, delay: 0.6 }}
          className="mt-8 font-display text-[clamp(2.6rem,6vw,5rem)] font-light leading-tight text-burgundy"
        >
          {l(profile.closing)}
        </motion.p>
        <p className="mt-3 font-hand text-2xl text-rose">{l(profile.name)}</p>

        <nav aria-label={t.footer.nav} className="mt-16 flex flex-wrap justify-center gap-x-8 gap-y-2">
          {links.map((link) => (
            <TLink key={link.href} href={link.href} className="py-2 text-[0.95rem] text-charcoal/75 transition-colors hover:text-burgundy">
              {link.label}
            </TLink>
          ))}
        </nav>

        <div className="mt-12 flex w-full flex-col items-center gap-6 border-t border-line pt-8 sm:flex-row sm:justify-between">
          <span className="text-[0.85rem] text-ink-soft">
            {t.footer.made} · {t.footer.private}
          </span>
          <div className="flex items-center gap-6">
            <LanguageSwitcher />
            <TLink href="/#top" className="py-2 text-[0.85rem] text-ink-soft hover:text-burgundy">
              {t.footer.top} ↑
            </TLink>
          </div>
        </div>
      </Container>
    </footer>
  );
}
