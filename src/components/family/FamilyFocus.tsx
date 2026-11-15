"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { ArrowRight, Images, Plus } from "lucide-react";
import { ROSA } from "@/content/family";
import { pathToRosa } from "@/lib/family";
import { useLang } from "@/lib/i18n";
import { ease } from "@/lib/motion";
import { cn } from "../ui";
import PersonCard from "./PersonCard";
import type { useFamily } from "./useFamily";

type Fam = ReturnType<typeof useFamily>;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The family on a phone: one person at a time, at the same readable size as everyone else.
 * Parents above, partners beside, children below (grouped by the other parent); tapping anyone
 * moves to them, and the trail at the top leads back.
 */
export default function FamilyFocus({ fam, onOpen, onAdd }: { fam: Fam; onOpen: (id: string) => void; onAdd: (id: string) => void }) {
  const { t } = useLang();
  const m = t.family.map;
  const g = fam.graph;
  const [focus, setFocus] = useState(ROSA);
  const [history, setHistory] = useState<string[]>([]);
  const p = g.byId.get(focus) ?? g.rosa;

  const go = (id: string) => {
    if (id === focus) return onOpen(id);
    setHistory((h) => [...h, focus]);
    setFocus(id);
    window.scrollTo({ top: (document.getElementById("family-focus")?.getBoundingClientRect().top ?? 0) + window.scrollY - 90, behavior: "smooth" });
  };
  const back = () => {
    const prev = history.at(-1);
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setFocus(prev);
  };

  // the trail from Rosa down to this person
  const levels = g.levels();
  const trail = [...pathToRosa(g, focus)].filter((id) => g.byId.has(id) && !g.byId.get(id)!.virtual).sort((a, b) => (levels.get(a) ?? 0) - (levels.get(b) ?? 0));

  const parents = g.realParentsOf(focus);
  const partners = g.partnersOf(focus).filter((x) => !g.byId.get(x)?.virtual);
  const siblings = g.siblingsOf(focus).filter((x) => !g.byId.get(x)?.virtual);
  const kids = g.childrenOf(focus);
  // children grouped by the other parent, so half-siblings are clear
  const groups = new Map<string, string[]>();
  for (const k of kids) {
    const other = g.parentsOf(k).find((x) => x !== focus && partners.includes(x)) ?? (partners.length === 1 && g.parentsOf(k).length === 1 ? partners[0] : "");
    groups.set(other, [...(groups.get(other) ?? []), k]);
  }

  const card = (id: string, state: "selected" | "normal" = "normal") => {
    const person = g.byId.get(id)!;
    return <PersonCard key={id} fluid person={person} name={fam.nameOf(id)} relation={fam.relLabel(id)} state={state} onOpen={() => (state === "selected" ? onOpen(id) : go(id))} />;
  };
  const section = (title: string, children: ReactNode, extra?: ReactNode) => (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h4 className="label">{title}</h4>
        {extra}
      </div>
      {children}
    </section>
  );
  const grid = "grid grid-cols-2 gap-3";

  return (
    <div id="family-focus" className="flex flex-col gap-6 rounded-[18px] border border-line bg-[#fbf7f2] p-4">
      <nav aria-label={m.back} className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.9rem]">
        {history.length > 0 && (
          <button type="button" onClick={back} className="me-2 inline-flex min-h-10 items-center gap-1 rounded-full bg-white px-3 text-burgundy ring-1 ring-line">
            <ArrowRight className="h-4 w-4 ltr:rotate-180" aria-hidden />
            {m.back}
          </button>
        )}
        {trail.map((id, i) => (
          <span key={id} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className="text-dusty">›</span>}
            <button type="button" onClick={() => go(id)} aria-current={id === focus ? "page" : undefined} className={cn("min-h-10 px-1", id === focus ? "font-medium text-burgundy" : "text-ink-soft underline decoration-dusty/40 underline-offset-4")}>
              {cap(fam.nameOf(id))}
            </button>
          </span>
        ))}
      </nav>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={focus} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease }} className="flex flex-col gap-6">
          {section(m.parents, parents.length ? <div className={grid}>{parents.map((x) => card(x))}</div> : <p className="text-[0.9rem] text-ink-soft">{m.nobody}</p>)}

          <div className="flex flex-col items-center gap-3 rounded-[16px] bg-white/70 p-3 ring-1 ring-blush">
            <div className={grid}>
              {card(focus, "selected")}
              {partners.map((x) => card(x))}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => onOpen(focus)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-burgundy px-4 text-[0.92rem] text-white">
                <Images className="h-4 w-4" aria-hidden />
                {m.details}
              </button>
              {!p.placeholder && (
                <button type="button" onClick={() => onAdd(focus)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-dashed border-rose/60 px-4 text-[0.92rem] text-rose">
                  <Plus className="h-4 w-4" aria-hidden />
                  {m.add}
                </button>
              )}
            </div>
          </div>

          {siblings.length > 0 &&
            section(
              m.siblings,
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">{siblings.map((x) => <div key={x} className="w-[46%] shrink-0">{card(x)}</div>)}</div>
            )}

          {section(
            m.children,
            kids.length ? (
              <div className="flex flex-col gap-4">
                {[...groups.entries()].map(([other, list]) => (
                  <div key={other || "none"} className="flex flex-col gap-2">
                    {groups.size > 1 && <span className="text-[0.82rem] text-ink-soft">{other ? `${cap(fam.nameOf(focus))} + ${cap(fam.nameOf(other))}` : cap(fam.nameOf(focus))}</span>}
                    <div className={grid}>{list.map((x) => card(x))}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[0.9rem] text-ink-soft">{m.nobody}</p>
            )
          )}
        </motion.div>
      </AnimatePresence>
      <p className="text-center text-[0.8rem] text-ink-soft">{m.focusHint}</p>
    </div>
  );
}
