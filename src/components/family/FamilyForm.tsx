"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { HUSBAND, ROSA } from "@/content/family";
import type { Gender } from "@/content/types";
import type { FamilyRequest, RequestKind } from "@/lib/family";
import { useLang } from "@/lib/i18n";
import { LIMITS } from "@/lib/limits";
import { ease } from "@/lib/motion";
import { RoseBud } from "../Botanical";
import { STATIC, getLenis } from "../Transition";
import { buttonClass, cn } from "../ui";
import PersonAvatar from "./PersonAvatar";
import type { useFamily } from "./useFamily";

type Fam = ReturnType<typeof useFamily>;
export type FormPreset = { kind?: RequestKind; parentId?: string; partnerOf?: string; replaces?: string };

const NEW = "__new";
const input =
  "w-full rounded-[var(--radius-card)] border border-charcoal/15 bg-white px-4 py-3 text-[1rem] text-charcoal outline-none transition-[border-color,box-shadow] placeholder:text-charcoal/35 focus:border-rose focus:shadow-[0_0_0_3px_rgba(184,92,120,0.15)] aria-[invalid=true]:border-burgundy";
const chip = (on: boolean) =>
  cn(
    "inline-flex min-h-11 items-center gap-2 rounded-full border py-1 pe-4 ps-1 text-[0.92rem] transition-colors",
    on ? "border-burgundy bg-burgundy text-white" : "border-charcoal/15 bg-white text-charcoal hover:border-burgundy/40"
  );

/** concentric rings with the relevant generation drawn darker, so the choice is visible at a glance */
function RingIcon({ ring }: { ring: number | "pair" | "up" }) {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
      {[5, 9.5, 14].map((r, i) => (
        <circle key={r} cx="16" cy="16" r={r} fill="none" stroke={ring === i + 1 ? "var(--color-burgundy)" : "var(--color-line)"} strokeWidth={ring === i + 1 ? 1.8 : 1} />
      ))}
      <circle cx="16" cy="16" r="2" fill="var(--color-rose)" />
      {ring === "pair" && (
        <>
          <circle cx="23" cy="9" r="2.6" fill="var(--color-burgundy)" />
          <circle cx="27" cy="12" r="2.6" fill="var(--color-dusty)" />
        </>
      )}
      {ring === "up" && <path d="M16 13V3m-3 3l3-3 3 3" stroke="var(--color-burgundy)" strokeWidth="1.6" fill="none" strokeLinecap="round" />}
    </svg>
  );
}

function Picker({ ids, value, onChange, fam, allowNew, label, error }: { ids: string[]; value: string; onChange: (v: string) => void; fam: Fam; allowNew: boolean; label: string; error?: string }) {
  const { t } = useLang();
  const labels = fam.optionLabel(ids);
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-[1rem] text-charcoal">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => {
          const p = fam.graph.byId.get(id)!;
          return (
            <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)} className={chip(value === id)}>
              <PersonAvatar person={p} label={labels.get(id)!} className="w-8 text-[0.7rem]" />
              {labels.get(id)}
            </button>
          );
        })}
        {allowNew && (
          <button type="button" aria-pressed={value === NEW} onClick={() => onChange(NEW)} className={cn(chip(value === NEW), "border-dashed ps-3")}>
            <Plus className="h-4 w-4" aria-hidden />
            {t.family.form.notYet}
          </button>
        )}
        {!allowNew && ids.length === 0 && <span className="text-[0.9rem] text-ink-soft">{t.family.form.noOne}</span>}
      </div>
      {error && <span role="alert" className="text-[0.88rem] text-burgundy">{error}</span>}
    </fieldset>
  );
}

