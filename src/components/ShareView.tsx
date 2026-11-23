"use client";

import { ArrowRight } from "lucide-react";
import { profile } from "@/content";
import { useLang } from "@/lib/i18n";
import { LeafSprig, RoseBud } from "./Botanical";
import { LanguageSwitcher } from "./Header";
import AddMemoryWizard from "./share/AddMemoryWizard";
import BulkUpload from "./share/BulkUpload";
import { TLink } from "./Transition";
import { Container, Item, Reveal } from "./ui";

/** The "Share a memory" page: an open notebook, words on one side, the form on the other. */
export default function ShareView({ bulk = false }: { bulk?: boolean }) {
  const { t, l } = useLang();
  return (
    <div className="min-h-[100svh] bg-ivory">
      <header className="relative z-10" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <Container wide className="flex h-[4.5rem] items-center justify-between">
          <TLink href="/" className="group inline-flex min-h-11 items-center gap-2 text-[0.95rem] text-burgundy">
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 ltr:rotate-180 ltr:group-hover:-translate-x-1" strokeWidth={1.5} aria-hidden />
            {t.share.back}
          </TLink>
          <LanguageSwitcher />
        </Container>
      </header>

      <main id="content">
        <Container wide className="grid gap-8 pb-[var(--spacing-section)] pt-4 sm:gap-14 sm:pt-8 lg:grid-cols-12 lg:gap-x-16 lg:pt-16">
          <Reveal className="flex flex-col gap-4 sm:gap-6 lg:col-span-4">
            <Item className="flex items-center gap-3 text-burgundy">
              <RoseBud className="h-10 w-7" still />
              <span className="font-display text-xl">{l(profile.name)}</span>
            </Item>
            <Item as="h1" className="text-[clamp(2.2rem,5.5vw,4.4rem)] font-medium leading-[1.05] text-burgundy">
              {t.share.title}
            </Item>
            <Item as="p" className="hidden max-w-md text-lg leading-[1.85] text-ink-soft sm:block">
              {t.share.lead}
            </Item>
            <Item>
              <LeafSprig className="mt-4 hidden w-56 lg:block" />
            </Item>
          </Reveal>
          <div className="rounded-[var(--radius-card)] bg-paper p-5 shadow-[var(--shadow-paper)] ring-1 ring-charcoal/[0.04] sm:p-10 lg:col-span-7 lg:col-start-6">
            {bulk ? <BulkUpload /> : <AddMemoryWizard />}
          </div>
        </Container>
      </main>
    </div>
  );
}
