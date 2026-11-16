"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Heart, Search, Users, Baby, UserRound, X } from "lucide-react";
import type { Gender } from "@/content/types";
import type { FamilyRequest, LinkRel } from "@/lib/family";
import { useLang } from "@/lib/i18n";
import { LIMITS } from "@/lib/limits";
import { ease } from "@/lib/motion";
import { nameScore } from "@/lib/names";
import { RoseBud } from "../Botanical";
import { STATIC, getLenis } from "../Transition";
import { buttonClass, cn } from "../ui";
import PersonCard from "./PersonCard";
import PersonAvatar from "./PersonAvatar";
import type { useFamily } from "./useFamily";

type Fam = ReturnType<typeof useFamily>;
/** `of`: start next to this person; `replaces`: fill in or correct this person's details */
export type AddPreset = { of?: string; replaces?: string };

const input =
  "w-full rounded-[var(--radius-card)] border border-charcoal/15 bg-white px-4 py-3 text-[1rem] text-charcoal outline-none transition-[border-color,box-shadow] placeholder:text-charcoal/35 focus:border-rose focus:shadow-[0_0_0_3px_rgba(184,92,120,0.15)] aria-[invalid=true]:border-burgundy";
const chip = (on: boolean) => cn("inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[0.95rem] transition-colors", on ? "border-burgundy bg-burgundy text-white" : "border-charcoal/15 bg-white text-charcoal hover:border-burgundy/40");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const RELS: { id: LinkRel; Icon: typeof Baby }[] = [
  { id: "child", Icon: Baby },
  { id: "partner", Icon: Heart },
  { id: "parent", Icon: UserRound },
  { id: "sibling", Icon: Users },
];

/**
 * Adding someone to the tree in five short steps: next to whom, how they are related, a few
 * details, an optional photo, and a last look. The new person shows in the tree straight away
 * as "waiting for approval", and fully once the site's owner approves.
 */
