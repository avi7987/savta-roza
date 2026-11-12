"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Pencil, UserPlus, X } from "lucide-react";
import { ROSA } from "@/content/family";
import type { Person, Photo } from "@/content/types";
import { RINGS, pathToRosa, photosOf, photosTogether, radialLayout, type FamilyGraph } from "@/lib/family";
import { useLang } from "@/lib/i18n";
import { ease } from "@/lib/motion";
import ArchivalImage from "../ArchivalImage";
import { useLightbox } from "../Lightbox";
import { getLenis } from "../Transition";
import { Container, PlaceholderTag, SectionIntro, buttonClass, cn } from "../ui";
import FamilyForm from "./FamilyForm";
import PersonAvatar from "./PersonAvatar";
import Portal from "../Portal";
import { useFamily } from "./useFamily";

type Fam = ReturnType<typeof useFamily>;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------------- desktop: rings around Rosa ---------------- */

function RadialTree({ fam, onOpen }: { fam: Fam; onOpen: (id: string) => void }) {
  const { t, dir } = useLang();
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<string | null>(null);
  const { graph, nameOf } = fam;
  const { nodes, edges } = useMemo(() => radialLayout(graph, dir === "rtl"), [graph, dir]);
  const lit = useMemo(() => (hover ? pathToRosa(graph, hover) : null), [graph, hover]);
  const size = ["w-[clamp(4.2rem,8vw,6rem)]", "w-[clamp(3rem,5.4vw,4.2rem)]", "w-[clamp(2.6rem,4.4vw,3.4rem)]", "w-[clamp(2.2rem,3.8vw,2.9rem)]"];

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[60rem]" onMouseLeave={() => setHover(null)}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        {RINGS.slice(1).map((r, i) => (
          <g key={r}>
            <motion.circle
              cx="50"
              cy="50"
              r={r * 50}
              fill="none"
              stroke="var(--color-line)"
              strokeWidth="0.18"
              strokeDasharray="0.6 1.2"
              initial={reduce ? false : { pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 2, delay: i * 0.3, ease }}
            />
          </g>
        ))}
        {edges.map((e) => {
          const on = lit ? lit.has(e.childId) && lit.has(e.parentId) : false;
          return (
            <motion.path
              key={`${e.parentId}-${e.childId}`}
              d={`M ${e.from.x * 100} ${e.from.y * 100} C ${e.c1.x * 100} ${e.c1.y * 100} ${e.c2.x * 100} ${e.c2.y * 100} ${e.to.x * 100} ${e.to.y * 100}`}
              fill="none"
              stroke={on ? "var(--color-burgundy)" : "var(--color-sage-deep)"}
              strokeWidth={on ? 0.42 : 0.2}
              strokeOpacity={lit && !on ? 0.18 : on ? 1 : 0.55}
              strokeLinecap="round"
              initial={reduce ? false : { pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.6, delay: 0.4, ease }}
              style={{ transition: "stroke 0.4s, stroke-width 0.4s, stroke-opacity 0.4s" }}
            />
          );
        })}
      </svg>

      {[...nodes.values()].map((n) => {
        const p = graph.byId.get(n.id)!;
        const dim = lit && !lit.has(n.id) && graph.partnerOf(n.id) && !lit.has(graph.partnerOf(n.id)!.id);
        const name = nameOf(n.id);
        return (
          <motion.button
            key={n.id}
            type="button"
            onClick={() => onOpen(n.id)}
            onMouseEnter={() => setHover(n.id)}
            onFocus={() => setHover(n.id)}
            onBlur={() => setHover(null)}
            aria-label={t.family.open(cap(name))}
            initial={reduce ? false : { opacity: 0, scale: 0.6 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.3 + n.ring * 0.25, ease }}
            className={cn("group absolute flex -translate-x-1/2 -translate-y-[38%] flex-col items-center gap-1.5 transition-opacity duration-300", dim ? "opacity-40" : "opacity-100")}
            style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%` }}
          >
            <span className={cn("block transition-transform duration-500 group-hover:scale-110", size[n.ring])}>
              <PersonAvatar person={p} label={name} center={n.id === ROSA} className="w-full" />
            </span>
            <span
              className={cn(
                "max-w-[7.5rem] text-center leading-tight",
                n.ring === 0 ? "font-display text-[1.15rem] text-burgundy" : "text-[0.74rem]",
                p.placeholder ? "text-ink-soft" : "text-charcoal"
              )}
            >
              {cap(name)}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ---------------- where she came from ---------------- */

function Roots({ fam, onOpen }: { fam: Fam; onOpen: (id: string) => void }) {
  const { t } = useLang();
  const { parents, siblings } = fam.graph.roots();
  if (!parents.length && !siblings.length) return null;
  const Chip = ({ p }: { p: Person }) => (
    <button type="button" onClick={() => onOpen(p.id)} aria-label={t.family.open(cap(fam.nameOf(p.id)))} className="group flex items-center gap-2.5 rounded-full py-1 pe-4 ps-1 transition-colors hover:bg-white/70">
      <PersonAvatar person={p} label={fam.nameOf(p.id)} className="w-10" />
      <span className="text-[0.88rem] text-charcoal/80">{cap(fam.nameOf(p.id))}</span>
    </button>
  );
  return (
    <div className="flex flex-col items-center gap-4">
      <span className="label">{t.family.roots}</span>
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        {parents.map((p) => (
          <Chip key={p.id} p={p} />
        ))}
        {siblings.length > 0 && <span aria-hidden className="mx-3 h-6 w-px bg-line" />}
        {siblings.map((p) => (
          <Chip key={p.id} p={p} />
        ))}
      </div>
      <span aria-hidden className="h-10 w-px bg-gradient-to-b from-line to-transparent" />
    </div>
  );
}

/* ---------------- phones: branches you can open ---------------- */

function Row({ fam, id, onOpen, depth }: { fam: Fam; id: string; onOpen: (id: string) => void; depth: number }) {
  const { t } = useLang();
  const p = fam.graph.byId.get(id)!;
  const partner = fam.graph.partnerOf(id);
  const showPartner = partner && fam.graph.depth(partner.id) === null;
  const Who = ({ who }: { who: Person }) => (
    <button type="button" onClick={() => onOpen(who.id)} aria-label={t.family.open(cap(fam.nameOf(who.id)))} className="flex min-h-12 items-center gap-3 text-start">
      <PersonAvatar person={who} label={fam.nameOf(who.id)} className={depth === 1 ? "w-11" : "w-9"} />
      <span className="flex flex-col leading-tight">
        <span className={cn(depth === 1 ? "font-display text-lg" : "text-[0.95rem]", who.placeholder ? "text-ink-soft" : "text-charcoal")}>{cap(fam.nameOf(who.id))}</span>
        {!who.placeholder && <span className="text-[0.75rem] text-ink-soft">{fam.relLabel(who.id)}</span>}
      </span>
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <Who who={p} />
      {showPartner && (
        <>
          <span aria-hidden className="text-dusty">&amp;</span>
          <Who who={partner} />
        </>
      )}
    </div>
  );
}

function Descendants({ fam, id, onOpen, depth }: { fam: Fam; id: string; onOpen: (id: string) => void; depth: number }) {
  const kids = fam.graph.kids(id);
  if (!kids.length) return null;
  return (
    <ul className="mt-2 flex flex-col gap-2 border-s border-line ps-5">
      {kids.map((k) => (
        <li key={k.id}>
          <Row fam={fam} id={k.id} onOpen={onOpen} depth={depth} />
          <Descendants fam={fam} id={k.id} onOpen={onOpen} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );
}

function BranchList({ fam, onOpen }: { fam: Fam; onOpen: (id: string) => void }) {
  const { t } = useLang();
  const [open, setOpen] = useState<string | null>(fam.graph.kids(ROSA)[0]?.id ?? null);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-center gap-6 rounded-[var(--radius-card)] bg-white/70 p-5 shadow-[var(--shadow-paper)]">
        {[ROSA, fam.graph.rosa.partnerId].filter(Boolean).map((id) => (
          <button key={id} type="button" onClick={() => onOpen(id!)} className="flex flex-col items-center gap-2" aria-label={t.family.open(cap(fam.nameOf(id!)))}>
            <PersonAvatar person={fam.graph.byId.get(id!)!} label={fam.nameOf(id!)} center={id === ROSA} className="w-16" />
            <span className={cn("text-center leading-tight", id === ROSA ? "font-display text-xl text-burgundy" : "text-[0.9rem] text-ink-soft")}>{cap(fam.nameOf(id!))}</span>
          </button>
        ))}
      </div>
      <h3 className="label">{t.family.branches}</h3>
      <ul className="flex flex-col">
        {fam.graph.kids(ROSA).map((k) => {
          const isOpen = open === k.id;
          return (
            <li key={k.id} className="border-b border-line py-3">
              <div className="flex items-center justify-between gap-3">
                <Row fam={fam} id={k.id} onOpen={onOpen} depth={1} />
                <button type="button" onClick={() => setOpen(isOpen ? null : k.id)} aria-expanded={isOpen} aria-label={t.family.branch(cap(fam.nameOf(k.id)))} className="flex h-11 w-11 shrink-0 items-center justify-center text-burgundy">
                  <ChevronDown className={cn("h-5 w-5 transition-transform duration-300", isOpen && "rotate-180")} strokeWidth={1.4} aria-hidden />
                </button>
              </div>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.45, ease }} className="overflow-hidden">
                    <Descendants fam={fam} id={k.id} onOpen={onOpen} depth={2} />
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------- person card ---------------- */

function PhotoStrip({ list, title }: { list: Photo[]; title: string }) {
  const { l } = useLang();
  const { open } = useLightbox();
  return (
    <section className="flex flex-col gap-3">
      <h4 className="label">
        {title} <span className="tabular-nums text-dusty">· {list.length}</span>
      </h4>
      <ul className="grid grid-cols-3 gap-2.5">
        {list.map((ph, i) => (
          <li key={ph.id}>
            <button type="button" onClick={() => open(list, i)} aria-label={l(ph.alt)} className="block w-full cursor-zoom-in overflow-hidden bg-white p-1 shadow-[var(--shadow-paper)] transition-transform duration-500 hover:-translate-y-0.5">
              <div className="aspect-square overflow-hidden">
                <ArchivalImage photo={{ ...ph, ratio: 1 }} reveal={false} labelled={false} className="[&>div]:shadow-none" />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PersonDrawer({ fam, id, onClose, onSwitch, onEdit }: { fam: Fam; id: string; onClose: () => void; onSwitch: (id: string) => void; onEdit: (id: string) => void }) {
  const { t, lang } = useLang();
  const closeRef = useRef<HTMLButtonElement>(null);
  const p = fam.graph.byId.get(id)!;
  const partner = fam.graph.partnerOf(id);
  const branch = fam.graph.branchRoot(id);
  const name = cap(fam.nameOf(id));
  const together = id === ROSA ? [] : photosTogether(fam.photos, id);
  const all = photosOf(fam.photos, id);
  const alt = lang === "ru" ? (p.nameAlt ? p.name : undefined) : p.nameAlt;

  useEffect(() => {
    getLenis()?.stop();
    closeRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("keydown", esc);
      getLenis()?.start();
    };
  }, [onClose]);

  const facts = [
    p.born && [t.family.born, p.born],
    p.birthplace && [t.family.from, p.birthplace],
    p.died && [t.family.died, p.died],
  ].filter(Boolean) as [string, string][];

  return (
    <>
      <motion.div className="fixed inset-0 z-[84] bg-charcoal/25 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={name}
        data-lenis-prevent
        initial={{ x: "var(--from)", opacity: 0.6 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "var(--from)", opacity: 0 }}
        transition={{ duration: 0.55, ease }}
        className="fixed inset-y-0 end-0 z-[85] flex w-full max-w-[30rem] flex-col overflow-y-auto bg-ivory shadow-[var(--shadow-lift)] [--from:100%] rtl:[--from:-100%]"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex justify-end p-3">
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t.family.close} className="flex h-11 w-11 items-center justify-center rounded-full text-burgundy hover:bg-blush/50">
            <X className="h-5 w-5" strokeWidth={1.4} aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-8 px-7 pb-10">
          <header className="flex flex-col items-center gap-3 text-center">
            <PersonAvatar person={p} label={name} center={id === ROSA} className="w-28 text-2xl" />
            <h3 className="font-display text-[2rem] font-light leading-tight text-burgundy">{name}</h3>
            {alt && <span className="-mt-2 text-ink-soft">{alt}</span>}
            <span className="text-[0.92rem] text-ink-soft">
              {!p.placeholder && id !== ROSA && cap(fam.relLabel(id))}
              {branch && branch.id !== id && ` · ${t.family.branch(cap(fam.nameOf(branch.id)))}`}
            </span>
            {p.placeholder && <PlaceholderTag />}
          </header>

          {(partner || facts.length > 0 || p.about) && (
            <dl className="flex flex-col gap-3 border-y border-line py-5 text-[0.95rem]">
              {partner && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-ink-soft">{t.family.partner}</dt>
                  <dd>
                    <button type="button" onClick={() => onSwitch(partner.id)} className="text-burgundy underline decoration-dusty/50 underline-offset-4">
                      {cap(fam.nameOf(partner.id))}
                    </button>
                  </dd>
                </div>
              )}
              {facts.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4">
                  <dt className="text-ink-soft">{k}</dt>
                  <dd className="text-charcoal">{v}</dd>
                </div>
              ))}
              {p.about && <p className="pt-2 font-display text-[1.15rem] leading-relaxed text-charcoal/90">{p.about}</p>}
            </dl>
          )}

          {together.length > 0 && <PhotoStrip list={together} title={t.family.together} />}
          {all.length > 0 && <PhotoStrip list={all} title={id === ROSA ? t.family.togetherRosa : t.family.allOf(name)} />}
          {all.length === 0 && <p className="text-[0.92rem] leading-relaxed text-ink-soft">{t.family.noPhotos}</p>}

          {id !== ROSA && (
            <button type="button" onClick={() => onEdit(id)} className={cn(buttonClass.secondary, "w-full")}>
              <Pencil className="h-4 w-4" strokeWidth={1.4} aria-hidden />
              {t.family.edit}
            </button>
          )}
        </div>
      </motion.aside>
    </>
  );
}

/* ---------------- section ---------------- */

export default function FamilyTree() {
  const { t } = useLang();
  const fam = useFamily();
  const [person, setPerson] = useState<string | null>(null);
  const [form, setForm] = useState<{ replaces?: string } | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const open = (id: string) => {
    opener.current = document.activeElement as HTMLElement;
    setPerson(id);
  };
  const close = () => {
    setPerson(null);
    setTimeout(() => opener.current?.focus(), 50);
  };

  return (
    <section id="family" aria-labelledby="family-title" className="overflow-hidden py-[var(--spacing-section)]">
      <Container wide>
        <SectionIntro id="family-title" eyebrow={t.family.eyebrow} title={t.family.title} lead={t.family.lead} layout="center" />
        <div className="mt-14">
          <Roots fam={fam} onOpen={open} />
        </div>
        <div className="hidden md:block">
          <RadialTree fam={fam} onOpen={open} />
          <ul className="mt-4 flex justify-center gap-8 text-[0.85rem] text-ink-soft" aria-hidden>
            {t.family.rings.map((label, i) => (
              <li key={label} className="flex items-center gap-2">
                <svg viewBox="0 0 20 20" className="h-4 w-4">
                  {[0, 1, 2].map((k) => (
                    <circle key={k} cx="10" cy="10" r={3 + k * 3.2} fill="none" stroke={k === i ? "var(--color-burgundy)" : "var(--color-line)"} strokeWidth="1.2" />
                  ))}
                </svg>
                {label}
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto max-w-lg md:hidden">
          <BranchList fam={fam} onOpen={open} />
        </div>
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <button type="button" onClick={() => setForm({})} className={buttonClass.primary}>
            <UserPlus className="h-4 w-4" strokeWidth={1.6} aria-hidden />
            {t.family.join}
          </button>
          <p className="max-w-sm text-[0.88rem] text-ink-soft">{t.family.joinLead}</p>
        </div>
      </Container>

      <Portal>
      <AnimatePresence>
        {person && (
          <PersonDrawer
            key="drawer"
            fam={fam}
            id={person}
            onClose={close}
            onSwitch={setPerson}
            onEdit={(id) => {
              setPerson(null);
              setForm({ replaces: id });
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{form && <FamilyForm key="form" graph={fam.graph} nameOf={fam.nameOf} replaces={form.replaces} onClose={() => setForm(null)} />}</AnimatePresence>
      </Portal>
    </section>
  );
}

export type { FamilyGraph };
