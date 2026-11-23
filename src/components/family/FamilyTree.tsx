"use client";

import { useBackClose } from "@/lib/useBackClose";
import dynamic from "next/dynamic";
import { AnimatePresence, animate, motion, useDragControls, useMotionValue, type PanInfo } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, UserPlus, X } from "lucide-react";
import { ROSA } from "@/content/family";
import type { Photo } from "@/content/types";
import { chainToRosa, photosOf, photosTogether } from "@/lib/family";
import { useLang } from "@/lib/i18n";
import ArchivalImage from "../ArchivalImage";
import { useLightbox } from "../Lightbox";
import Portal from "../Portal";
import { getLenis } from "../Transition";
import { Container, PlaceholderTag, SectionIntro, buttonClass, cn } from "../ui";
import AddPersonForm, { type AddPreset } from "./AddPersonForm";
import PersonAvatar from "./PersonAvatar";
import { useFamily } from "./useFamily";

// the tree is drawn in the browser only (it measures the screen)
const FamilyMap = dynamic(() => import("./FamilyMap"), { ssr: false, loading: () => <div className="h-[72svh] min-h-[28rem] rounded-[18px] border border-line bg-[#fbf7f2] md:h-[min(78vh,52rem)] md:min-h-[32rem]" /> });

type Fam = ReturnType<typeof useFamily>;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function PendingMark() {
  const { t } = useLang();
  return <span className="whitespace-nowrap rounded-full bg-blush/70 px-2 py-0.5 text-[0.62rem] leading-4 text-burgundy">{t.family.pending}</span>;
}

