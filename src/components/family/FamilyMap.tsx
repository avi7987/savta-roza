"use client";

import "@xyflow/react/dist/style.css";
import { MiniMap, ReactFlow, ReactFlowProvider, useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { motion, useReducedMotion } from "motion/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Expand, Maximize2, Minus, Plus, RotateCcw, Search, X } from "lucide-react";
import { ROSA } from "@/content/family";
import { chainToRosa } from "@/lib/family";
import { layoutFamily, type FamilyLayout } from "@/lib/familyLayout";
import { useLang } from "@/lib/i18n";
import { nameScore } from "@/lib/names";
import { cn } from "../ui";
import PersonCard, { CARD_H, CARD_W, type CardState } from "./PersonCard";
import type { useFamily } from "./useFamily";

type Fam = ReturnType<typeof useFamily>;
const LAYOUT = { cardW: CARD_W, cardH: CARD_H, gap: 26, coupleGap: 32, rowGap: 96 };
/** room on the reading side for the names of the generations */
const BAND = 150;

/** the people closest to someone: parents, partners, brothers and sisters, children */
export function immediateFamily(fam: Fam, id: string) {
  const g = fam.graph;
  return new Set([id, ...g.realParentsOf(id), ...g.partnersOf(id), ...g.siblingsOf(id), ...g.childrenOf(id)]);
}

/** a card just let out of a folded branch: where the pile was, relative to it, and when its turn comes */
type Appear = { dx: number; dy: number; delay: number };
type PersonData = { id: string; state: CardState; onOpen: (id: string) => void; onAdd: (id: string) => void; fold?: { folded: boolean; hidden: number; toggle: () => void }; fam: Fam; appear?: Appear };
type LinesData = { layout: FamilyLayout; lit: Set<string> | null; path: string[]; fam: Fam; labels: { y: number; text: string }[]; rtl: boolean; selected: string | null };

const PersonNode = memo(function PersonNode({ data }: NodeProps<Node<PersonData>>) {
  const { fam, id } = data;
  const p = fam.graph.byId.get(id)!;
  const a = data.appear;
  return (
    <div dir="auto" className={a ? "card-pop" : undefined} style={a ? ({ "--dx": `${a.dx}px`, "--dy": `${a.dy}px`, animationDelay: `${a.delay}ms` } as CSSProperties) : undefined}>
      <PersonCard person={p} name={fam.nameOf(id)} relation={fam.relLabel(id)} state={data.state} onOpen={() => data.onOpen(id)} onAdd={p.placeholder ? undefined : () => data.onAdd(id)} fold={data.fold} />
    </div>
  );
});

/** all the lines in one drawing, underneath the cards, with the generations named at the side */
const LinesNode = memo(function LinesNode({ data }: NodeProps<Node<LinesData>>) {
  const { layout, lit, path, fam, labels, rtl, selected } = data;
  const reduce = useReducedMotion();
  const virtual = (p: string) => !!fam.graph.byId.get(p)?.virtual;
  // a line is on the way to Rosa when it joins two neighbours in the chain
  const steps = new Set(path.slice(1).map((p, i) => [p, path[i]].sort().join("|")));
  const onPath = (people: string[]) => {
    const real = people.filter((p) => !virtual(p));
    const last = real[real.length - 1];
    return real.slice(0, -1).some((p) => steps.has([p, last].sort().join("|"))) || (real.length === 2 && steps.has([...real].sort().join("|")));
  };
  const inFamily = (people: string[]) => {
    if (!lit) return null;
    const real = people.filter((p) => !virtual(p));
    return real.length > 0 && real.every((p) => lit.has(p));
  };
  // how many steps from Rosa a line starts, so the way to the chosen person is drawn from her outward
  const fromRosa = new Map(path.map((p, i) => [p, i]));
  const rosaAt = fromRosa.get(ROSA) ?? 0;
  const stepOf = (people: string[]) => Math.min(...people.filter((p) => fromRosa.has(p)).map((p) => Math.abs(fromRosa.get(p)! - rosaAt)));
  const w = layout.width + BAND;
  const x0 = rtl ? 0 : -BAND;
  return (
    <svg width={layout.width} height={layout.height} className="pointer-events-none overflow-visible" aria-hidden>
      {labels.map((b) => (
        <g key={b.y}>
          <line x1={x0} x2={x0 + w} y1={b.y - 48} y2={b.y - 48} stroke="var(--color-rail)" strokeDasharray="2 6" strokeOpacity={0.7} />
          <text x={rtl ? layout.width + BAND - 8 : -BAND + 8} y={b.y - 26} textAnchor={rtl ? "end" : "start"} fontSize={13} letterSpacing={0.6} fill="var(--color-ink-soft)" style={{ fontFamily: "var(--font-sans)" }}>
            {b.text}
          </text>
        </g>
      ))}
      {layout.connectors.map((c) => {
        const route = path.length > 1 && onPath(c.people);
        const fam_ = route || inFamily(c.people);
        return (
          <path
            key={c.id}
            d={c.d}
            fill="none"
            stroke={fam_ ? "var(--color-dusty)" : c.kind === "couple" ? "var(--color-dusty)" : "var(--color-rail)"}
            strokeWidth={fam_ ? 2.2 : c.kind === "couple" ? 2 : 1.7}
            strokeOpacity={lit && !fam_ ? 0.3 : 1}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ transition: "stroke 0.3s, stroke-opacity 0.3s, stroke-width 0.3s" }}
          />
        );
      })}
      {/* the way from Rosa to the chosen person, drawn in rose one step after another */}
      {path.length > 1 &&
        layout.connectors
          .filter((c) => onPath(c.people))
          .map((c) => (
            <motion.path
              key={`${selected}-${c.id}`}
              d={c.d}
              fill="none"
              stroke="var(--color-rose)"
              strokeWidth={3.2}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={reduce ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ pathLength: { duration: 0.45, ease: [0.4, 0, 0.2, 1], delay: 0.15 + stepOf(c.people) * 0.32 }, opacity: { duration: 0.01, delay: 0.15 + stepOf(c.people) * 0.32 } }}
            />
          ))}
      {layout.junctions.map((j) => (
        <circle key={j.id} cx={j.x} cy={j.y} r={5} fill="var(--color-paper)" stroke="var(--color-rail)" strokeWidth={1.6} strokeDasharray="2 2" />
      ))}
    </svg>
  );
});

