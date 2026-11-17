"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChefHat, Mail, Mic, RefreshCw, Video } from "lucide-react";
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

// a six-column wall on a computer, two columns on a phone; dense packing fills the gaps.
// A few layouts, with and without a tall note; the wall takes the one its memories fill best.
const big: Slot = { shape: "big", cls: "col-span-2 row-span-2 lg:col-span-3", tilt: -0.6 };
const tall: Slot = { shape: "tall", cls: "col-span-1 row-span-2 lg:col-span-1", tilt: -1.1 };
const small = (cls: string, tilt: number): Slot => ({ shape: "small", cls, tilt });
const wide = (cls: string, tilt: number): Slot => ({ shape: "wide", cls, tilt });
const LAYOUTS: Slot[][] = [
  [big, small("col-span-1 lg:col-span-2", 0.9), tall, small("col-span-1 lg:col-span-2", 0.5), small("hidden lg:block lg:col-span-2", -0.4), wide("col-span-2 lg:col-span-4", 0.7)],
  [big, small("col-span-1 lg:col-span-3", 0.9), small("col-span-1 lg:col-span-3", -0.5), wide("col-span-2 lg:col-span-4", 0.7), small("hidden lg:block lg:col-span-2", -0.4)],
  [big, small("col-span-1 lg:col-span-2", 0.9), tall, small("col-span-1 lg:col-span-2", 0.5), wide("col-span-2 lg:col-span-6", 0.6)],
  [big, small("col-span-1 lg:col-span-2", 0.9), tall, small("col-span-1 lg:col-span-2", 0.5)],
  [big, small("col-span-1 lg:col-span-3", 0.9), small("col-span-1 lg:col-span-3", -0.5), wide("col-span-2 lg:col-span-6", 0.6)],
];