function useWide() {
  const [wide, setWide] = useState<boolean | null>(null);
  useEffect(() => {
    const q = window.matchMedia("(min-width: 768px)");
    const on = () => setWide(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return wide;
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

function PersonDrawer({ fam, id, onClose, onSwitch, onAdd }: { fam: Fam; id: string; onClose: () => void; onSwitch: (id: string) => void; onAdd: (p: AddPreset) => void }) {
  const { t, lang, dir } = useLang();
  const closeRef = useRef<HTMLButtonElement>(null);
  const p = fam.graph.byId.get(id)!;
  const g = fam.graph;
  const real = (ids: string[]) => ids.filter((x) => !g.byId.get(x)?.virtual);
  const relatives: [string, string[]][] = [
    [t.family.map.parents, real(g.realParentsOf(id))],
    [t.family.map.partners, real(g.partnersOf(id))],
    [t.family.map.siblings, real(g.siblingsOf(id))],
    [t.family.map.children, real(g.childrenOf(id))],
  ];
  const branch = fam.graph.branchRoot(id);
  const name = cap(fam.nameOf(id));
  // how this person is connected to Rosa: רוזה ← דנה ← שירה
  const chain = chainToRosa(fam.graph, id);
  const together = id === ROSA ? [] : photosTogether(fam.photos, id);
  const all = photosOf(fam.photos, id);
  const alt = lang === "ru" ? (p.nameAlt ? p.name : undefined) : p.nameAlt;

  useBackClose(true, onClose);
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

  // on a phone the sheet can be pulled down by its handle to close, the way phone sheets work
  const drag = useDragControls();
  // the drawer only opens after a tap, so the window is there to ask
  const [phone, setPhone] = useState(() => window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  // where it comes from and goes back to: the bottom on a phone, the side (the end of the line) on a computer
  // (in pixels on a phone: after a pull the sheet is already some pixels down)
  const away = phone ? { x: 0, y: window.innerHeight } : { x: dir === "rtl" ? "-100%" : "100%", y: 0 };
  const sheetY = useMotionValue(0);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 600) onClose();
    else animate(sheetY, 0, { type: "spring", visualDuration: 0.35, bounce: 0 });
  };

  const facts = [p.born && [t.family.born, p.born], p.birthplace && [t.family.from, p.birthplace], p.died && p.died !== "?" && [t.family.died, p.died]].filter(Boolean) as [string, string][];

  return (
    <>
      <motion.div className="fixed inset-0 z-[84] bg-charcoal/25 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={name}
        data-lenis-prevent
        initial={{ ...away, opacity: 0.6 }}
        animate={{ x: 0, y: 0, opacity: 1 }}
        exit={{ ...away, opacity: 0, transition: { type: "spring", visualDuration: 0.32, bounce: 0 } }}
        transition={{ type: "spring", visualDuration: 0.45, bounce: 0 }}
        drag={phone ? "y" : false}
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={0}
        dragMomentum={false}
        onDragEnd={onDragEnd}
        className="fixed inset-x-0 bottom-0 top-[12svh] z-[85] flex w-full flex-col overflow-y-auto rounded-t-[22px] bg-ivory shadow-[var(--shadow-lift)] md:inset-x-auto md:end-0 md:top-0 md:max-w-[28rem] md:rounded-none"
        style={{ y: sheetY, paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div onPointerDown={(e) => phone && drag.start(e)} className="flex shrink-0 touch-none flex-col md:touch-auto">
        <span aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line md:hidden" />
        <div className="flex justify-end p-3">
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t.family.close} className="flex h-11 w-11 items-center justify-center rounded-full text-burgundy hover:bg-blush/50">
            <X className="h-5 w-5" strokeWidth={1.4} aria-hidden />
          </button>
        </div>
        </div>
        <div className="flex flex-col gap-8 px-7 pb-10">
          <header className="flex flex-col items-center gap-3 text-center">
            <PersonAvatar person={p} label={name} center={id === ROSA} className="w-28 text-2xl" />
            <h3 className="font-display text-[2rem] font-medium leading-tight text-burgundy">{name}</h3>
            {alt && <span className="-mt-2 text-ink-soft">{alt}</span>}
            <span className="text-[0.92rem] text-ink-soft">
              {!p.placeholder && id !== ROSA && cap(fam.relLabel(id))}
              {branch && branch.id !== id && ` · ${t.family.branch(cap(fam.nameOf(branch.id)))}`}
            </span>
            {p.pending && <PendingMark />}
            {p.placeholder && !p.pending && <PlaceholderTag />}
            {chain.length > 1 && (
              <nav aria-label={t.family.map.chain} className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-[0.88rem]">
                {chain.map((x, i) => (
                  <span key={x} className="flex items-center gap-1.5">
                    {i > 0 && <span aria-hidden className="text-rose">{lang === "he" ? "←" : "→"}</span>}
                    <button
                      type="button"
                      onClick={() => x !== id && onSwitch(x)}
                      aria-current={x === id ? "true" : undefined}
                      className={cn("min-h-9 rounded-full px-3", x === ROSA ? "bg-rose text-white" : x === id ? "bg-blush/70 text-burgundy" : "bg-mount text-charcoal hover:bg-blush/50")}
                    >
                      {cap(fam.nameOf(x))}
                    </button>
                  </span>
                ))}
              </nav>
            )}
          </header>

          {(facts.length > 0 || p.about) && (
            <dl className="flex flex-col gap-3 border-y border-line py-5 text-[0.95rem]">
              {facts.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4">
                  <dt className="text-ink-soft">{k}</dt>
                  <dd className="text-charcoal">{v}</dd>
                </div>
              ))}
              {p.about && <p className="pt-2 font-display text-[1.15rem] leading-relaxed text-charcoal/90">{p.about}</p>}
            </dl>
          )}

          {relatives.some(([, l]) => l.length) && (
            <div className="flex flex-col gap-4">
              {relatives
                .filter(([, l]) => l.length)
                .map(([title, list]) => (
                  <section key={title} className="flex flex-col gap-2">
                    <h4 className="label">{title}</h4>
                    <ul className="flex flex-wrap gap-2">
                      {list.map((x) => (
                        <li key={x}>
                          <button type="button" onClick={() => onSwitch(x)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white py-1 pe-4 ps-1 ring-1 ring-charcoal/10 hover:ring-burgundy/40">
                            <PersonAvatar person={g.byId.get(x)!} label={fam.nameOf(x)} className="w-9 text-[0.72rem]" />
                            <span className="flex flex-col text-start leading-tight">
                              <span className="text-[0.92rem]">{cap(fam.nameOf(x))}</span>
                              {x !== ROSA && !g.byId.get(x)?.placeholder && <span className="text-[0.72rem] text-ink-soft">{fam.relLabel(x)}</span>}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
            </div>
          )}

          {!p.placeholder && (
            <button type="button" onClick={() => onAdd({ of: id })} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-dashed border-rose/60 px-4 text-[0.92rem] text-rose hover:bg-blush/40">
              <Plus className="h-4 w-4" aria-hidden />
              {t.family.addNear(name)}
            </button>
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
  const wide = useWide();
  const [person, setPerson] = useState<string | null>(null);
  const [form, setForm] = useState<AddPreset | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const onOpen = (id: string) => {
    opener.current = document.activeElement as HTMLElement;
    setPerson(id);
  };
  const close = () => {
    setPerson(null);
    setTimeout(() => opener.current?.focus(), 50);
  };
  const onAdd = (preset: AddPreset) => {
    setPerson(null);
    setForm(preset);
  };

  return (
    <section id="family" aria-labelledby="family-title" className="py-[var(--spacing-section)]">
      <Container wide>
        <SectionIntro id="family-title" eyebrow={t.family.eyebrow} title={t.family.title} lead={t.family.map.lead} layout="center" />
        <div className="mt-8 md:mt-12">
          {/* until the page knows whether this is a phone, the tree's room is kept, so nothing below it jumps */}
          {wide === null && <div aria-hidden className="h-[72svh] min-h-[28rem] rounded-[18px] border border-line bg-[#fbf7f2] md:h-[min(78vh,52rem)] md:min-h-[32rem]" />}
          {wide !== null && <FamilyMap phone={!wide} fam={fam} onOpen={onOpen} onAdd={(id) => onAdd({ of: id })} />}
          {wide === false && <p className="mt-2.5 text-center text-[0.82rem] text-ink-soft">{t.family.map.hintTouch}</p>}
        </div>
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <button type="button" onClick={() => onAdd({})} className={buttonClass.primary}>
            <UserPlus className="h-4 w-4" strokeWidth={1.6} aria-hidden />
            {t.family.join}
          </button>
          <p className="max-w-sm text-[0.88rem] text-ink-soft">{t.family.joinLead}</p>
        </div>
      </Container>

      <Portal>
        <AnimatePresence>{person && <PersonDrawer key="drawer" fam={fam} id={person} onClose={close} onSwitch={setPerson} onAdd={onAdd} />}</AnimatePresence>
        <AnimatePresence>{form && <AddPersonForm key="form" fam={fam} preset={form} onClose={() => setForm(null)} />}</AnimatePresence>
      </Portal>
    </section>
  );
}
