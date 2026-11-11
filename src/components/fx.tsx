"use client";

import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const wrap = (min: number, max: number, v: number) => {
  const r = max - min;
  return ((((v - min) % r) + r) % r) + min;
};

/** Thin gradient bar showing how far down the page you are. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 });
  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-rosa via-honey to-rosa rtl:origin-right"
    />
  );
}

/** Soft rose ring that trails the pointer and swells over anything clickable. Fine pointers only. */
export function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [down, setDown] = useState(false);
  const last = useRef<string | null>(null);
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const rx = useSpring(x, { stiffness: 260, damping: 26, mass: 0.6 });
  const ry = useSpring(y, { stiffness: 260, damping: 26, mass: 0.6 });

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setEnabled(true);
    const move = (e: globalThis.PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      const el = (e.target as Element | null)?.closest?.("[data-cursor],a,button,label");
      const next = el ? el.getAttribute("data-cursor") ?? "" : null;
      if (next !== last.current) {
        last.current = next;
        setHover(next);
      }
    };
    const dn = () => setDown(true);
    const up = () => setDown(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", dn);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", dn);
      window.removeEventListener("pointerup", up);
    };
  }, [x, y]);

  if (!enabled) return null;
  const size = hover === null ? 34 : hover ? 84 : 58;
  return (
    <>
      <motion.div aria-hidden style={{ x: rx, y: ry }} className="pointer-events-none fixed left-0 top-0 z-[90]">
        <motion.div
          animate={{
            width: size,
            height: size,
            scale: down ? 0.8 : 1,
            backgroundColor: hover ? "rgba(224,69,123,0.92)" : hover === "" ? "rgba(224,69,123,0.14)" : "rgba(224,69,123,0.06)",
            borderColor: hover === null ? "rgba(224,69,123,0.45)" : "rgba(224,69,123,0)",
          }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          className="flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[13px] font-medium text-white"
        >
          {hover ? <span>{hover}</span> : null}
        </motion.div>
      </motion.div>
      <motion.div aria-hidden style={{ x, y }} className="pointer-events-none fixed left-0 top-0 z-[91] h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rosa" />
    </>
  );
}

/** Pulls its child gently toward the pointer. */
export function Magnetic({ children, strength = 0.3, className }: { children: ReactNode; strength?: number; className?: string }) {
  const x = useSpring(0, { stiffness: 180, damping: 14, mass: 0.4 });
  const y = useSpring(0, { stiffness: 180, damping: 14, mass: 0.4 });
  return (
    <motion.div
      style={{ x, y }}
      className={cx("inline-flex", className)}
      onPointerMove={(e: PointerEvent<HTMLDivElement>) => {
        if (e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/** Card with a soft light that follows the pointer and a slight 3D tilt. */
export function Spotlight({ children, className, tilt = 6 }: { children: ReactNode; className?: string; tilt?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const rX = useSpring(0, { stiffness: 150, damping: 15 });
  const rY = useSpring(0, { stiffness: 150, damping: 15 });
  return (
    <motion.div
      ref={ref}
      style={{ rotateX: rX, rotateY: rY, transformPerspective: 900 }}
      onPointerMove={(e: PointerEvent<HTMLDivElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        e.currentTarget.style.setProperty("--mx", `${px * 100}%`);
        e.currentTarget.style.setProperty("--my", `${py * 100}%`);
        if (e.pointerType === "mouse") {
          rY.set((px - 0.5) * tilt);
          rX.set(-(py - 0.5) * tilt);
        }
      }}
      onPointerLeave={() => {
        rX.set(0);
        rY.set(0);
      }}
      className={cx("group/spot relative", className)}
    >
      {children}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover/spot:opacity-100"
        style={{ background: "radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), rgba(224,69,123,0.14), transparent 60%)" }}
      />
    </motion.div>
  );
}

/** Endless strip whose speed and lean follow how fast you scroll. */
export function VelocityMarquee({ children, baseVelocity = -2, className }: { children: ReactNode; baseVelocity?: number; className?: string }) {
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const smooth = useSpring(velocity, { damping: 50, stiffness: 400 });
  const factor = useTransform(smooth, [0, 1000], [0, 4], { clamp: false });
  const skewX = useTransform(smooth, [-2500, 2500], [10, -10]);
  const x = useTransform(baseX, (v) => `${wrap(-50, 0, v)}%`);
  const dir = useRef(1);

  useAnimationFrame((_, delta) => {
    let move = dir.current * baseVelocity * (delta / 1000);
    const f = factor.get();
    if (f < 0) dir.current = -1;
    else if (f > 0) dir.current = 1;
    move += dir.current * move * f;
    baseX.set(baseX.get() + move);
  });

  return (
    <div dir="ltr" className={cx("overflow-hidden", className)}>
      <motion.div style={{ x, skewX }} className="flex w-max flex-nowrap">
        <div className="flex shrink-0">{children}</div>
        <div className="flex shrink-0" aria-hidden>
          {children}
        </div>
      </motion.div>
    </div>
  );
}

const PETALS = Array.from({ length: 14 }, (_, i) => ({
  left: (i * 53) % 100,
  size: 10 + ((i * 7) % 12),
  dur: 16 + ((i * 11) % 14),
  delay: -((i * 5.3) % 26),
  sway: 4 + (i % 4),
  color: ["#f7a8c4", "#f9c9d8", "#e0457b", "#f3c77a"][i % 4],
}));

/** A handful of petals drifting down across the whole page. CSS-only, so it costs almost nothing. */
export function AmbientPetals() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[5] overflow-hidden">
      {PETALS.map((p, i) => (
        <span key={i} className="absolute top-0 block animate-[fall_var(--d)_linear_infinite]" style={{ left: `${p.left}%`, ["--d" as string]: `${p.dur}s`, animationDelay: `${p.delay}s` }}>
          <span className="block animate-[sway_var(--s)_ease-in-out_infinite_alternate]" style={{ ["--s" as string]: `${p.sway}s` }}>
            <span
              className="block rounded-[60%_40%_60%_40%] opacity-60"
              style={{ width: p.size, height: p.size * 0.75, backgroundColor: p.color }}
            />
          </span>
        </span>
      ))}
    </div>
  );
}