const nodeTypes = { person: PersonNode, lines: LinesNode };

type Props = { fam: Fam; onOpen: (id: string) => void; onAdd: (id: string) => void; phone?: boolean };

function Board({ fam, onOpen, onAdd, phone = false }: Props) {
  const { t, dir, lang } = useLang();
  const m = t.family.map;
  const flow = useReactFlow();
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [qOpen, setQOpen] = useState(false);
  const ready = useRef(false);
  // on a phone the tree can take the whole screen, so a finger has room to move around it
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!full) return;
    // Escape leaves the full screen, unless it is closing a person's card on top of it
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector('[aria-modal="true"]:not(.family-map)') && setFull(false);
    window.addEventListener("keydown", esc);
    const html = document.documentElement;
    html.style.overflow = "hidden";
    html.dataset.treeFull = "";
    return () => {
      window.removeEventListener("keydown", esc);
      html.style.overflow = "";
      delete html.dataset.treeFull;
    };
  }, [full]);

  const layout = useMemo(() => layoutFamily(fam.graph, { ...LAYOUT, rtl: dir === "rtl", collapsed }), [fam.graph, dir, collapsed]);
  const at = useMemo(() => new Map(layout.cards.map((c) => [c.id, c])), [layout]);
  const path = useMemo(() => (selected && at.has(selected) ? chainToRosa(fam.graph, selected) : []), [fam, selected, at]);
  const lit = useMemo(() => (selected && at.has(selected) ? new Set([...immediateFamily(fam, selected), ...path]) : null), [fam, selected, at, path]);
  const labels = useMemo(() => layout.rows.map((r) => ({ y: r.y, text: m.gen(r.level) })), [layout, m]);

  // a branch being opened: its people come out of the pile one after another
  const unfolding = useRef<string | null>(null);
  const toggle = useCallback((id: string) => setCollapsed((cur) => {
    const next = new Set(cur);
    if (next.has(id)) {
      next.delete(id);
      unfolding.current = id;
    } else next.add(id);
    return next;
  }), []);
  const shownBefore = useRef<Set<string>>(new Set());
  const appear = useMemo(() => {
    const out = new Map<string, Appear>();
    const from = unfolding.current ? layout.cards.find((c) => c.id === unfolding.current) : undefined;
    if (!from) return out;
    const fresh = layout.cards.filter((c) => !shownBefore.current.has(c.id));
    fresh
      .sort((a, b) => a.level - b.level || Math.abs(a.x - from.x) - Math.abs(b.x - from.x))
      .forEach((c, i) => out.set(c.id, { dx: from.x - c.x, dy: from.y - c.y, delay: 120 + Math.min(i, 12) * 70 }));
    return out;
  }, [layout]);
  useEffect(() => {
    shownBefore.current = new Set(layout.cards.map((c) => c.id));
    unfolding.current = null;
  }, [layout]);

  const open = useCallback((id: string) => {
    setSelected(id);
    onOpen(id);
  }, [onOpen]);

  const nodes = useMemo<Node[]>(() => {
    const list: Node[] = [{ id: "__lines", type: "lines", position: { x: 0, y: 0 }, data: { layout, lit, path, fam, labels, rtl: dir === "rtl", selected }, draggable: false, selectable: false, focusable: false, zIndex: 0, width: layout.width, height: layout.height, style: { pointerEvents: "none" } }];
    for (const c of layout.cards) {
      const hasKids = fam.graph.childrenOf(c.id).length > 0 || c.hidden > 0;
      list.push({
        id: c.id,
        type: "person",
        position: { x: c.x, y: c.y },
        width: CARD_W,
        height: CARD_H,
        draggable: false,
        selectable: false,
        zIndex: 1,
        // not draggable, but the buttons on the card must still be clickable
        style: { pointerEvents: "all" },
        data: {
          id: c.id,
          fam,
          state: !lit ? "normal" : c.id === selected ? "selected" : path.includes(c.id) ? "path" : lit.has(c.id) ? "lit" : "dim",
          onOpen: open,
          onAdd,
          fold: hasKids && c.id !== ROSA ? { folded: collapsed.has(c.id), hidden: c.hidden, toggle: () => toggle(c.id) } : undefined,
          appear: appear.get(c.id),
        } satisfies PersonData,
      });
    }
    return list;
  }, [layout, lit, path, labels, dir, fam, selected, open, onAdd, collapsed, toggle, appear]);

  const centerOn = useCallback(
    (id: string, zoom?: number) => {
      const c = at.get(id);
      if (c) flow.setCenter(c.x + CARD_W / 2, c.y + CARD_H / 2, { zoom: zoom ?? Math.max(flow.getZoom(), 0.85), duration: 650 });
    },
    [at, flow]
  );

  // start with the whole family in view; if that makes the cards too small, start at Rosa's
  // generation instead, with her near the top
  const start = useCallback(() => {
    // wait for the whole family, or the view is set for the starting tree and lands in the wrong place
    if (ready.current || !layout.cards.length || !fam.loaded) return;
    const box = document.querySelector<HTMLElement>(".family-map")?.getBoundingClientRect();
    if (!box) return;
    ready.current = true;
    const fit = Math.min(1, (box.width * 0.9) / layout.width, (box.height * 0.85) / layout.height);
    const rosa = at.get(ROSA);
    if (fit >= (phone ? 0.5 : 0.55) || !rosa) flow.fitView({ padding: 0.1, maxZoom: 1 });
    else {
      const z = phone ? 0.7 : 0.75;
      flow.setCenter(rosa.x + CARD_W / 2, rosa.y + CARD_H / 2 + (box.height / 2 - 150) / z, { zoom: z });
    }
  }, [layout, flow, at, phone, fam.loaded]);
  // only once React Flow knows its own size, or the first move is lost
  const [inited, setInited] = useState(false);
  useEffect(() => {
    if (!inited) return;
    const id = setTimeout(start, 80);
    return () => clearTimeout(id);
  }, [inited, start]);

  const people = fam.graph.people.filter((p) => !p.virtual && at.has(p.id) && !p.placeholder);
  const results = q.trim()
    ? people
        .map((p) => ({ p, s: nameScore(q, [p.name, p.nameAlt ?? ""]) }))
        .filter((r) => r.s >= 0.6)
        .sort((a, b) => b.s - a.s)
        .slice(0, 7)
        .map((r) => r.p)
    : [];
  const pick = (id: string) => {
    setQ("");
    setQOpen(false);
    setSelected(id);
    centerOn(id, 1);
  };

  const btn = "flex h-10 w-10 items-center justify-center rounded-full text-burgundy hover:bg-blush/40 disabled:opacity-30";
  return (
    <div
      className={full ? "family-map fixed inset-0 z-[75] overflow-hidden bg-[#fbf7f2]" : cn("family-map relative overflow-hidden rounded-[18px] border border-line bg-[#fbf7f2]", phone ? "h-[72svh] min-h-[28rem]" : "h-[min(78vh,52rem)] min-h-[32rem]")}
      style={full ? { paddingTop: "env(safe-area-inset-top, 0px)" } : undefined}
      dir="ltr"
      role={full ? "dialog" : undefined}
      aria-modal={full || undefined}
      aria-label={full ? t.family.title : undefined}
    >
      <ReactFlow
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        minZoom={0.15}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        zoomOnPinch
        panOnScroll={false}
        preventScrolling={false}
        zoomOnDoubleClick={false}
        onPaneClick={() => setSelected(null)}
        onInit={() => setInited(true)}
        proOptions={{ hideAttribution: true }}
        className="[&_.react-flow__node]:cursor-default"
      >
        {!phone && layout.cards.length > 40 && (
          <MiniMap
            position="bottom-left"
            pannable
            zoomable
            ariaLabel={m.fit}
            nodeColor={(n) => (n.id === ROSA ? "var(--color-rose)" : n.type === "lines" ? "transparent" : "var(--color-rail)")}
            nodeStrokeWidth={0}
            maskColor="rgba(248,242,237,0.7)"
            style={{ width: 150, height: 96, borderRadius: 12, border: "1px solid var(--color-line)", background: "var(--color-paper)" }}
          />
        )}
      </ReactFlow>

      {/* toolbar */}
      <div dir={dir} className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2" style={full ? { top: "calc(0.75rem + env(safe-area-inset-top, 0px))" } : undefined}>
        <div className={cn("pointer-events-auto relative", phone ? "min-w-[11rem] flex-1" : "w-[min(100%,18rem)]")} lang={lang}>
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden />
          <input
            value={q}
            onChange={(e) => (setQ(e.target.value), setQOpen(true))}
            onFocus={() => setQOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) pick(results[0].id);
              if (e.key === "Escape") setQOpen(false);
            }}
            placeholder={m.search}
            aria-label={m.search}
            role="combobox"
            aria-expanded={qOpen && results.length > 0}
            aria-controls="family-search-list"
            className="h-11 w-full rounded-full border border-line bg-white/95 pe-4 ps-9 text-[0.95rem] shadow-[var(--shadow-paper)] outline-none focus:border-rose"
          />
          {qOpen && results.length > 0 && (
            <ul id="family-search-list" role="listbox" className="absolute inset-x-0 top-full z-10 mt-1 rounded-xl bg-white p-1 shadow-[0_12px_28px_-8px_rgba(60,40,30,0.3)] ring-1 ring-charcoal/10">
              {results.map((p) => (
                <li key={p.id} role="option" aria-selected={false}>
                  <button type="button" onClick={() => pick(p.id)} className="flex min-h-11 w-full flex-col items-start justify-center rounded-lg px-3 text-start hover:bg-blush/30">
                    <span>{fam.nameOf(p.id)}</span>
                    <span className="text-[0.78rem] text-ink-soft">{fam.relLabel(p.id)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {phone && (
          <button
            type="button"
            onClick={() => setFull((f) => !f)}
            aria-label={full ? m.closeFull : m.full}
            className="pointer-events-auto flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-[0.88rem] text-burgundy shadow-[var(--shadow-paper)] ring-1 ring-line"
          >
            {full ? <X className="h-4 w-4" aria-hidden /> : <Expand className="h-4 w-4" aria-hidden />}
            {full ? null : m.full}
          </button>
        )}
        {layout.rows.length > 1 && (!phone || full) && (
          <div role="group" aria-label={m.generations} className={cn("pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-full bg-white/95 p-1 shadow-[var(--shadow-paper)] ring-1 ring-line [scrollbar-width:none]", phone && "w-fit")}>
            {layout.rows.map((r) => (
              <button
                key={r.level}
                type="button"
                onClick={() => {
                  const row = layout.cards.filter((c) => c.level === r.level);
                  const cx = row.reduce((s, c) => s + c.x, 0) / row.length + CARD_W / 2;
                  flow.setCenter(cx, r.y + CARD_H / 2, { zoom: Math.max(flow.getZoom(), 0.75), duration: 650 });
                }}
                className="min-h-9 whitespace-nowrap rounded-full px-3 text-[0.85rem] text-charcoal hover:bg-blush/40"
              >
                {m.gen(r.level)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* zoom controls */}
      <div dir={dir} className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/95 p-1 shadow-[var(--shadow-paper)] ring-1 ring-line" style={full ? { bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" } : undefined}>
        <button type="button" onClick={() => flow.zoomOut({ duration: 300 })} aria-label={t.family.zoomOut} className={btn}>
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={() => flow.zoomIn({ duration: 300 })} aria-label={t.family.zoomIn} className={btn}>
          <Plus className="h-4 w-4" aria-hidden />
        </button>
        <span aria-hidden className="mx-1 h-5 w-px bg-line" />
        <button type="button" onClick={() => flow.fitView({ padding: 0.12, duration: 600 })} className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[0.88rem] text-burgundy hover:bg-blush/40">
          <Maximize2 className="h-4 w-4" aria-hidden />
          {m.fit}
        </button>
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setCollapsed(new Set());
            setTimeout(() => centerOn(ROSA, 0.9), 50);
          }}
          className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[0.88rem] text-burgundy hover:bg-blush/40"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          {m.reset}
        </button>
      </div>
      {!phone && (
        <p dir={dir} className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap text-[0.78rem] text-ink-soft/80">
          {m.hint}
        </p>
      )}
    </div>
  );
}

/** The whole family as one map: one row per generation, every card the same size. */
export default function FamilyMap(props: Props) {
  return (
    <ReactFlowProvider>
      <Board {...props} />
    </ReactFlowProvider>
  );
}
