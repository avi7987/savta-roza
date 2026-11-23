"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { Memory } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { ADD_TYPE, MEM_KINDS, isMemory, memKind, type MemKind } from "@/lib/memoryKinds";
import { MemoryCard } from "../sections/Memories";
import { STATIC, TLink } from "../Transition";
import { Container, DecadeMark, Eyebrow, cn } from "../ui";

/*
  The book of memories: everything the family wrote, recorded or told about a photo, in chapters by
  kind (her words, stories and letters, recipes, photos with a story, recordings and videos). A row
  of chapter names on top jumps to each; every chapter ends with a quiet note to add one more.
*/

export default function MemoriesView() {
  const { t } = useLang();
  const p = t.memories.page;
  const [list, setList] = useState<Memory[] | null>(null);
  const [here, setHere] = useState<MemKind>("words");

  useEffect(() => {
    if (STATIC) return setList([]);
    fetch("/api/memories")
      .then((r) => (r.ok ? r.json() : { memories: [] }))
      .then((d: { memories: Memory[] }) => setList((d.memories ?? []).filter(isMemory)))
      .catch(() => setList([]));
  }, []);

  const groups = useMemo(() => {
    const g = Object.fromEntries(MEM_KINDS.map((k) => [k, [] as Memory[]])) as Record<MemKind, Memory[]>;
    for (const m of list ?? []) g[memKind(m)].push(m);
    return g;
  }, [list]);

  // arriving from a note on the home page: straight to that memory, lit up for a moment
  useEffect(() => {
    if (!list?.length || !location.hash.startsWith("#m-")) return;
    const el = document.getElementById(location.hash.slice(1));
    if (!el) return;
    const go = () => {
      const lenis = (window as unknown as { __lenis?: { scrollTo: (el: HTMLElement, o: { offset: number }) => void } }).__lenis;
      if (lenis) lenis.scrollTo(el, { offset: -130 });
      else el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-rose/50");
      setTimeout(() => el.classList.remove("ring-2", "ring-rose/50"), 2800);
    };
    const id = setTimeout(go, 450);
    return () => clearTimeout(id);
  }, [list]);

  // the chapter being read is marked in the row on top
  useEffect(() => {
    if (!list) return;
    const io = new IntersectionObserver(
      (es) => {
        const e = es.filter((x) => x.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (e) setHere(e.target.id.slice(2) as MemKind);
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    MEM_KINDS.forEach((k) => {
      const el = document.getElementById(`k-${k}`);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [list]);

  const jump = (k: MemKind) => {
    const el = document.getElementById(`k-${k}`);
    if (!el) return;
    const lenis = (window as unknown as { __lenis?: { scrollTo: (el: HTMLElement, o: { offset: number }) => void } }).__lenis;
    if (lenis) lenis.scrollTo(el, { offset: -140 });
    else el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main id="content" className="pt-[4.5rem]">
      <Container className="py-12 md:py-20">
        <header className="flex max-w-3xl flex-col items-start gap-4">
          <Eyebrow>{t.memories.eyebrow}</Eyebrow>
          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="font-display text-[clamp(2.4rem,5.2vw,4rem)] font-medium leading-[1.05] text-burgundy">
            {p.title}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }} className="max-w-xl text-lg leading-relaxed text-ink-soft">
            {p.lead}
          </motion.p>
        </header>

        {/* the chapters, always within reach */}
        <nav aria-label={p.jump} className="sticky top-[4.5rem] z-10 mx-[calc(50%-50vw)] mt-10 overflow-x-auto bg-ivory/85 px-[max(var(--spacing-gutter),calc(50vw-50%))] pb-5 pt-3 backdrop-blur-md [mask-image:linear-gradient(to_bottom,black_70%,transparent)] [scrollbar-width:none]">
          <div className="inline-flex gap-1 whitespace-nowrap rounded-full bg-paper/95 p-1 shadow-[0_8px_20px_-14px_rgba(70,35,45,0.35)] ring-1 ring-line backdrop-blur-md">
            {MEM_KINDS.map((k) => (
              <button key={k} type="button" onClick={() => jump(k)} aria-current={here === k ? "true" : undefined} className={cn("relative min-h-10 rounded-full px-4 text-[0.92rem] transition-colors duration-300", here === k ? "text-burgundy" : "text-ink-soft hover:text-burgundy")}>
                {here === k && <motion.span layoutId="mem-chapter" aria-hidden className="absolute inset-0 rounded-full bg-blush/70" style={{ borderRadius: 999 }} transition={{ type: "spring", visualDuration: 0.4, bounce: 0 }} />}
                <span className="relative">
                  {p.kinds[k][0]}
                  {list && groups[k].length > 0 && <span className="ms-1.5 text-[0.8rem] tabular-nums text-rose">{groups[k].length}</span>}
                </span>
              </button>
            ))}
          </div>
        </nav>

        {!list ? (
          <div className="mt-10 h-64" aria-hidden />
        ) : (
          <div className="mt-6 flex flex-col gap-20 md:gap-28">
            {MEM_KINDS.map((k) => (
              <section key={k} id={`k-${k}`} aria-labelledby={`kt-${k}`} className="scroll-mt-36">
                <DecadeMark as="h2" id={`kt-${k}`} title={p.kinds[k][0]} count={groups[k].length ? groups[k].length : undefined} />
                <p className="mt-3 max-w-xl text-ink-soft">{p.kinds[k][1]}</p>
                <div className={cn("mt-8 gap-8", k === "words" ? "columns-1 sm:columns-2 lg:columns-3" : "columns-1 md:columns-2 lg:columns-3")}>
                  {groups[k].map((m, i) => (
                    <MemoryCard key={m.id} m={m} index={i} className="transition-[box-shadow] duration-700" />
                  ))}
                  <AddOne kind={k} empty={!groups[k].length} />
                </div>
              </section>
            ))}
          </div>
        )}
      </Container>
    </main>
  );
}

/** one more of the same kind: a quiet dashed note at the end of the chapter */
function AddOne({ kind, empty }: { kind: MemKind; empty: boolean }) {
  const { t } = useLang();
  const p = t.memories.page;
  const link = "inline-flex min-h-10 items-center gap-2 text-burgundy transition-colors hover:text-rose";
  return (
    <div className={cn("mb-8 flex break-inside-avoid flex-col gap-2 rounded-[18px] border border-dashed border-dusty/50 p-5 text-[0.95rem] transition-colors hover:border-rose/60 hover:bg-white/50", empty && "py-7")}>
      {empty && <p className="text-ink-soft">{p.empty[kind]}</p>}
      <div className="flex flex-wrap items-center gap-x-4">
        <TLink href={`/share?type=${ADD_TYPE[kind]}`} className={link}>
          <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-blush/60 text-rose">
            <Plus className="h-4 w-4" strokeWidth={1.8} />
          </span>
          {p.add[kind]}
        </TLink>
        {kind === "stories" && (
          <TLink href="/share?type=letter" className="min-h-10 text-ink-soft underline decoration-dusty/50 underline-offset-4 hover:text-burgundy">
            {p.add.letter}
          </TLink>
        )}
      </div>
    </div>
  );
}