function NewSlot({ name, setName, gender, setGender, id }: { name: string; setName: (v: string) => void; gender: Gender; setGender: (g: Gender) => void; id: string }) {
  const { t } = useLang();
  const f = t.family.form;
  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease }} className="overflow-hidden">
      <div className="flex flex-col gap-3 border-s-2 border-dashed border-dusty/50 py-1 ps-4">
        <label htmlFor={id} className="text-[0.95rem]">
          {f.newName}
        </label>
        <input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.name} className={input} />
        <span className="text-[0.82rem] text-ink-soft">{f.newNameHint}</span>
        <div className="flex flex-wrap gap-2">
          {(["f", "m", "x"] as Gender[]).map((g) => (
            <button key={g} type="button" aria-pressed={gender === g} onClick={() => setGender(g)} className={cn(chip(gender === g), "px-4 ps-4 text-[0.85rem]")}>
              {f.genders[g]}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/** Guided "add to the tree": the relationship first, then through whom, then a preview of the path. */
export default function FamilyForm({ fam, preset, onClose }: { fam: Fam; preset: FormPreset; onClose: () => void }) {
  const { t, lang, dir } = useLang();
  const f = t.family.form;
  const uid = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const { graph, nameOf } = fam;
  const replaces = preset.replaces;

  const [kind, setKind] = useState<RequestKind | undefined>(preset.kind);
  const [parent, setParent] = useState(preset.parentId ?? "");
  const [parentName, setParentName] = useState("");
  const [parentGender, setParentGender] = useState<Gender>("x");
  const [grand, setGrand] = useState("");
  const [grandName, setGrandName] = useState("");
  const [grandGender, setGrandGender] = useState<Gender>("x");
  const [partnerOf, setPartnerOf] = useState(preset.partnerOf ?? "");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("x");
  const [more, setMore] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const gen = (n: number) => graph.generation(n).map((p) => p.id);
  const unpartnered = graph.people.filter((p) => p.id !== ROSA && p.id !== HUSBAND && !graph.partnerOf(p.id) && graph.depth(p.id) !== null).map((p) => p.id);

  const kinds: { id: RequestKind; icon: number | "pair" | "up" }[] = [
    { id: "child", icon: 1 },
    { id: "grandchild", icon: 2 },
    { id: "great", icon: 3 },
    { id: "partner", icon: "pair" },
    { id: "sibling", icon: "up" },
    { id: "parent", icon: "up" },
  ];

  /* ---------- the path preview: Rosa ← … ← the new person ---------- */
  const you = name.trim() || f.you;
  const node = (label: string, isNew = false, key = label): ReactNode => (
    <span key={key} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.88rem]", isNew ? "border border-dashed border-rose text-rose" : "bg-white text-charcoal shadow-[var(--shadow-paper)]")}>
      {label}
      {isNew && <span className="text-[0.7rem] opacity-80">· {f.newTag}</span>}
    </span>
  );
  const pathNodes: ReactNode[] = [];
  if (kind && !replaces) {
    const rosa = node(cap(nameOf(ROSA)), false, "rosa");
    const parentNode = parent === NEW ? node(parentName.trim() || cap(t.family.rel.child[parentGender]), true, "p") : parent ? node(cap(nameOf(parent)), false, "p") : null;
    if (kind === "child") pathNodes.push(rosa, node(you, true, "you"));
    if (kind === "grandchild") pathNodes.push(rosa, parentNode, node(you, true, "you"));
    if (kind === "great") {
      const grandNode = parent === NEW ? (grand === NEW ? node(grandName.trim() || cap(t.family.rel.child[grandGender]), true, "g") : grand ? node(cap(nameOf(grand)), false, "g") : null) : null;
      pathNodes.push(rosa, grandNode, parentNode, node(you, true, "you"));
    }
    if (kind === "partner" && partnerOf) pathNodes.push(node(cap(nameOf(partnerOf)), false, "pt"), node(you, true, "you"));
    if (kind === "sibling" || kind === "parent") pathNodes.push(node(you, true, "you"), rosa);
  }
  const arrow = kind === "partner" ? "&" : dir === "rtl" ? "←" : "→";

  const submit = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = f.errors.name;
    if (!replaces) {
      if (!kind) e.kind = f.errors.kind;
      if ((kind === "grandchild" || kind === "great") && !parent) e.parent = f.errors.to;
      if (kind === "great" && parent === NEW && !grand) e.grand = f.errors.to;
      if (kind === "partner" && !partnerOf) e.partner = f.errors.to;
    }
    if (fd.get("consent") !== "yes") e.consent = f.errors.consent;
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => ev.currentTarget?.querySelector<HTMLElement>("[role=alert]")?.scrollIntoView({ block: "center", behavior: "smooth" }));
      return;
    }

    const req: FamilyRequest = {
      kind: replaces ? undefined : kind,
      replaces,
      name: name.trim(),
      nameAlt: String(fd.get("nameAlt") ?? "").trim() || undefined,
      gender,
      born: String(fd.get("born") ?? "").trim() || undefined,
      birthplace: String(fd.get("birthplace") ?? "").trim() || undefined,
      about: String(fd.get("about") ?? "").trim() || undefined,
      parentId: parent && parent !== NEW ? parent : undefined,
      parentName: parent === NEW ? parentName.trim() || undefined : undefined,
      parentGender: parent === NEW ? parentGender : undefined,
      grandparentId: parent === NEW && grand && grand !== NEW ? grand : undefined,
      grandparentName: parent === NEW && grand === NEW ? grandName.trim() || undefined : undefined,
      grandparentGender: parent === NEW && grand === NEW ? grandGender : undefined,
      partnerOf: kind === "partner" ? partnerOf : undefined,
    };

    setState("sending");
    if (STATIC) {
      fam.addLocal(`local-${Date.now()}`, req);
      setState("done");
      return;
    }
    const body = new FormData();
    Object.entries(req).forEach(([k, v]) => v !== undefined && body.set(k, String(v)));
    body.set("consent", "yes");
    const photo = fd.get("photo");
    if (photo instanceof File && photo.size) body.set("photo", photo);
    try {
      const res = await fetch("/api/family", { method: "POST", body });
      if (!res.ok) throw new Error(String(res.status));
      const { id } = await res.json();
      fam.addLocal(id, req);
      setState("done");
    } catch {
      setState("error");
    }
  };

  const ids = { name: `${uid}-n`, alt: `${uid}-a`, born: `${uid}-b`, place: `${uid}-p`, about: `${uid}-ab`, photo: `${uid}-ph`, pn: `${uid}-pn`, gn: `${uid}-gn` };

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
              {STATIC && <p className="text-[0.88rem] text-rose">{f.localNote}</p>}
              <button type="button" onClick={onClose} className={cn(buttonClass.secondary, "mt-2")}>
                {t.family.close}
              </button>
            </motion.div>
          ) : (
            <motion.form key="form" noValidate onSubmit={submit} lang={lang} className="flex flex-col gap-7 px-6 pb-9 pt-2 sm:px-9">
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />

              {replaces ? (
                <p className="text-ink-soft">{cap(nameOf(replaces))}</p>
              ) : (
                <fieldset className="flex flex-col gap-3">
                  <legend className="mb-2 text-[1.05rem] text-charcoal">{f.kindQ}</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {kinds.map((k) => (
                      <button
                        key={k.id}
                        type="button"
                        aria-pressed={kind === k.id}
                        onClick={() => {
                          setKind(k.id);
                          setParent("");
                          setGrand("");
                        }}
                        className={cn(
                          "flex min-h-14 items-center gap-3 rounded-[var(--radius-card)] border px-3 py-2 text-start text-[0.95rem] transition-colors",
                          kind === k.id ? "border-burgundy bg-blush/40 text-burgundy" : "border-charcoal/12 bg-white text-charcoal hover:border-burgundy/40"
                        )}
                      >
                        <RingIcon ring={k.icon} />
                        {f.kinds[k.id]}
                      </button>
                    ))}
                  </div>
                  {errors.kind && <span role="alert" className="text-[0.88rem] text-burgundy">{errors.kind}</span>}
                </fieldset>
              )}

              {(kind === "grandchild" || kind === "great") && !replaces && (
                <div className="flex flex-col gap-3">
                  <Picker fam={fam} ids={gen(kind === "grandchild" ? 1 : 2)} value={parent} onChange={setParent} allowNew label={f.parentQ} error={errors.parent} />
                  <AnimatePresence>{parent === NEW && <NewSlot id={ids.pn} name={parentName} setName={setParentName} gender={parentGender} setGender={setParentGender} />}</AnimatePresence>
                </div>
              )}

              {kind === "great" && parent === NEW && !replaces && (
                <div className="flex flex-col gap-3">
                  <Picker fam={fam} ids={gen(1)} value={grand} onChange={setGrand} allowNew label={f.grandQ} error={errors.grand} />
                  <AnimatePresence>{grand === NEW && <NewSlot id={ids.gn} name={grandName} setName={setGrandName} gender={grandGender} setGender={setGrandGender} />}</AnimatePresence>
                </div>
              )}

              {kind === "partner" && !replaces && <Picker fam={fam} ids={unpartnered} value={partnerOf} onChange={setPartnerOf} allowNew={false} label={f.partnerQ} error={errors.partner} />}

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor={ids.name}>{f.name}</label>
                  <input id={ids.name} value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.name} aria-invalid={!!errors.name} className={input} />
                  {errors.name && <span role="alert" className="text-[0.88rem] text-burgundy">{errors.name}</span>}
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
                  {(["f", "m", "x"] as Gender[]).map((g) => (
                    <button key={g} type="button" aria-pressed={gender === g} onClick={() => setGender(g)} className={cn(chip(gender === g), "px-4 ps-4")}>
                      {f.genders[g]}
                    </button>
                  ))}
                </div>
              </fieldset>

              {pathNodes.length > 0 && (
                <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-blush/30 px-5 py-4" aria-live="polite">
                  <span className="label">{f.path}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {pathNodes.filter(Boolean).map((n, i) => (
                      <span key={i} className="flex items-center gap-2">
                        {i > 0 && <span aria-hidden className="text-dusty">{arrow}</span>}
                        {n}
                      </span>
                    ))}
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
