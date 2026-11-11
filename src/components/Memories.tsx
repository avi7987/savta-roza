"use client";

import { Quote } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { PhotoFill, RoseMark, SectionHead } from "./ui";
import { Spotlight, VelocityMarquee } from "./fx";

type Item = { text: string; by: string; seed: number };

function MemoryCard({ m, dir }: { m: Item; dir: string }) {
  return (
    <div className="px-2.5">
      <Spotlight className="w-[19rem] rounded-3xl">
        <figure
          dir={dir}
          className="flex h-full flex-col gap-4 rounded-3xl bg-white p-5 shadow-[0_20px_50px_-25px_rgba(42,31,36,0.35)] ring-1 ring-ink/5"
        >
          {m.seed % 2 === 0 ? <PhotoFill seed={m.seed} className="h-36 rounded-2xl" /> : <Quote className="h-8 w-8 text-petal" aria-hidden />}
          <blockquote className="text-lg leading-snug text-ink">{m.text}</blockquote>
          <figcaption className="mt-auto flex items-center gap-2 text-sm text-ink-soft">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blush font-bold text-rosa-deep">{m.by.charAt(0)}</span>
            {m.by}
          </figcaption>
        </figure>
      </Spotlight>
    </div>
  );
}

export function WordsBand() {
  const { t } = useLang();
  return (
    <div className="relative z-10 -rotate-2 bg-rosa py-5 shadow-[0_20px_60px_-20px_rgba(224,69,123,0.6)]">
      <VelocityMarquee baseVelocity={-1.2}>
        {t.words.map((w, i) => (
          <span key={w} className="flex items-center gap-8 px-4 text-5xl font-black tracking-tight sm:text-7xl">
            <span className={i % 2 ? "text-white" : "text-transparent [-webkit-text-stroke:1.5px_#fff]"}>{w}</span>
            <RoseMark className="h-10 w-10 shrink-0 text-white/80" />
          </span>
        ))}
      </VelocityMarquee>
    </div>
  );
}

export default function Memories() {
  const { t, dir } = useLang();
  const items = t.memories.items.map((m, i) => ({ ...m, seed: i }));
  return (
    <section id="memories" className="relative z-10 py-28">
      <SectionHead title={t.memories.title} sub={t.memories.sub} />
      <div className="mt-14 flex flex-col gap-5 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <VelocityMarquee baseVelocity={-1.5} className="py-3">
          {items.slice(0, 3).concat(items.slice(0, 3)).map((m, i) => (
            <MemoryCard key={i} m={m} dir={dir} />
          ))}
        </VelocityMarquee>
        <VelocityMarquee baseVelocity={1.5} className="py-3">
          {items.slice(3).concat(items.slice(3)).map((m, i) => (
            <MemoryCard key={i} m={m} dir={dir} />
          ))}
        </VelocityMarquee>
      </div>
    </section>
  );
}
