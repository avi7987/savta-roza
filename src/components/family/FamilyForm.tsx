"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import type { FamilyGraph } from "@/lib/family";
import { useLang } from "@/lib/i18n";
import { LIMITS } from "@/lib/limits";
import { ease } from "@/lib/motion";
import { RoseBud } from "../Botanical";
import { STATIC, getLenis } from "../Transition";
import { buttonClass, cn } from "../ui";

const input =
  "w-full rounded-[var(--radius-card)] border border-charcoal/15 bg-white px-4 py-3 text-[1rem] text-charcoal outline-none transition-[border-color,box-shadow] placeholder:text-charcoal/35 focus:border-rose focus:shadow-[0_0_0_3px_rgba(184,92,120,0.15)] aria-[invalid=true]:border-burgundy";

type Rel = "child" | "partner" | "sibling" | "parent";

/** "Add yourself to the tree": a few required fields, more on request, then moderation. */
export default function FamilyForm({ graph, nameOf, replaces, onClose }: { graph: FamilyGraph; nameOf: (id: string) => string; replaces?: string; onClose: () => void }) {
  const { t, lang } = useLang();
  const f = t.family.form;
  const uid = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [more, setMore] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rel, setRel] = useState<Rel>("child");
  const [to, setTo] = useState("");

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

  // people to attach to, grouped by generation and named the way the visitor sees them
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const seen = new Map<string, number>();
  const options = graph.people
    .map((p) => ({ id: p.id, label: cap(nameOf(p.id)), ring: graph.ring(p.id) ?? -1 }))
    .sort((a, b) => a.ring - b.ring)
    .map((o) => {
      // empty slots share a relation word ("בת", "נכד"), so number them to tell them apart
      const n = (seen.get(o.label) ?? 0) + 1;
      seen.set(o.label, n);
      return { ...o, n };
    })
    .map((o) => ({ ...o, label: (seen.get(o.label) ?? 1) > 1 ? `${o.label} ${o.n}` : o.label }));

  const submit = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const e: Record<string, string> = {};
    if (!String(fd.get("name") ?? "").trim()) e.name = f.errors.name;
    if (!replaces && !to) e.to = f.errors.to;
    if (fd.get("consent") !== "yes") e.consent = f.errors.consent;
    setErrors(e);
    if (Object.keys(e).length) {
      ev.currentTarget.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }
    setState("sending");
    if (STATIC) {
      setTimeout(() => setState("done"), 600);
      return;
    }
    try {
      const res = await fetch("/api/family", { method: "POST", body: fd });
      if (!res.ok) throw new Error(String(res.status));
      setState("done");
    } catch {
      setState("error");
    }
  };

  const ids = { name: `${uid}-n`, alt: `${uid}-a`, to: `${uid}-t`, born: `${uid}-b`, place: `${uid}-p`, about: `${uid}-ab`, photo: `${uid}-ph`, consent: `${uid}-c` };

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
        transition={{ duration: 0.5, ease }}
        className="fixed inset-x-0 bottom-0 z-[87] mx-auto max-h-[92svh] w-full max-w-2xl overflow-y-auto rounded-t-[14px] bg-paper shadow-[var(--shadow-lift)] sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-[10px]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-paper/95 px-6 py-4 backdrop-blur sm:px-9">
          <h2 id={`${uid}-title`} className="flex items-center gap-3 font-display text-[1.7rem] font-light text-burgundy">
            <RoseBud className="h-9 w-6" still />
            {replaces ? t.family.edit : f.title}
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t.family.close} className="flex h-11 w-11 items-center justify-center rounded-full text-burgundy hover:bg-blush/50">
            <X className="h-5 w-5" strokeWidth={1.4} aria-hidden />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {state === "done" ? (
            <motion.div key="done" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 px-8 pb-12 pt-6 text-center">
              <p className="font-display text-2xl leading-snug text-burgundy">{f.done}</p>
              {STATIC && <p className="text-[0.88rem] text-rose">{t.share.demoNote}</p>}
              <button type="button" onClick={onClose} className={cn(buttonClass.secondary, "mt-2")}>
                {t.family.close}
              </button>
            </motion.div>
          ) : (
            <motion.form key="form" noValidate onSubmit={submit} className="flex flex-col gap-6 px-6 pb-9 pt-2 sm:px-9">
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
              {replaces && <input type="hidden" name="replaces" value={replaces} />}
              {replaces && <p className="text-ink-soft">{cap(nameOf(replaces))}</p>}

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor={ids.name}>{f.name}</label>
                  <input id={ids.name} name="name" maxLength={LIMITS.name} autoComplete="name" aria-invalid={!!errors.name} aria-describedby={errors.name ? `${ids.name}-e` : undefined} className={input} />
                  {errors.name && <span id={`${ids.name}-e`} role="alert" className="text-[0.88rem] text-burgundy">{errors.name}</span>}
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor={ids.alt}>
                    {f.nameAlt} <span className="text-[0.8rem] text-ink-soft">({t.share.optional})</span>
                  </label>
                  <input id={ids.alt} name="nameAlt" maxLength={LIMITS.name} lang={lang === "he" ? "ru" : "he"} className={input} />
                </div>
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2">{f.gender}</legend>
                <div className="flex flex-wrap gap-2">
                  {(["f", "m", "x"] as const).map((g, i) => (
                    <label key={g} className="cursor-pointer">
                      <input type="radio" name="gender" value={g} defaultChecked={i === 2} className="peer sr-only" />
                      <span className="inline-flex min-h-11 items-center rounded-full border border-charcoal/15 px-4 text-[0.92rem] text-charcoal transition-colors peer-checked:border-burgundy peer-checked:bg-burgundy peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-rose">
                        {f.genders[g]}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {!replaces && (
                <div className="grid gap-3 sm:grid-cols-[auto_1fr_1.4fr] sm:items-center">
                  <span>{f.relation}</span>
                  <select name="relationType" value={rel} onChange={(e) => setRel(e.target.value as Rel)} aria-label={f.relation} className={input}>
                    {(Object.keys(f.relationTypes) as Rel[]).map((r) => (
                      <option key={r} value={r}>
                        {f.relationTypes[r]}
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-col gap-1">
                    <select id={ids.to} name="to" value={to} onChange={(e) => setTo(e.target.value)} aria-label={f.to} aria-invalid={!!errors.to} className={input}>
                      <option value="">{f.to}</option>
                      {options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {errors.to && <span role="alert" className="text-[0.88rem] text-burgundy">{errors.to}</span>}
                  </div>
                </div>
              )}

              <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="inline-flex w-fit items-center gap-2 py-1 text-burgundy">
                <motion.span animate={{ rotate: more ? 45 : 0 }} className="flex h-6 w-6 items-center justify-center rounded-full border border-burgundy/30">
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </motion.span>
                {more ? f.less : f.more}
              </button>

              <AnimatePresence initial={false}>
                {more && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease }} className="overflow-hidden">
                    <div className="grid gap-5 pb-1 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <label htmlFor={ids.born}>{f.born}</label>
                        <input id={ids.born} name="born" inputMode="numeric" maxLength={20} className={input} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label htmlFor={ids.place}>{f.birthplace}</label>
                        <input id={ids.place} name="birthplace" maxLength={80} className={input} />
                      </div>
                      <div className="flex flex-col gap-2 sm:col-span-2">
                        <label htmlFor={ids.about}>{f.about}</label>
                        <textarea id={ids.about} name="about" rows={3} maxLength={600} placeholder={f.aboutPh} className={cn(input, "resize-y")} />
                      </div>
                      <div className="flex flex-col gap-2 sm:col-span-2">
                        <label htmlFor={ids.photo}>{f.photo}</label>
                        <input id={ids.photo} name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="text-[0.92rem] file:me-3 file:min-h-10 file:rounded-full file:border file:border-burgundy/25 file:bg-white file:px-4 file:text-burgundy" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="text-[0.85rem] text-ink-soft">{f.minors}</p>

              <label className="flex items-start gap-3 text-[0.95rem]">
                <input type="checkbox" name="consent" value="yes" aria-invalid={!!errors.consent} className="mt-1 h-5 w-5 shrink-0 accent-rose" />
                <span>
                  {f.consent}
                  {errors.consent && (
                    <span role="alert" className="mt-1 block text-[0.88rem] text-burgundy">
                      {errors.consent}
                    </span>
                  )}
                </span>
              </label>

              {state === "error" && <p role="alert" className="rounded-[var(--radius-card)] bg-blush/50 px-4 py-3 text-burgundy">{f.errors.server}</p>}

              <button type="submit" disabled={state === "sending"} className={cn(buttonClass.primary, "w-full sm:w-fit disabled:opacity-60")}>
                {state === "sending" ? f.sending : f.submit}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
