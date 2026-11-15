"use client";

import "@xyflow/react/dist/style.css";
import { ReactFlow, ReactFlowProvider, useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus, RotateCcw, Search } from "lucide-react";
import { ROSA } from "@/content/family";
import { layoutFamily, type FamilyLayout } from "@/lib/familyLayout";
import { useLang } from "@/lib/i18n";
import { nameScore } from "@/lib/names";
import PersonCard, { CARD_H, CARD_W, type CardState } from "./PersonCard";
import type { useFamily } from "./useFamily";

type Fam = ReturnType<typeof useFamily>;
const LAYOUT = { cardW: CARD_W, cardH: CARD_H, gap: 26, coupleGap: 30, rowGap: 78 };

/** the people closest to someone: parents, partners, brothers and sisters, children */
export function immediateFamily(fam: Fam, id: string) {
  const g = fam.graph;
  return new Set([id, ...g.realParentsOf(id), ...g.partnersOf(id), ...g.siblingsOf(id), ...g.childrenOf(id)]);
}

type PersonData = { id: string; state: CardState; onOpen: (id: string) => void; onAdd: (id: string) => void; fold?: { folded: boolean; hidden: number; toggle: () => void }; fam: Fam };
type LinesData = { layout: FamilyLayout; lit: Set<string> | null; fam: Fam };

const PersonNode = memo(function PersonNode({ data }: NodeProps<Node<PersonData>>) {
  const { fam, id } = data;
  const p = fam.graph.byId.get(id)!;
  return (
    <div dir="auto">
      <PersonCard person={p} name={fam.nameOf(id)} relation={fam.relLabel(id)} state={data.state} onOpen={() => data.onOpen(id)} onAdd={p.placeholder ? undefined : () => data.onAdd(id)} fold={data.fold} />
    </div>
  );
});

/** all the lines in one drawing, underneath the cards */
const LinesNode = memo(function LinesNode({ data }: NodeProps<Node<LinesData>>) {
  const { layout, lit, fam } = data;
  const on = (people: string[]) => {
    if (!lit) return null;
    const real = people.filter((p) => !fam.graph.byId.get(p)?.virtual);
    return real.length > 0 && real.every((p) => lit.has(p));
  };
  return (
    <svg width={layout.width} height={layout.height} className="pointer-events-none overflow-visible" aria-hidden>
      {layout.connectors.map((c) => {
        const state = on(c.people);
        return (
          <path
            key={c.id}
            d={c.d}
            fill="none"
            stroke={state ? "var(--color-burgundy)" : c.kind === "couple" ? "var(--color-rose)" : "#b9a69c"}
            strokeWidth={state ? 2.4 : c.kind === "couple" ? 2 : 1.6}
            strokeOpacity={state === false ? 0.25 : 1}
            strokeLinejoin="round"
            style={{ transition: "stroke 0.3s, stroke-opacity 0.3s, stroke-width 0.3s" }}
          />
        );
      })}
      {layout.junctions.map((j) => (
        <circle key={j.id} cx={j.x} cy={j.y} r={5} fill="#fff" stroke="#b9a69c" strokeWidth={1.6} strokeDasharray="2 2" />
      ))}
    </svg>
  );
});

const nodeTypes = { person: PersonNode, lines: LinesNode };

function Board({ fam, onOpen, onAdd }: { fam: Fam; onOpen: (id: string) => void; onAdd: (id: string) => void }) {
  const { t, dir, lang } = useLang();
  const m = t.family.map;
  const flow = useReactFlow();
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [qOpen, setQOpen] = useState(false);
  const ready = useRef(false);

  const layout = useMemo(() => layoutFamily(fam.graph, { ...LAYOUT, rtl: dir === "rtl", collapsed }), [fam.graph, dir, collapsed]);
  const at = useMemo(() => new Map(layout.cards.map((c) => [c.id, c])), [layout]);
  const lit = useMemo(() => (selected && at.has(selected) ? immediateFamily(fam, selected) : null), [fam, selected, at]);

  const toggle = useCallback((id: string) => setCollapsed((cur) => {
    const next = new Set(cur);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }), []);

  const open = useCallback((id: string) => {
    setSelected(id);
    onOpen(id);
  }, [onOpen]);

  const nodes = useMemo<Node[]>(() => {
    const list: Node[] = [{ id: "__lines", type: "lines", position: { x: 0, y: 0 }, data: { layout, lit, fam }, draggable: false, selectable: false, focusable: false, zIndex: 0, width: layout.width, height: layout.height, style: { pointerEvents: "none" } }];
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
          state: !lit ? "normal" : c.id === selected ? "selected" : lit.has(c.id) ? "lit" : "dim",
          onOpen: open,
          onAdd,
          fold: hasKids && c.id !== ROSA ? { folded: collapsed.has(c.id), hidden: c.hidden, toggle: () => toggle(c.id) } : undefined,
        } satisfies PersonData,
      });
    }
    return list;
  }, [layout, lit, fam, selected, open, onAdd, collapsed, toggle]);

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
    if (ready.current || !layout.cards.length) return;
    const box = document.querySelector<HTMLElement>(".family-map")?.getBoundingClientRect();
    if (!box) return;
    ready.current = true;
    const fit = Math.min(1, (box.width * 0.9) / layout.width, (box.height * 0.85) / layout.height);
    const rosa = at.get(ROSA);
    if (fit >= 0.55 || !rosa) flow.fitView({ padding: 0.1, maxZoom: 1 });
    else {
      const z = 0.75;
      flow.setCenter(rosa.x + CARD_W / 2, rosa.y + CARD_H / 2 + (box.height / 2 - 150) / z, { zoom: z });
    }
  }, [layout, flow, at]);
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
    <div className="family-map relative h-[min(78vh,52rem)] min-h-[32rem] overflow-hidden rounded-[18px] border border-line bg-[#fbf7f2]" dir="ltr">
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
      />

      {/* toolbar */}
      <div dir={dir} className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
        <div className="pointer-events-auto relative w-[min(100%,18rem)]" lang={lang}>
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

        {layout.rows.length > 1 && (
          <div role="group" aria-label={m.generations} className="pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-full bg-white/95 p-1 shadow-[var(--shadow-paper)] ring-1 ring-line">
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
      <div dir={dir} className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/95 p-1 shadow-[var(--shadow-paper)] ring-1 ring-line">
        <button type="button" onClick={() => flow.zoomOut({ duration: 300 })} aria-label={t.family.zoomOut} className={btn}>
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={() => flow.zoomIn({ duration: 300 })} aria-label={t.family.zoomIn} className={btn}>
          <Plus className="h-4 w-4" aria-hidden />
        </button>
        <span aria-hidden className="mx-1 h-5 w-px bg-line" />
        <button type="button" onClick={() => flow.fitView({ padding: 0.12, duration: 600 })} className="flex h-10 items-center gap-1.5 rounded-full px-3 text-[0.88rem] text-burgundy hover:bg-blush/40">
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
          className="flex h-10 items-center gap-1.5 rounded-full px-3 text-[0.88rem] text-burgundy hover:bg-blush/40"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          {m.reset}
        </button>
      </div>
      <p dir={dir} className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap text-[0.78rem] text-ink-soft/80">
        {m.hint}
      </p>
    </div>
  );
}

/** The whole family as one map: one row per generation, every card the same size. */
export default function FamilyMap(props: { fam: Fam; onOpen: (id: string) => void; onAdd: (id: string) => void }) {
  return (
    <ReactFlowProvider>
      <Board {...props} />
    </ReactFlowProvider>
  );
}
