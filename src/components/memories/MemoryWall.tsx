"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChefHat, Mail, Mic, RefreshCw } from "lucide-react";
import type { Memory } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { memKind } from "@/lib/memoryKinds";
import AudioPlayer from "../AudioPlayer";
import { TLink } from "../Transition";
import { cn } from "../ui";

/*
  The home page's wall of memories: a few notes of different sizes pinned at slightly different
  angles. Each one quietly fades into another memory at its own pace, so the wall stays the same
  size however many memories there are. Hovering, touching or playing something holds it still.
*/

type Shape = "big" | "small" | "tall" | "wide";
type Slot = { shape: Shape; cls: string; tilt: number; phone?: boolean };

// a six-column wall on a computer, two columns on a phone; dense packing fills the gaps
const SLOTS: Slot[] = [
  { shape: "big", cls: "col-span-2 row-span-2 lg:col-span-3", tilt: -0.6 },
  { shape: "small", cls: "col-span-1 lg:col-span-2", tilt: 0.9 },
  { shape: "tall", cls: "col-span-1 row-span-2 lg:col-span-1", tilt: -1.1 },
  { shape: "small", cls: "col-span-1 lg:col-span-2", tilt: 0.5 },
  { shape: "small", cls: "hidden lg:block lg:col-span-2", tilt: -0.4 },
  { shape: "wide", cls: "col-span-2 lg:col-span-4", tilt: 0.7 },
];

const len = (m: Memory) => (m.body?.length ?? 0) + (m.title?.length ?? 0);
/** how well a memory sits in a note of this shape: 0 does not fit, higher fits better */
function fit(m: Memory, shape: Shape) {
  const k = memKind(m);
  const n = len(m);
  if (m.mediaKind === "video") return shape === "big" ? 3 : shape === "wide" ? 2 : 0;
  if (m.mediaKind === "audio") return shape === "wide" ? 3 : shape === "big" ? 2 : 0;
  if (m.photoSrc) return shape === "tall" ? 3 : shape === "big" ? 2.5 : shape === "wide" ? 1 : 0;
  if (k === "words") return shape === "small" ? 3 : shape === "wide" ? 2 : shape === "tall" ? (n < 90 ? 1 : 0) : 1;
  if (k === "recipes") return shape === "big" ? 2 : shape === "small" || shape === "wide" ? 2 : 0;
  // stories and letters: long ones in the big notes, short ones in the small ones
  if (shape === "big") return n > 220 ? 3 : n > 90 ? 2 : 0.5;
  if (shape === "wide") return 2;
  if (shape === "small") return n < 160 ? 2 : 1;
  return n < 120 ? 1 : 0;
}

const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

