"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, Pencil, Plus, UserPlus, X } from "lucide-react";
import { HUSBAND, ROSA } from "@/content/family";
import type { Photo } from "@/content/types";
import { pathToRosa, photosOf, photosTogether, radialLayout, ringPath, type TreePerson } from "@/lib/family";
import { useLang } from "@/lib/i18n";
import { ease } from "@/lib/motion";
import ArchivalImage from "../ArchivalImage";
import { useLightbox } from "../Lightbox";
import Portal from "../Portal";
import { getLenis } from "../Transition";
import { Container, PlaceholderTag, SectionIntro, buttonClass, cn } from "../ui";
import FamilyForm, { type FormPreset } from "./FamilyForm";
import PersonAvatar from "./PersonAvatar";
import ZoomPan from "./ZoomPan";
import { useFamily } from "./useFamily";

type Fam = ReturnType<typeof useFamily>;
type Actions = { onOpen: (id: string) => void; onAdd: (preset: FormPreset) => void };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** what "+" next to a person adds: their child, one generation further out */
function childPreset(fam: Fam, id: string): FormPreset | null {
  const d = fam.graph.depth(id) ?? fam.graph.ring(id);
  if (d === null || d >= 3) return null;
  if (d === 0) return { kind: "child" };
  const parentId = fam.graph.depth(id) === null ? fam.graph.partnerOf(id)?.id : id;
  return { kind: d === 1 ? "grandchild" : "great", parentId };
}

function PendingMark() {
  const { t } = useLang();
  return <span className="whitespace-nowrap rounded-full bg-blush/70 px-2 py-0.5 text-[0.62rem] leading-4 text-burgundy">{t.family.pending}</span>;
}

/* ---------------- desktop: rings around Rosa, one per generation that exists ---------------- */

