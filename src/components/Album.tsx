"use client";

import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { RotateCw } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { PhotoFill, SectionHead, cn } from "./ui";

type Photo = { cap: string; decade: string; by: string; seed: number };

function Polaroid({ p, x, y, rot, w, i, label, backLabel, flipLabel, constraints }: {
  p: Photo; x: number; y: number; rot: number; w: number; i: number; label: string; backLabel: string; flipLabel: string;
  constraints: React.RefObject<HTMLDivElement | null>;
}) {
  const [flipped, setFlipped] = useState(false);
  const dragging = useRef(false);
  const rx = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const ry = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const [z, setZ] = useState(i);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 18);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 18);
  };

  return (
    <motion.div
      drag
      dragConstraints={constraints}
      dragElastic={0.15}
      dragMomentum
      onDragStart={() => {
        dragging.current = true;
        setZ(100 + Date.now() % 1000);
      }}
      onDragEnd={() => setTimeout(() => (dragging.current = false), 50)}
      initial={{ opacity: 0, scale: 0.6, rotate: rot * 3, y: 80 }}
      animate={{ opacity: 1, scale: 1, rotate: rot, y: 0 }}
      exit={{ opacity: 0, scale: 0.7 }}
      transition={{ type: "spring", stiffness: 120, damping: 16, delay: i * 0.07 }}
      whileHover={{ scale: 1.06 }}
      whileDrag={{ scale: 1.1, cursor: "grabbing" }}
      className="absolute cursor-grab touch-none"
      style={{ left: x, top: y, width: w, zIndex: z, perspective: 1000 }}
      onPointerMove={onMove}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
    >
      <motion.button
        type="button"
        aria-label={`${flipLabel}: ${p.cap}`}
        aria-pressed={flipped}
        onClick={() => {
          if (!dragging.current) setFlipped((f) => !f);
        }}
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        className="relative block w-full text-start"
      >
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformStyle: "preserve-3d" }}
          className="relative"
        >
          <div className="rounded-xl bg-white p-2.5 pb-10 shadow-[0_25px_50px_-20px_rgba(42,31,36,0.45)] ring-1 ring-ink/5 [backface-visibility:hidden]">
            <PhotoFill seed={p.seed} className="aspect-[4/5] rounded-md" />
            <span className="absolute inset-x-0 bottom-2.5 text-center font-hand text-2xl font-bold text-ink">{p.cap}</span>
          </div>
          <div className="absolute inset-0 flex flex-col justify-between rounded-xl bg-blush p-4 shadow-xl ring-1 ring-rosa/20 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <span className="rounded-full bg-white px-3 py-1 text-xs text-rosa-deep w-fit">{label}</span>
            <span className="font-hand text-3xl font-bold leading-tight text-ink">{p.cap}</span>
            <span className="text-sm text-ink-soft">
              {backLabel} {p.by}
            </span>
          </div>
        </motion.div>
      </motion.button>
    </motion.div>
  );
}

export default function Album() {
  const { t, lang } = useLang();
  const table = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1100);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    const el = table.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const photos: Photo[] = t.album.photos.map((p, i) => ({ ...p, seed: i }));
  const decades = Array.from(new Set(photos.map((p) => p.decade))).sort((a, b) => (a === "00" ? 1 : b === "00" ? -1 : a.localeCompare(b)));
  const shown = photos.filter((p) => !filter || p.decade === filter);

  const cols = width > 900 ? 4 : width > 560 ? 3 : 2;
  const w = Math.min(230, width / cols - 24);
  const rowH = w * 1.45;
  const rows = Math.ceil(shown.length / cols);
  const height = Math.max(rows * rowH + 80, 420);

  return (
    <section id="album" className="relative py-28">
      <SectionHead title={t.album.title} sub={t.album.sub} />

      <div className="mx-auto mt-10 flex max-w-6xl flex-wrap justify-center gap-2 px-5" role="group" aria-label={t.album.title}>
        {[null, ...decades].map((d) => {
          const on = filter === d;
          return (
            <button
              key={d ?? "all"}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(d)}
              className={cn("relative min-h-11 rounded-full px-5 text-[15px] transition-colors", on ? "text-white" : "bg-white text-ink-soft ring-1 ring-ink/10 hover:text-ink")}
            >
              {on && <motion.span layoutId="decade-pill" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
              <span className="relative">{d ? t.album.decadeLabel(d) : t.album.all}</span>
            </button>
          );
        })}
      </div>

      <div className="mx-auto mt-10 max-w-6xl px-5">
        <motion.div
          ref={table}
          style={{ height }}
          className="relative overflow-hidden rounded-[2.5rem] bg-[radial-gradient(ellipse_at_top,#fff_0%,#fbeee9_60%,#f6e1da_100%)] shadow-inner ring-1 ring-ink/5"
        >
          <AnimatePresence>
            {shown.map((p, i) => {
              const col = i % cols;
              const row = Math.floor(i / cols);
              const jx = Math.sin(p.seed * 7.7) * 14;
              const jy = Math.cos(p.seed * 5.3) * 18;
              const x = ((col + 0.5) / cols) * width - w / 2 + jx;
              const y = 40 + row * rowH + jy;
              const rot = Math.sin(p.seed * 3.1) * 8;
              return (
                <Polaroid
                  key={`${filter}-${p.seed}-${lang}`}
                  p={p}
                  x={x}
                  y={y}
                  rot={rot}
                  w={w}
                  i={i}
                  label={t.album.decadeLabel(p.decade)}
                  backLabel={t.album.back}
                  flipLabel={t.album.flip}
                  constraints={table}
                />
              );
            })}
          </AnimatePresence>
          <RotateCw aria-hidden className="pointer-events-none absolute bottom-5 end-5 h-5 w-5 text-ink/20" />
        </motion.div>
      </div>
    </section>
  );
}