export default function MemoryWall({ list }: { list: Memory[] }) {
  const { t } = useLang();
  const reduce = useReducedMotion();
  // fewer memories than notes: fewer notes, laid out so the wall has no holes
  const slots = useMemo(() => {
    if (list.length >= 6) return SLOTS;
    if (list.length === 5) return [...SLOTS.slice(0, 4), { ...SLOTS[5], cls: "col-span-2 lg:col-span-6" }];
    return SLOTS.slice(0, 4);
  }, [list.length]);

  const byId = useMemo(() => new Map(list.map((m) => [m.id, m])), [list]);
  // the order memories come around in; the ones shown least recently go first
  const queue = useRef<string[]>([]);
  const [shown, setShown] = useState<string[]>([]);

  const pick = useCallback(
    (shape: Shape, taken: Set<string>, kinds: Set<string>) => {
      const free = queue.current.filter((id) => !taken.has(id));
      const score = (id: string) => {
        const m = byId.get(id)!;
        const f = fit(m, shape);
        return f === 0 ? -1 : f + (kinds.has(memKind(m)) ? 0 : 1.5);
      };
      // the first few in line compete, so the wall changes in order but each note gets something that suits it
      const head = free.slice(0, 5);
      const best = head.reduce<string | undefined>((b, id) => (b === undefined || score(id) > score(b) ? id : b), undefined);
      const id = best && score(best) >= 0 ? best : free.find((x) => score(x) >= 0) ?? free[0];
      if (id) queue.current = [...queue.current.filter((x) => x !== id), id];
      return id;
    },
    [byId]
  );

  // a fresh wall for every visit
  useEffect(() => {
    queue.current = shuffle(list.map((m) => m.id));
    const taken = new Set<string>();
    const kinds = new Set<string>();
    const first = slots.map((s) => {
      const id = pick(s.shape, taken, kinds);
      if (id) {
        taken.add(id);
        kinds.add(memKind(byId.get(id)!));
      }
      return id ?? "";
    });
    setShown(first);
  }, [list, slots, pick, byId]);

  // each note changes at its own pace, and only while the wall is on screen and nobody is busy with it
  const wall = useRef<HTMLDivElement>(null);
  const held = useRef(0);
  const playing = useRef(0);
  const visible = useRef(false);
  const due = useRef<number[]>([]);
  const rotates = list.length > slots.length;

  const swap = useCallback(
    (i: number) =>
      setShown((cur) => {
        const taken = new Set(cur);
        const kinds = new Set(cur.filter((x, k) => k !== i && byId.has(x)).map((x) => memKind(byId.get(x)!)));
        const id = pick(slots[i].shape, taken, kinds);
        if (!id) return cur;
        const next = [...cur];
        next[i] = id;
        return next;
      }),
    [pick, slots, byId]
  );

  useEffect(() => {
    if (!rotates || reduce) return;
    const io = new IntersectionObserver(([e]) => (visible.current = e.isIntersecting), { threshold: 0.25 });
    if (wall.current) io.observe(wall.current);
    const now = Date.now();
    due.current = slots.map((_, i) => now + 6000 + i * 2300 + Math.random() * 2000);
    const id = window.setInterval(() => {
      const t0 = Date.now();
      if (!visible.current || held.current > 0 || playing.current > 0 || document.hidden) {
        // waiting does not make them all change at once afterwards
        due.current = due.current.map((d) => Math.max(d, t0 + 2500));
        return;
      }
      const i = due.current.findIndex((d) => d <= t0);
      if (i < 0) return;
      due.current[i] = t0 + 9000 + Math.random() * 6000;
      swap(i);
    }, 700);
    return () => {
      window.clearInterval(id);
      io.disconnect();
    };
  }, [rotates, reduce, slots, swap]);

  const all = () => slots.forEach((_, i) => setTimeout(() => swap(i), i * 140));

  return (
    <div>
      <div
        ref={wall}
        onPointerEnter={(e) => e.pointerType === "mouse" && (held.current = 1)}
        onPointerLeave={(e) => e.pointerType === "mouse" && (held.current = 0)}
        onTouchStart={() => {
          held.current = 1;
          window.setTimeout(() => (held.current = 0), 12000);
        }}
        onFocusCapture={() => (held.current = 1)}
        onBlurCapture={() => (held.current = 0)}
        onPlayCapture={() => playing.current++}
        onPauseCapture={() => (playing.current = Math.max(0, playing.current - 1))}
        className="grid grid-flow-dense auto-rows-[9.5rem] grid-cols-2 gap-3 sm:auto-rows-[10.5rem] sm:gap-4 lg:grid-cols-6 lg:gap-5"
      >
        {slots.map((s, i) => {
          const m = byId.get(shown[i]);
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px 0px -8% 0px" }}
              transition={{ duration: 0.8, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
              style={{ rotate: s.tilt }}
              className={cn("relative", s.cls)}
            >
              <AnimatePresence initial={false}>
                {m && (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, scale: 0.985, filter: "blur(6px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 1.01, filter: "blur(4px)" }}
                    transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0"
                  >
                    <Note m={m} shape={s.shape} tone={i} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
      {rotates && (
        <div className="mt-5 flex justify-center">
          <button type="button" onClick={all} className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-[0.92rem] text-ink-soft transition-colors hover:bg-white/70 hover:text-burgundy">
            <RefreshCw className="h-4 w-4" strokeWidth={1.6} aria-hidden />
            {t.memories.shuffle}
          </button>
        </div>
      )}
    </div>
  );
}

const TONES = ["bg-white", "bg-[#fbf3f1]", "bg-paper", "bg-[#fdf6ee]", "bg-white", "bg-[#f9f1f3]"];

/** one note on the wall: made for its shape, cut short with a soft fade, and opening the whole memory */
function Note({ m, shape, tone }: { m: Memory; shape: Shape; tone: number }) {
  const { t, lang } = useLang();
  const k = memKind(m);
  const body = (m.lang !== lang && m.translation) || m.body || "";
  const href = `/memories#m-${m.id}`;
  const card = "group relative flex h-full flex-col overflow-hidden rounded-[16px] border border-line shadow-[0_1px_2px_rgba(70,35,45,0.07),0_12px_26px_-16px_rgba(70,35,45,0.35)] transition-shadow duration-500 hover:shadow-[0_2px_4px_rgba(70,35,45,0.08),0_20px_38px_-18px_rgba(70,35,45,0.42)]";
  const by = (
    <span className="mt-auto flex items-end justify-between gap-2 pt-2">
      <span className="truncate font-hand text-[1.15rem] leading-tight text-[#a24a64]">{m.author}</span>
      {m.relation && <span className="shrink-0 truncate text-[0.75rem] text-ink-soft">{m.relation}</span>}
    </span>
  );
  // the whole note opens the memory in the book, unless it holds something to play
  const open = !m.mediaKind && (
    <TLink href={href} className="absolute inset-0 z-[1] rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose">
      <span className="sr-only">
        {t.memories.more}: {m.title || body.slice(0, 60)}
      </span>
    </TLink>
  );
  const fade = "[mask-image:linear-gradient(to_bottom,black_70%,transparent)]";

  if (m.photoSrc && !m.mediaKind) {
    const side = shape === "wide";
    return (
      <article className={cn(card, "bg-white p-2", side && "flex-row gap-3")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={m.photoSrc} alt="" loading="lazy" className={cn("rounded-[11px] bg-mount object-cover transition-transform duration-700 group-hover:scale-[1.02]", side ? "h-full w-2/5" : "min-h-0 w-full flex-1")} />
        <div className={cn("flex min-w-0 flex-col px-1.5 pt-2", side && "flex-1 py-1")}>
          {(m.title || body) && (
            <p dir="auto" className={cn("text-[0.95rem] leading-snug text-charcoal/90", side ? "line-clamp-4" : "line-clamp-2")}>
              {m.title ? <span className="font-display text-[1.05rem] text-burgundy">{m.title}</span> : body}
            </p>
          )}
          {by}
        </div>
        {open}
      </article>
    );
  }

  if (m.mediaKind) {
    return (
      <article className={cn(card, TONES[tone], "p-4 sm:p-5")}>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-blush/60 px-2.5 py-0.5 text-[0.75rem] text-burgundy">
          <Mic className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />
          {m.mediaKind === "audio" ? t.memories.audio : t.memories.video}
        </span>
        {m.title && <h3 className="mt-2 line-clamp-1 font-display text-[1.2rem] leading-snug text-burgundy">{m.title}</h3>}
        {m.mediaKind === "audio" && m.mediaSrc && <AudioPlayer src={m.mediaSrc} title={m.title || m.author} className="mt-3" />}
        {m.mediaKind === "video" && m.mediaSrc && <video src={m.mediaSrc} controls playsInline preload="metadata" className="mt-3 min-h-0 w-full flex-1 rounded-[10px] bg-black object-cover" />}
        <span className="mt-auto flex items-end justify-between gap-2 pt-2">
          <span className="truncate font-hand text-[1.15rem] leading-tight text-[#a24a64]">{m.author}</span>
          <TLink href={href} className="relative z-[2] shrink-0 text-[0.82rem] text-burgundy underline decoration-dusty/50 underline-offset-4">
            {t.memories.more}
          </TLink>
        </span>
      </article>
    );
  }

  if (k === "words") {
    const n = body.length;
    const size = shape === "big" ? (n < 60 ? "text-[2.2rem]" : "text-[1.7rem]") : n < 40 ? "text-[1.6rem]" : n < 90 ? "text-[1.3rem]" : "text-[1.1rem]";
    return (
      <article className={cn(card, "bg-[#fbf0f2] p-4 sm:p-5")}>
        <span aria-hidden className="-mb-4 -mt-2 font-display text-[3rem] leading-none text-rose/40">&ldquo;</span>
        <p dir="auto" className={cn("min-h-0 flex-1 overflow-hidden whitespace-pre-line font-display leading-[1.35] text-burgundy", size, fade)}>
          {body.trim()}
        </p>
        {by}
        {open}
      </article>
    );
  }

  const recipe = k === "recipes";
  const letter = m.type === "letter";
  return (
    <article
      className={cn(
        card,
        TONES[tone],
        "p-4 sm:p-5",
        recipe && "bg-[#fdf7ec] bg-[repeating-linear-gradient(to_bottom,transparent_0_27px,rgba(168,116,130,0.13)_27px_28px)]"
      )}
    >
      {(recipe || letter) && (
        <span className="mb-1.5 inline-flex w-fit items-center gap-1.5 text-[0.78rem] text-rose">
          {recipe ? <ChefHat className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden /> : <Mail className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />}
          {recipe ? t.memories.recipe : t.memories.letter}
        </span>
      )}
      {m.title && <h3 dir="auto" className={cn("font-display leading-snug text-burgundy", shape === "big" ? "text-[1.6rem]" : "line-clamp-2 text-[1.2rem]")}>{m.title}</h3>}
      {body && (
        <p dir="auto" className={cn("mt-1.5 min-h-0 flex-1 overflow-hidden whitespace-pre-line leading-[1.7] text-charcoal/85", shape === "big" && body.length < 260 ? "font-display text-[1.45rem] leading-[1.55] text-charcoal" : !m.title && shape !== "small" ? "font-display text-[1.25rem] leading-[1.55] text-charcoal" : "text-[0.98rem]", fade)}>
          {body}
        </p>
      )}
      {by}
      {open}
    </article>
  );
}