const len = (m: Memory) => (m.body?.length ?? 0) + (m.title?.length ?? 0);
/** how well a memory sits in a note of this shape: 0 never (it would be cut or squeezed), higher fits better */
function fit(m: Memory, shape: Shape) {
  const k = memKind(m);
  const n = len(m);
  // a video needs room to be seen
  if (m.mediaKind === "video") return shape === "big" ? 3 : 0;
  if (m.mediaKind === "audio") return shape === "wide" ? 3 : shape === "big" ? 1 : shape === "small" ? 1 : 0;
  // a photo goes to a note of its own shape: standing ones to the tall note, lying ones to the big or wide
  // one (shown whole, on a soft blur of itself, so a near miss is never cut); never squeezed into a small one
  if (m.photoSrc) {
    const r = m.photoRatio ?? 4 / 3;
    if (r < 0.9) return shape === "tall" ? 3 : shape === "big" ? 1.5 : 0;
    if (r > 1.15) return shape === "big" ? 3 : shape === "wide" ? 2 : 0;
    return shape === "big" ? 3 : shape === "tall" ? 1 : shape === "wide" ? 1 : 0;
  }
  if (k === "words") return shape === "small" ? 3 : shape === "wide" ? 2 : shape === "tall" ? (n < 90 ? 1 : 0) : n > 60 ? 1 : 0;
  if (k === "recipes") return shape === "big" ? 2 : shape === "small" || shape === "wide" ? 2 : 0;
  // stories and letters: long ones in the big notes, short ones in the small ones
  if (shape === "big") return n > 220 ? 3 : n > 90 ? 2 : 0.5;
  if (shape === "wide") return 2;
  if (shape === "small") return n < 160 ? 2 : 0.5;
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
  // fewer notes than memories, so there is always something waiting to come in; of the layouts that
  // allow that, the one where every note gets something that suits it
  const slots = useMemo(() => {
    const options = LAYOUTS.filter((l) => l.length < list.length);
    const score = (l: Slot[]) => {
      const left = [...list];
      let total = 0;
      for (const sl of [...l].sort((a, b) => (a.shape === "big" ? -1 : b.shape === "big" ? 1 : 0))) {
        let bi = -1;
        let bf = 0;
        left.forEach((m, k) => {
          const f = fit(m, sl.shape);
          if (f > bf) [bi, bf] = [k, f];
        });
        if (bi < 0) total -= 6;
        else {
          total += bf;
          left.splice(bi, 1);
        }
      }
      return total;
    };
    return options.reduce((b, l) => (score(l) > score(b) ? l : b), options[0] ?? LAYOUTS[3]);
  }, [list]);

  const byId = useMemo(() => new Map(list.map((m) => [m.id, m])), [list]);
  // the order memories come around in; the ones shown least recently go first
  const queue = useRef<string[]>([]);
  const [shown, setShown] = useState<string[]>([]);

  const pick = useCallback(
    (shape: Shape, taken: Set<string>, kinds: Set<string>, strict = false) => {
      const free = queue.current.filter((id) => !taken.has(id));
      const score = (id: string) => {
        const m = byId.get(id)!;
        const f = fit(m, shape);
        return f === 0 ? -1 : f + (kinds.has(memKind(m)) ? 0 : 1.5);
      };
      // the first few in line compete, so the wall changes in order but each note gets something that suits it
      // (the first wall of a visit looks at all of them)
      const head = strict ? free.slice(0, 5) : free;
      const best = head.reduce<string | undefined>((b, id) => (b === undefined || score(id) > score(b) ? id : b), undefined);
      const id = best && score(best) >= 0 ? best : free.find((x) => score(x) >= 0) ?? (strict ? undefined : free[0]);
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
  /** the note under the pointer (or focused) holds still; the others go on */
  const held = useRef(-1);
  const playing = useRef(new Set<number>());
  const visible = useRef(false);
  const due = useRef<number[]>([]);
  const rotates = list.length > slots.length;

  const swap = useCallback(
    (i: number) =>
      setShown((cur) => {
        const taken = new Set(cur);
        const kinds = new Set(cur.filter((x, k) => k !== i && byId.has(x)).map((x) => memKind(byId.get(x)!)));
        // only something that suits this note; otherwise it stays as it is
        const id = pick(slots[i].shape, taken, kinds, true);
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
      if (!visible.current || document.hidden) {
        // waiting does not make them all change at once afterwards
        due.current = due.current.map((d) => Math.max(d, t0 + 2500));
        return;
      }
      const busy = (k: number) => k === held.current || playing.current.has(k);
      due.current = due.current.map((d, k) => (busy(k) ? Math.max(d, t0 + 3000) : d));
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
        className="grid grid-flow-dense auto-rows-[9.5rem] grid-cols-2 gap-3 sm:auto-rows-[10.5rem] sm:gap-4 lg:grid-cols-6 lg:gap-5"
      >
        {slots.map((s, i) => {
          const m = byId.get(shown[i]);
          return (
            <motion.div
              key={i}
              // each note is laid on the board and settles at its own slight angle, as if pinned
              initial={reduce ? { opacity: 0, rotate: s.tilt } : { opacity: 0, y: -14, scale: 1.04, rotate: s.tilt * 4 }}
              whileInView={{ opacity: 1, y: 0, scale: 1, rotate: s.tilt }}
              viewport={{ once: true, margin: "0px 0px -8% 0px" }}
              transition={{ type: "spring", visualDuration: 0.7, bounce: 0.18, delay: 0.1 + i * 0.09, opacity: { duration: 0.4, delay: 0.1 + i * 0.09 } }}
              className={cn("relative", s.cls)}
              onPointerEnter={(e) => e.pointerType === "mouse" && (held.current = i)}
              onPointerLeave={(e) => e.pointerType === "mouse" && held.current === i && (held.current = -1)}
              onTouchStart={() => {
                held.current = i;
                window.setTimeout(() => held.current === i && (held.current = -1), 10000);
              }}
              onFocusCapture={() => (held.current = i)}
              onBlurCapture={() => held.current === i && (held.current = -1)}
              onPlayCapture={() => playing.current.add(i)}
              onPauseCapture={() => playing.current.delete(i)}
              onEndedCapture={() => playing.current.delete(i)}
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
    // a wide note: a long story sits beside the photo; a short caption is laid on the photo itself,
    // like a label on an album page, so the note never stands half empty
    if (shape === "wide" && (m.title || body).length <= 140) {
      return (
        <article className={cn(card, "bg-white p-2")}>
          <div className="relative h-full overflow-hidden rounded-[11px] bg-mount">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.photoSrc} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-55 blur-xl" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.photoSrc} alt="" loading="lazy" className="relative h-full w-full object-contain transition-transform duration-700 group-hover:scale-[1.02]" />
            <div className="absolute bottom-2.5 start-2.5 max-w-[60%] rounded-[10px] bg-paper/95 px-3 py-2 shadow-[0_6px_18px_-8px_rgba(70,35,45,0.45)] ring-1 ring-line">
              {(m.title || body) && (
                <p dir="auto" className="line-clamp-2 text-[0.92rem] leading-snug">
                  {m.title ? <span className="font-display text-[1.02rem] text-burgundy">{m.title}</span> : body}
                </p>
              )}
              <span className="block truncate font-hand text-[1.05rem] leading-tight text-[#a24a64]">{m.author}</span>
            </div>
          </div>
          {open}
        </article>
      );
    }
    const side = shape === "wide";
    return (
      <article className={cn(card, "bg-white p-2", side && "flex-row gap-3")}>
        {/* the whole photo, never cut: it sits on a soft, blurred copy of itself that fills the note */}
        <div className={cn("relative overflow-hidden rounded-[11px] bg-mount", side ? "h-full w-1/2" : "min-h-0 w-full flex-1")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.photoSrc} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-55 blur-xl" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.photoSrc} alt="" loading="lazy" className="relative h-full w-full object-contain transition-transform duration-700 group-hover:scale-[1.02]" />
        </div>
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
          {m.mediaKind === "audio" ? <Mic className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden /> : <Video className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />}
          {m.mediaKind === "audio" ? t.memories.audio : t.memories.video}
        </span>
        {m.title && <h3 className="mt-2 line-clamp-1 font-display text-[1.2rem] leading-snug text-burgundy">{m.title}</h3>}
        {m.mediaKind === "audio" && m.mediaSrc && <AudioPlayer src={m.mediaSrc} title={m.title || m.author} className="mt-3" />}
        {m.mediaKind === "video" && m.mediaSrc && <video src={m.mediaSrc} controls playsInline preload="metadata" className="mt-3 min-h-0 w-full flex-1 rounded-[10px] bg-black object-contain" />}
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