function RadialTree({ fam, onOpen, onAdd, fixed = false }: { fam: Fam; fixed?: boolean } & Actions) {
  const { t, dir } = useLang();
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<string | null>(null);
  const { graph, nameOf } = fam;
  const { nodes, edges, rings, arc, bounds } = useMemo(() => radialLayout(graph, dir === "rtl"), [graph, dir]);
  const lit = useMemo(() => (hover ? pathToRosa(graph, hover) : null), [graph, hover]);
  // on phones the drawing has a fixed size and is scaled as a whole, so sizes are fixed too
  const size = fixed
    ? ["w-[5.2rem]", "w-[3.6rem]", "w-[3rem]", "w-[2.6rem]"]
    : ["w-[clamp(4.2rem,8vw,6rem)]", "w-[clamp(3rem,5.4vw,4.2rem)]", "w-[clamp(2.6rem,4.4vw,3.4rem)]", "w-[clamp(2.2rem,3.8vw,2.9rem)]"];
  const empty = graph.generations === 0;
  // with no children yet the drawing is just the centre and an invitation, so keep it compact
  const box = ["max-w-[34rem]", "max-w-[30rem]", "max-w-[50rem]", "max-w-[60rem]"][Math.min(graph.generations, 3)];
  // the drawing is cropped to the part of the circle the family fills
  const b = empty ? { x: 0, y: 0, w: 1, h: 1 } : bounds;
  const X = (x: number) => `${((x - b.x) / b.w) * 100}%`;
  const Y = (y: number) => `${((y - b.y) / b.h) * 100}%`;

  return (
    <div className={cn("relative mx-auto w-full transition-[max-width] duration-700", !fixed && box)} style={{ aspectRatio: `${b.w} / ${b.h}` }} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`${b.x * 100} ${b.y * 100} ${b.w * 100} ${b.h * 100}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        {empty && <circle cx="50" cy="50" r="38" fill="none" stroke="var(--color-dusty)" strokeOpacity="0.5" strokeWidth="0.25" strokeDasharray="1 1.4" />}
        {rings.slice(1).map((r, i) => (
          <motion.path
            key={`${r}-${rings.length}-${arc ? arc.from.toFixed(2) : "o"}`}
            d={ringPath(r, arc)}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth="0.18"
            strokeDasharray="0.6 1.2"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.6, delay: i * 0.2, ease }}
          />
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
              strokeDasharray={graph.byId.get(e.childId)?.pending ? "0.8 0.8" : undefined}
              strokeLinecap="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, ease }}
              style={{ transition: "stroke 0.4s, stroke-width 0.4s, stroke-opacity 0.4s" }}
            />
          );
        })}
      </svg>

      {[...nodes.values()].map((n) => {
        const p = graph.byId.get(n.id)!;
        const dim = lit && !lit.has(n.id) && !(graph.partnerOf(n.id) && lit.has(graph.partnerOf(n.id)!.id));
        const name = cap(nameOf(n.id));
        const add = childPreset(fam, n.id);
        const showAdd = add && n.id !== HUSBAND;
        return (
          <motion.div
            key={n.id}
            layout
            initial={reduce ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: dim ? 0.4 : 1, scale: 1 }}
            transition={{ duration: 0.7, ease }}
            className="group absolute flex -translate-x-1/2 -translate-y-[38%] flex-col items-center gap-1.5"
            style={{ left: X(n.x), top: Y(n.y) }}
            onMouseEnter={() => setHover(n.id)}
          >
            <span className="relative">
              <button
                type="button"
                onClick={() => onOpen(n.id)}
                onFocus={() => setHover(n.id)}
                onBlur={() => setHover(null)}
                aria-label={t.family.open(name)}
                className={cn("block rounded-full transition-transform duration-500 group-hover:scale-110", size[n.ring], p.pending && "outline outline-1 outline-offset-2 outline-dashed outline-rose")}
              >
                <PersonAvatar person={p} label={name} center={n.id === ROSA} className="w-full" />
              </button>
              {showAdd && (
                <button
                  type="button"
                  onClick={() => onAdd(add!)}
                  aria-label={t.family.addNear(name)}
                  className="absolute -bottom-1 -end-1 flex h-7 w-7 items-center justify-center rounded-full border border-white bg-rose text-white opacity-0 shadow-[var(--shadow-paper)] transition-opacity duration-300 hover:bg-burgundy focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
              )}
            </span>
            <span className={cn("max-w-[7.5rem] text-center leading-tight", n.ring === 0 ? "font-display text-[1.15rem] text-burgundy" : "text-[0.74rem]", p.placeholder ? "text-ink-soft" : "text-charcoal")}>{name}</span>
            {p.pending && <PendingMark />}
          </motion.div>
        );
      })}

      {empty && (
        <motion.button
          type="button"
          onClick={() => onAdd({ kind: "child" })}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease }}
          className="group absolute left-1/2 top-[12%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-rose bg-ivory text-rose transition-colors group-hover:bg-rose group-hover:text-white">
            <Plus className="h-6 w-6" aria-hidden />
          </span>
          <span className="whitespace-nowrap font-display text-[1.05rem] text-burgundy">{t.family.addFirst}</span>
        </motion.button>
      )}
    </div>
  );
}

/* ---------------- where she came from ---------------- */

function Roots({ fam, onOpen, onAdd }: { fam: Fam } & Actions) {
  const { t } = useLang();
  const { parents, siblings } = fam.graph.roots();
  const none = !parents.length && !siblings.length;
  const Chip = ({ p }: { p: TreePerson }) => (
    <button type="button" onClick={() => onOpen(p.id)} aria-label={t.family.open(cap(fam.nameOf(p.id)))} className="group flex items-center gap-2.5 rounded-full py-1 pe-4 ps-1 transition-colors hover:bg-white/70">
      <PersonAvatar person={p} label={fam.nameOf(p.id)} className={cn("w-10", p.pending && "outline outline-1 outline-offset-2 outline-dashed outline-rose")} />
      <span className="text-[0.88rem] text-charcoal/80">{cap(fam.nameOf(p.id))}</span>
    </button>
  );
  return (
    <div className="flex flex-col items-center gap-4">
      {!none && <span className="label">{t.family.roots}</span>}
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        {parents.map((p) => (
          <Chip key={p.id} p={p} />
        ))}
        {parents.length > 0 && siblings.length > 0 && <span aria-hidden className="mx-3 h-6 w-px bg-line" />}
        {siblings.map((p) => (
          <Chip key={p.id} p={p} />
        ))}
        <button
          type="button"
          onClick={() => onAdd({ kind: parents.length < 2 ? "parent" : "sibling" })}
          className={cn("inline-flex min-h-11 items-center gap-2 rounded-full border border-dashed border-dusty/60 px-4 text-[0.88rem] text-ink-soft transition-colors hover:border-rose hover:text-rose", !none && "ms-2")}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {none ? t.family.addRoots : t.family.roots}
        </button>
      </div>
      <span aria-hidden className="h-8 w-px bg-gradient-to-b from-line to-transparent" />
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

function PersonDrawer({ fam, id, onClose, onSwitch, onAdd }: { fam: Fam; id: string; onClose: () => void; onSwitch: (id: string) => void; onAdd: (p: FormPreset) => void }) {
  const { t, lang } = useLang();
  const closeRef = useRef<HTMLButtonElement>(null);
  const p = fam.graph.byId.get(id)!;
  const partner = fam.graph.partnerOf(id);
  const branch = fam.graph.branchRoot(id);
  const name = cap(fam.nameOf(id));
  const together = id === ROSA ? [] : photosTogether(fam.photos, id);
  const all = photosOf(fam.photos, id);
  const alt = lang === "ru" ? (p.nameAlt ? p.name : undefined) : p.nameAlt;
  const addChild = childPreset(fam, id);
  const canPartner = !partner && id !== ROSA && fam.graph.depth(id) !== null;

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

  const facts = [p.born && [t.family.born, p.born], p.birthplace && [t.family.from, p.birthplace], p.died && [t.family.died, p.died]].filter(Boolean) as [string, string][];

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
            {p.pending && <PendingMark />}
            {p.placeholder && !p.pending && <PlaceholderTag />}
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

          {(addChild || canPartner) && (
            <div className="flex flex-wrap gap-2">
              {addChild && (
                <button type="button" onClick={() => onAdd(addChild)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-dashed border-rose/60 px-4 text-[0.92rem] text-rose hover:bg-blush/40">
                  <Plus className="h-4 w-4" aria-hidden />
                  {t.family.addChild}
                </button>
              )}
              {canPartner && (
                <button type="button" onClick={() => onAdd({ kind: "partner", partnerOf: id })} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-dashed border-rose/60 px-4 text-[0.92rem] text-rose hover:bg-blush/40">
                  <Heart className="h-4 w-4" aria-hidden />
                  {t.family.addPartner}
                </button>
              )}
            </div>
          )}

          {together.length > 0 && <PhotoStrip list={together} title={t.family.together} />}
          {all.length > 0 && <PhotoStrip list={all} title={id === ROSA ? t.family.togetherRosa : t.family.allOf(name)} />}
          {all.length === 0 && <p className="text-[0.92rem] leading-relaxed text-ink-soft">{t.family.noPhotos}</p>}

          {id !== ROSA && (
            <button type="button" onClick={() => onAdd({ replaces: id })} className={cn(buttonClass.secondary, "w-full")}>
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
  const [form, setForm] = useState<FormPreset | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const onOpen = (id: string) => {
    opener.current = document.activeElement as HTMLElement;
    setPerson(id);
  };
  const close = () => {
    setPerson(null);
    setTimeout(() => opener.current?.focus(), 50);
  };
  const onAdd = (preset: FormPreset) => {
    setPerson(null);
    setForm(preset);
  };
  const legend = t.family.rings.slice(0, fam.graph.generations);

  return (
    <section id="family" aria-labelledby="family-title" className="overflow-hidden py-[var(--spacing-section)]">
      <Container wide>
        <SectionIntro id="family-title" eyebrow={t.family.eyebrow} title={t.family.title} lead={fam.graph.generations ? t.family.lead : t.family.addFirstLead} layout="center" />
        <div className="mt-14">
          <Roots fam={fam} onOpen={onOpen} onAdd={onAdd} />
        </div>
        <div className="hidden md:block">
          <RadialTree fam={fam} onOpen={onOpen} onAdd={onAdd} />
          {legend.length > 0 && (
            <ul className="mt-4 flex justify-center gap-8 text-[0.85rem] text-ink-soft" aria-hidden>
              {legend.map((label, i) => (
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
          )}
        </div>
        <div className="md:hidden">
          <ZoomPan width={[340, 340, 560, 780][Math.min(fam.graph.generations, 3)]}>
            <div className="px-6 pb-6">
              <RadialTree fam={fam} onOpen={onOpen} onAdd={onAdd} fixed />
            </div>
          </ZoomPan>
          {fam.graph.generations > 1 && <p className="mt-3 text-center text-[0.82rem] text-ink-soft">{t.family.zoomHint}</p>}
          {fam.graph.generations > 0 && (
            <button type="button" onClick={() => onAdd({ kind: "child" })} className="mx-auto mt-5 flex min-h-11 items-center gap-2 rounded-full border border-dashed border-dusty/60 px-5 text-[0.92rem] text-rose">
              <Plus className="h-4 w-4" aria-hidden />
              {t.family.addChild}
            </button>
          )}
        </div>
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <button type="button" onClick={() => onAdd({})} className={buttonClass.primary}>
            <UserPlus className="h-4 w-4" strokeWidth={1.6} aria-hidden />
            {t.family.join}
          </button>
          <p className="max-w-sm text-[0.88rem] text-ink-soft">{t.family.joinLead}</p>
        </div>
      </Container>

      <Portal>
        <AnimatePresence>{person && <PersonDrawer key="drawer" fam={fam} id={person} onClose={close} onSwitch={setPerson} onAdd={onAdd} />}</AnimatePresence>
        <AnimatePresence>{form && <FamilyForm key="form" fam={fam} preset={form} onClose={() => setForm(null)} />}</AnimatePresence>
      </Portal>
    </section>
  );
}