export default function AddPersonForm({ fam, preset, onClose }: { fam: Fam; preset: AddPreset; onClose: () => void }) {
  const { t, lang } = useLang();
  const f = t.family.form;
  const w = t.family.form2;
  const uid = useId();
  const g = fam.graph;
  const closeRef = useRef<HTMLButtonElement>(null);
  const editing = preset.replaces;
  const existing = editing ? g.byId.get(editing) : undefined;

  const steps = editing ? [w.steps[2], w.steps[3], w.steps[4]] : w.steps;
  const [step, setStep] = useState(editing ? 2 : preset.of ? 1 : 0);
  const [of, setOf] = useState(preset.of ?? "");
  const [q, setQ] = useState("");
  const [rel, setRel] = useState<LinkRel | "">("");
  const [other, setOther] = useState<string>("");
  const [v, setV] = useState({ name: existing?.placeholder ? "" : (existing?.name ?? ""), nameAlt: existing?.nameAlt ?? "", gender: (existing?.gender ?? "x") as Gender, born: existing?.born ?? "", died: existing?.died === "?" ? "" : (existing?.died ?? ""), birthplace: existing?.birthplace ?? "", about: existing?.about ?? "" });
  // whether the person is no longer alive: a small box, and only then a place for the year
  const [gone, setGone] = useState(!!existing?.died);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "done" | "error" | "full">("idle");

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
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const people = g.people.filter((p) => !p.virtual);
  const matches = useMemo(
    () =>
      q.trim()
        ? people
            .map((p) => ({ p, s: nameScore(q, [p.name, p.nameAlt ?? "", fam.nameOf(p.id)]) }))
            .filter((r) => r.s >= 0.6)
            .sort((a, b) => b.s - a.s)
            .slice(0, 8)
            .map((r) => r.p)
        : people.filter((p) => !p.placeholder).slice(0, 8),
    [q, people, fam]
  );
  const ofName = of ? cap(fam.nameOf(of)) : "";
  const partners = of ? g.partnersOf(of).filter((x) => !g.byId.get(x)?.virtual) : [];
  const parentFull = of ? g.realParentsOf(of).length >= 2 : false;

  const relLabel = (r: LinkRel) => w.rels[r];
  const name = v.name.trim() || w.newPerson;

  const validate = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 0 && !of) e.of = f.errors.to;
    if (s === 1 && !rel) e.rel = f.errors.kind;
    if (s === 2 && !v.name.trim()) e.name = f.errors.name;
    if (s === 4 && !consent) e.consent = f.errors.consent;
    setErrors(e);
    return !Object.keys(e).length;
  };
  const next = () => validate(step) && setStep(step + 1);

  const submit = async () => {
    if (!validate(4)) return;
    const req: FamilyRequest = {
      replaces: editing,
      rel: editing ? undefined : (rel as LinkRel),
      of: editing ? undefined : of,
      with: !editing && rel === "child" && other ? other : undefined,
      name: v.name.trim(),
      nameAlt: v.nameAlt.trim() || undefined,
      gender: v.gender,
      born: v.born.trim() || undefined,
      // "?" keeps someone marked as no longer with us when the year is not known
      died: gone ? v.died.trim() || "?" : undefined,
      birthplace: v.birthplace.trim() || undefined,
      about: v.about.trim() || undefined,
    };
    setState("sending");
    if (STATIC) {
      fam.addLocal(`local-${Date.now()}`, req);
      setState("done");
      return;
    }
    const body = new FormData();
    Object.entries(req).forEach(([k, val]) => val !== undefined && body.set(k, String(val)));
    body.set("consent", "yes");
    if (photo) body.set("photo", photo);
    try {
      const res = await fetch("/api/family", { method: "POST", body });
      if (res.status === 507) return setState("full");
      if (!res.ok) throw new Error(String(res.status));
      const { id } = await res.json();
      fam.addLocal(id, { ...req, photoSrc: preview || undefined });
      setState("done");
    } catch {
      setState("error");
    }
  };

  // the step shown, counted from the steps this form has
  const shown = editing ? step - 2 : step;
  const Prev = lang === "he" ? ArrowRight : ArrowLeft;
  const Next = lang === "he" ? ArrowLeft : ArrowRight;

  const body = () => {
    if (step === 0)
      return (
        <div className="flex flex-col gap-4">
          <h3 className="font-display text-[1.6rem] font-light text-burgundy">{w.whoQ}</h3>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={w.whoHint} aria-label={w.whoQ} className={cn(input, "ps-9")} />
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {matches.map((p) => (
              <li key={p.id}>
                <button type="button" aria-pressed={of === p.id} onClick={() => (setOf(p.id), setRel(""), setOther(""), setStep(1))} className={cn("flex min-h-14 w-full items-center gap-3 rounded-[12px] border bg-white px-3 text-start", of === p.id ? "border-burgundy" : "border-charcoal/10 hover:border-burgundy/40")}>
                  <PersonAvatar person={p} label={fam.nameOf(p.id)} className="w-10 text-[0.8rem]" />
                  <span className="flex flex-col leading-tight">
                    <span>{cap(fam.nameOf(p.id))}</span>
                    {p.id !== "rosa" && <span className="text-[0.8rem] text-ink-soft">{fam.relLabel(p.id)}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {errors.of && <p role="alert" className="text-burgundy">{errors.of}</p>}
        </div>
      );

    if (step === 1)
      return (
        <div className="flex flex-col gap-4">
          <h3 className="font-display text-[1.6rem] font-light text-burgundy">{w.relQ(ofName)}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {RELS.map(({ id, Icon }) => {
              const off = id === "parent" && parentFull;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={off}
                  aria-pressed={rel === id}
                  onClick={() => {
                    setRel(id);
                    setOther(id === "child" && partners.length === 1 ? partners[0] : "");
                  }}
                  className={cn("flex min-h-16 items-center gap-3 rounded-[12px] border bg-white px-4 text-start disabled:opacity-45", rel === id ? "border-burgundy ring-2 ring-burgundy/15" : "border-charcoal/10 hover:border-burgundy/40")}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blush/50 text-burgundy">
                    <Icon className="h-5 w-5" strokeWidth={1.6} aria-hidden />
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span>
                      {relLabel(id)} {ofName}
                    </span>
                    {off && <span className="text-[0.8rem] text-ink-soft">{w.parentFull}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          {rel === "child" && partners.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1">{w.withQ(ofName)}</legend>
              <div className="flex flex-wrap gap-2">
                {partners.map((x) => (
                  <button key={x} type="button" aria-pressed={other === x} onClick={() => setOther(x)} className={chip(other === x)}>
                    {cap(fam.nameOf(x))}
                  </button>
                ))}
                <button type="button" aria-pressed={other === ""} onClick={() => setOther("")} className={chip(other === "")}>
                  {w.withUnknown}
                </button>
              </div>
            </fieldset>
          )}
          {errors.rel && <p role="alert" className="text-burgundy">{errors.rel}</p>}
        </div>
      );

    if (step === 2)
      return (
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor={`${uid}-n`}>{f.name}</label>
            <input id={`${uid}-n`} autoFocus value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={LIMITS.name} aria-invalid={!!errors.name} className={input} />
            {errors.name && <span role="alert" className="text-[0.88rem] text-burgundy">{errors.name}</span>}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${uid}-a`}>
              {f.nameAlt} <span className="text-[0.8rem] text-ink-soft">({t.share.optional})</span>
            </label>
            <input id={`${uid}-a`} value={v.nameAlt} onChange={(e) => setV({ ...v, nameAlt: e.target.value })} maxLength={LIMITS.name} dir="auto" className={input} />
          </div>
          <fieldset className="flex flex-col gap-2 sm:col-span-2">
            <legend className="mb-1">{f.gender}</legend>
            <div className="flex flex-wrap gap-2">
              {(["f", "m", "x"] as Gender[]).map((x) => (
                <button key={x} type="button" aria-pressed={v.gender === x} onClick={() => setV({ ...v, gender: x })} className={chip(v.gender === x)}>
                  {f.genders[x]}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${uid}-b`}>{f.born}</label>
            <input id={`${uid}-b`} value={v.born} onChange={(e) => setV({ ...v, born: e.target.value })} inputMode="numeric" maxLength={20} className={input} />
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2.5 text-[0.95rem] text-ink-soft">
              <input
                type="checkbox"
                checked={gone}
                onChange={(e) => {
                  setGone(e.target.checked);
                  if (!e.target.checked) setV({ ...v, died: "" });
                }}
                className="h-4 w-4 accent-burgundy"
              />
              {w.gone}
            </label>
            {gone && (
              <div className="flex flex-col gap-2">
                <label htmlFor={`${uid}-d`} className="text-[0.9rem]">{w.died}</label>
                <input id={`${uid}-d`} value={v.died} onChange={(e) => setV({ ...v, died: e.target.value })} inputMode="numeric" maxLength={20} className={input} />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label htmlFor={`${uid}-p`}>{f.birthplace}</label>
            <input id={`${uid}-p`} value={v.birthplace} onChange={(e) => setV({ ...v, birthplace: e.target.value })} maxLength={80} className={input} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label htmlFor={`${uid}-ab`}>{f.about}</label>
            <textarea id={`${uid}-ab`} value={v.about} onChange={(e) => setV({ ...v, about: e.target.value })} rows={3} maxLength={600} placeholder={f.aboutPh} className={cn(input, "resize-y")} />
          </div>
          <p className="text-[0.85rem] text-ink-soft sm:col-span-2">{f.minors}</p>
        </div>
      );

    if (step === 3)
      return (
        <div className="flex flex-col items-center gap-4 text-center">
          <h3 className="font-display text-[1.6rem] font-light text-burgundy">{w.photoQ}</h3>
          <label className="flex cursor-pointer flex-col items-center gap-3">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-36 w-36 rounded-full object-cover ring-4 ring-white shadow-[var(--shadow-paper)]" />
            ) : (
              <span className="flex h-36 w-36 items-center justify-center rounded-full border-2 border-dashed border-dusty/60 bg-white text-rose">
                <Camera className="h-8 w-8" strokeWidth={1.4} aria-hidden />
              </span>
            )}
            <span className={buttonClass.secondary}>{f.photo}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPhoto(file);
                setPreview(URL.createObjectURL(file));
              }}
            />
          </label>
          <p className="text-[0.88rem] text-ink-soft">{w.photoHint}</p>
        </div>
      );

    // a last look: the new card, and where it goes
    const draft = { id: "draft", name, nameAlt: v.nameAlt, gender: v.gender, born: v.born, died: gone ? v.died || "?" : "", photoSrc: preview || existing?.photoSrc, pending: true };
    return (
      <div className="flex flex-col gap-5">
        <h3 className="font-display text-[1.6rem] font-light text-burgundy">{w.review}</h3>
        <div className="flex flex-wrap items-center justify-center gap-3 rounded-[16px] bg-[#fbf7f2] p-4 ring-1 ring-line">
          <PersonCard person={draft} name={name} relation={editing ? fam.relLabel(editing) : undefined} onOpen={() => setStep(2)} />
          {!editing && of && (
            <p className="max-w-[16rem] text-center text-[0.95rem] text-charcoal">
              {relLabel(rel as LinkRel)} {ofName}
              {rel === "child" && other ? ` ${lang === "he" ? "ו" : "и "}${cap(fam.nameOf(other))}` : ""}
            </p>
          )}
        </div>
        <p className="text-[0.9rem] text-ink-soft">{w.approval}</p>
        <label className="flex items-start gap-3 text-[0.95rem]">
          <input type="checkbox" checked={consent} onChange={(e) => (setConsent(e.target.checked), setErrors({}))} aria-invalid={!!errors.consent} className="mt-1 h-5 w-5 shrink-0 accent-rose" />
          <span>
            {f.consent}
            {errors.consent && <span role="alert" className="mt-1 block text-[0.88rem] text-burgundy">{errors.consent}</span>}
          </span>
        </label>
        {state === "error" && <p role="alert" className="rounded-[var(--radius-card)] bg-blush/50 px-4 py-3 text-burgundy">{f.errors.server}</p>}
        {state === "full" && <p role="alert" className="rounded-[var(--radius-card)] bg-blush/50 px-4 py-3 text-burgundy">{f.errors.full}</p>}
      </div>
    );
  };

  return (
    <>
      <motion.div className="fixed inset-0 z-[86] bg-charcoal/30 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        data-lenis-prevent
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.45, ease }}
        className="fixed inset-x-0 bottom-0 z-[87] mx-auto flex max-h-[92svh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[16px] bg-paper shadow-[var(--shadow-lift)] sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-[14px]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        lang={lang}
      >
        <div className="flex items-center justify-between px-6 pb-2 pt-4 sm:px-8">
          <h2 id={`${uid}-title`} className="flex items-center gap-3 font-display text-[1.5rem] font-light text-burgundy">
            <RoseBud className="h-8 w-6" still />
            {editing ? t.family.edit : f.title}
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t.family.close} className="flex h-11 w-11 items-center justify-center rounded-full text-burgundy hover:bg-blush/50">
            <X className="h-5 w-5" strokeWidth={1.4} aria-hidden />
          </button>
        </div>

        {state === "done" ? (
          <div role="status" className="flex flex-col items-center gap-4 px-8 pb-12 pt-6 text-center">
            <p className="font-display text-2xl leading-snug text-burgundy">{f.done}</p>
            {STATIC && <p className="text-[0.88rem] text-rose">{f.localNote}</p>}
            <button type="button" onClick={onClose} className={cn(buttonClass.secondary, "mt-2")}>
              {t.family.close}
            </button>
          </div>
        ) : (
          <>
            <div className="px-6 sm:px-8">
              <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }} aria-label={w.stepOf(shown + 1, steps.length)}>
                {steps.map((s, i) => (
                  <li key={s} aria-current={i === shown ? "step" : undefined} className="flex flex-col gap-1">
                    <span className={cn("h-1.5 rounded-full transition-colors", i <= shown ? "bg-rose" : "bg-charcoal/10")} />
                    <span className={cn("hidden text-[0.78rem] sm:block", i === shown ? "text-burgundy" : "text-ink-soft")}>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={step} initial={{ opacity: 0, x: lang === "he" ? -14 : 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease }}>
                  {body()}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4 sm:px-8">
              {shown > 0 ? (
                <button type="button" onClick={() => setStep(step - 1)} className={cn(buttonClass.secondary, "min-h-12")}>
                  <Prev className="h-4 w-4" aria-hidden />
                  {w.back}
                </button>
              ) : (
                <span />
              )}
              {step < 4 ? (
                <button type="button" onClick={next} className={cn(buttonClass.primary, "min-h-12 px-7")}>
                  {w.next}
                  <Next className="h-4 w-4" aria-hidden />
                </button>
              ) : (
                <button type="button" onClick={submit} disabled={state === "sending"} className={cn(buttonClass.primary, "min-h-12 px-7 disabled:opacity-60")}>
                  {state === "sending" ? f.sending : f.submit}
                </button>
              )}
            </div>
          </>
        )}
      </motion.div>
    </>
  );
}
