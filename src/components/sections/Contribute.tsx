"use client";

import { BookOpen, Camera, Mic, Video } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { TLink } from "../Transition";
import { Container, Item, Reveal } from "../ui";

export default function Contribute() {
  const { t } = useLang();
  return (
    <section id="contribute" aria-labelledby="contribute-title" className="bg-burgundy py-[var(--spacing-section)] text-ivory">
      <Container className="grid items-center gap-14 lg:grid-cols-12">
        <Reveal className="flex flex-col gap-6 lg:col-span-6">
          <Item as="span" className="label !text-blush">
            {t.contribute.eyebrow}
          </Item>
          <Item as="h2" className="text-[clamp(2.3rem,4.8vw,4rem)] font-light leading-[1.1] text-ivory">
            <span id="contribute-title">{t.contribute.title}</span>
          </Item>
          <Item as="p" className="max-w-lg text-lg leading-relaxed text-ivory/80">
            {t.contribute.lead}
          </Item>
          <Item>
            <TLink
              href="/share"
              className="mt-2 inline-flex min-h-12 items-center rounded-full bg-ivory px-8 font-medium text-burgundy transition-[transform,background-color] duration-300 hover:-translate-y-0.5 hover:bg-white focus-visible:outline-ivory"
            >
              {t.contribute.cta}
            </TLink>
          </Item>
        </Reveal>
        <ul className="grid grid-cols-2 gap-3 lg:col-span-5 lg:col-start-8">
          {[Camera, Video, BookOpen, Mic].map((Icon, i) => (
            <li key={i} className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-white/[0.07] p-5 ring-1 ring-white/10">
              <Icon className="h-6 w-6 text-blush" strokeWidth={1.3} aria-hidden />
              <span className="text-[1rem] leading-snug text-ivory/90">{t.contribute.kinds[i]}</span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
