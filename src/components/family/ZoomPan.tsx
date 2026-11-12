"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { cn } from "../ui";

const MAX = 3;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * Shows wide content (the family rings) whole on a small screen, and lets you come closer:
 * pinch or the +/− buttons to zoom, one finger to move around once zoomed in.
 * At the starting size the page scrolls through it as usual.
 */
export default function ZoomPan({ width, children }: { width: number; children: ReactNode }) {
  const { t } = useLang();
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const [h, setH] = useState(0);
  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const [anim, setAnim] = useState(false);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ s: number; x: number; y: number; d: number; mx: number; my: number } | null>(null);
  const moved = useRef(false);

  const size = useCallback(() => {
    const cw = box.current?.clientWidth ?? width;
    const ih = inner.current?.offsetHeight ?? 0;
    const f = Math.min(1, cw / width);
    setFit(f);
    setH(ih * f);
    return f;
  }, [width]);

  // keep the content inside the frame
  const bound = useCallback(
    (v: { s: number; x: number; y: number }) => {
      const cw = box.current?.clientWidth ?? width;
      const ih = inner.current?.offsetHeight ?? 0;
      const s = clamp(v.s, fit, MAX);
      const w = width * s;
      const hh = ih * s;
      const x = w <= cw ? (cw - w) / 2 : clamp(v.x, cw - w, 0);
      const y = hh <= h ? (h - hh) / 2 : clamp(v.y, h - hh, 0);
      return { s, x, y };
    },
    [fit, h, width]
  );

  const reset = useCallback(() => {
    const f = size();
    const cw = box.current?.clientWidth ?? width;
    setView({ s: f, x: (cw - width * f) / 2, y: 0 });
  }, [size, width]);

  useLayoutEffect(() => {
    reset();
    const ro = new ResizeObserver(() => reset());
    if (box.current) ro.observe(box.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [reset]);

  const zoomAt = (factor: number, cx?: number, cy?: number) => {
    const cw = box.current?.clientWidth ?? width;
    const px = cx ?? cw / 2;
    const py = cy ?? h / 2;
    setAnim(true);
    setView((v) => {
      const s = clamp(v.s * factor, fit, MAX);
      const k = s / v.s;
      return bound({ s, x: px - (px - v.x) * k, y: py - (py - v.y) * k });
    });
  };

  useEffect(() => {
    if (!anim) return;
    const id = setTimeout(() => setAnim(false), 320);
    return () => clearTimeout(id);
  }, [anim, view]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const begin = () => {
    const p = [...pts.current.values()];
    if (!p.length) return (start.current = null);
    const mx = p.reduce((a, b) => a + b.x, 0) / p.length;
    const my = p.reduce((a, b) => a + b.y, 0) / p.length;
    const d = p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
    start.current = { ...view, d, mx, my };
  };

  const zoomed = view.s > fit + 0.01;

  return (
    <div className="relative">
      <div
        ref={box}
        data-lenis-prevent={zoomed ? true : undefined}
        className="relative overflow-hidden rounded-[var(--radius-card)]"
        style={{ height: h || undefined, touchAction: zoomed ? "none" : "pan-y" }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") return;
          pts.current.set(e.pointerId, local(e));
          moved.current = false;
          begin();
        }}
        onPointerMove={(e) => {
          if (!pts.current.has(e.pointerId) || !start.current) return;
          pts.current.set(e.pointerId, local(e));
          const p = [...pts.current.values()];
          const st = start.current;
          const mx = p.reduce((a, b) => a + b.x, 0) / p.length;
          const my = p.reduce((a, b) => a + b.y, 0) / p.length;
          if (p.length > 1 && st.d > 0) {
            const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
            const s = clamp(st.s * (d / st.d), fit, MAX);
            const k = s / st.s;
            moved.current = true;
            setView(bound({ s, x: mx - (st.mx - st.x) * k, y: my - (st.my - st.y) * k }));
          } else if (zoomed) {
            if (Math.hypot(mx - st.mx, my - st.my) > 6) moved.current = true;
            setView(bound({ s: st.s, x: st.x + (mx - st.mx), y: st.y + (my - st.my) }));
          }
        }}
        onPointerUp={(e) => {
          pts.current.delete(e.pointerId);
          begin();
        }}
        onPointerCancel={(e) => {
          pts.current.delete(e.pointerId);
          begin();
        }}
        onClickCapture={(e) => {
          // a drag that ends on a person is not a tap on them
          if (moved.current) {
            e.preventDefault();
            e.stopPropagation();
            moved.current = false;
          }
        }}
      >
        <div
          ref={inner}
          className={cn("absolute top-0 origin-top-left", anim && "transition-transform duration-300 ease-out")}
          style={{ width, left: 0, transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}
        >
          {children}
        </div>
      </div>

      <div className="mx-auto mt-3 flex w-fit items-center gap-1 rounded-full bg-white/90 p-1 shadow-[var(--shadow-paper)] ring-1 ring-charcoal/5">
        <button type="button" onClick={() => zoomAt(1 / 1.6)} disabled={!zoomed} aria-label={t.family.zoomOut} className="flex h-10 w-10 items-center justify-center rounded-full text-burgundy disabled:opacity-30">
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={() => zoomAt(1.6)} disabled={view.s >= MAX - 0.01} aria-label={t.family.zoomIn} className="flex h-10 w-10 items-center justify-center rounded-full text-burgundy disabled:opacity-30">
          <Plus className="h-4 w-4" aria-hidden />
        </button>
        {zoomed && (
          <button
            type="button"
            onClick={() => {
              setAnim(true);
              reset();
            }}
            aria-label={t.family.zoomReset}
            className="flex h-10 w-10 items-center justify-center rounded-full text-burgundy"
          >
            <Maximize2 className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
