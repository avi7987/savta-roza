"use client";

import { Quote } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { PhotoFill, SectionHead } from "./ui";

function Row({ items, reverse, dir }: { items: { text: string; by: string; seed: number }[]; reverse?: boolean; dir: string }) {
  const content = (hidden: boolean) => (
    <div aria-hidden={hidden} className={`flex shrink-0 gap-[var(--gap)] ${reverse ? "animate-marquee-reverse" : "animate-marquee"} group-hover:[animation-play-state:paused]`}>
      {items.map((m, i) => (
        <figure
          key={i}
          dir={dir}
          className="flex w-[19rem] shrink-0 flex-col gap-4 rounded-3xl bg-white p-5 shadow-[0_20px_50px_-25px_rgba(42,31,36,0.35)] ring-1 ring-ink/5 transition-transform duration-500 hover:-translate-y-1 hover:rotate-[-1deg]"
        >
          {m.seed % 2 === 0 ? (
            <PhotoFill seed={m.seed} className="h-36 rounded-2xl" />
          ) : (
            <Quote className="h-8 w-8 text-petal" aria-hidden />
          )}
          <blockquote className="text-lg leading-snug text-ink">{m.text}</blockquote>
          <figcaption className="mt-auto flex items-center gap-2 text-sm text-ink-soft">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blush font-bold text-rosa-deep">{m.by.charAt(0)}</span>
            {m.by}
          </figcaption>
        </figure>
      ))}
    </div>
  );
  return (
    <div dir="ltr" className="group flex overflow-hidden [--gap:1.25rem] gap-[var(--gap)] py-3 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      {content(false)}
      {content(true)}
    </div>
  );
}

export default function Memories() {
  const { t, dir } = useLang();
  const items = t.memories.items.map((m, i) => ({ ...m, seed: i }));
  const a = items.slice(0, 3).concat(items.slice(0, 3));
  const b = items.slice(3).concat(items.slice(3));
  return (
    <section id="memories" className="relative py-28">
      <SectionHead title={t.memories.title} sub={t.memories.sub} />
      <div className="mt-14 flex flex-col gap-4" style={{ ["--duration" as string]: "55s" }}>
        <Row items={a} dir={dir} />
        <Row items={b} reverse dir={dir} />
      </div>
    </section>
  );
}
