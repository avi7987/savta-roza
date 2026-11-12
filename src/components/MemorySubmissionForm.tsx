"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { FileAudio, FileVideo, Upload, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { LIMITS, acceptAttr, kindOf, maxBytes } from "@/lib/limits";
import { ease } from "@/lib/motion";
import { RoseTop } from "./Botanical";
import { STATIC } from "./Transition";
import { buttonClass, cn } from "./ui";
import { prepare, type Prepared } from "@/lib/mediaPrep";
import { decadeLabel, formatDate } from "@/lib/photoDate";
import type { CategoryId } from "@/content/types";
import { useFamily } from "./family/useFamily";
import PersonAvatar from "./family/PersonAvatar";

type Picked = { file: File; url?: string; kind: "image" | "video" | "audio"; prep?: Prepared; preparing?: boolean };
type WhenMode = "unknown" | "date" | "year" | "decade";
const DECADES = [1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
const CATS: CategoryId[] = ["family", "childhood", "celebrations", "travel", "moments", "grandchildren"];

function Field({ label, optional, error, hint, children, id }: { label: string; optional?: string; error?: string; hint?: string; children: React.ReactNode; id: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex items-baseline gap-2 text-[0.98rem] text-charcoal">
        {label}
        {optional && <span className="text-[0.8rem] text-ink-soft">({optional})</span>}
      </label>
      {children}
      {hint && !error && <span id={`${id}-hint`} className="text-[0.82rem] text-ink-soft">{hint}</span>}
      {error && (
        <span id={`${id}-err`} role="alert" className="text-[0.88rem] text-burgundy">
          {error}
        </span>
      )}
    </div>
  );
}

const input =
  "w-full rounded-[var(--radius-card)] border border-charcoal/15 bg-white px-4 py-3.5 text-[1.02rem] text-charcoal outline-none transition-[border-color,box-shadow] placeholder:text-charcoal/35 focus:border-rose focus:shadow-[0_0_0_3px_rgba(184,92,120,0.15)] aria-[invalid=true]:border-burgundy";

export default function MemorySubmissionForm() {
  const { t, lang } = useLang();
  const s = t.share;
  const uid = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState({ name: "", relation: "", title: "", memory: "" });
  const [files, setFiles] = useState<Picked[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "done" | "error" | "full">("idle");
  const [over, setOver] = useState(false);
  const [tagged, setTagged] = useState<string[]>([]);
  const [when, setWhen] = useState<{ mode: WhenMode; date: string; year: string; decade?: number }>({ mode: "unknown", date: "", year: "" });
  const [category, setCategory] = useState<CategoryId | "">("");
  const fam = useFamily();
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  const tagOptions = fam.graph.people.filter((p) => !p.placeholder).sort((a, b) => (fam.graph.ring(a.id) ?? 9) - (fam.graph.ring(b.id) ?? 9));

  useEffect(() => () => files.forEach((f) => f.url && URL.revokeObjectURL(f.url)), [files]);

  const add = (list: FileList | File[]) => {
    const next: Picked[] = [];
    const problems: string[] = [];
    for (const file of Array.from(list)) {
      const kind = kindOf(file.type);
      if (!kind) problems.push(s.errors.type(file.name));
      else if (file.size > maxBytes(kind)) problems.push(s.errors.size(file.name));
      else next.push({ file, kind, url: kind === "image" ? URL.createObjectURL(file) : undefined });
    }
    next.forEach((p) => (p.preparing = p.kind !== "audio"));
    setFiles((cur) => {
      const merged = [...cur, ...next];
      if (merged.length > LIMITS.maxFiles) problems.push(s.errors.count);
      return merged.slice(0, LIMITS.maxFiles);
    });
    setErrors((e) => ({ ...e, files: problems.join(" · ") }));
    // read each file's own date and make its small preview, in the browser
    next
      .filter((p) => p.kind !== "audio")
      .forEach((p) =>
        prepare(p.file)
          .catch(() => ({}))
          .then((prep) => setFiles((cur) => cur.map((x) => (x.file === p.file ? { ...x, prep, preparing: false } : x))))
      );
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.name.trim()) e.name = s.errors.name;
    if (!values.memory.trim() && files.length === 0) e.memory = s.errors.memory;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (!validate()) {
      const first = ev.currentTarget.querySelector<HTMLElement>("[aria-invalid=true]");
      first?.focus();
      return;
    }
    setState("sending");
    if (STATIC) {
      setTimeout(() => setState("done"), 700);
      return;
    }
    const fd = new FormData(ev.currentTarget);
    fd.delete("files");
    files.forEach((f, i) => {
      fd.append("files", f.file);
      if (f.prep?.thumb) fd.append(`thumb-${i}`, f.prep.thumb, "thumb.jpg");
    });
    fd.set("filesMeta", JSON.stringify(files.map((f) => ({ date: f.prep?.date, width: f.prep?.width, height: f.prep?.height }))));
    fd.set("when", JSON.stringify({ mode: when.mode, date: when.date, year: Number(when.year) || undefined, decade: when.decade }));
    if (category) fd.set("category", category);
    try {
      const res = await fetch("/api/memories", { method: "POST", body: fd });
      if (res.status === 507) {
        setState("full");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setState("done");
    } catch {
      setState("error");
    }
  };

  const reset = () => {
    setValues({ name: "", relation: "", title: "", memory: "" });
    setFiles([]);
    setTagged([]);
    setWhen({ mode: "unknown", date: "", year: "" });
    setCategory("");
    setErrors({});
    setState("idle");
  };

  const ids = { name: `${uid}-name`, relation: `${uid}-rel`, title: `${uid}-title`, memory: `${uid}-mem`, files: `${uid}-files` };

  return (
    <AnimatePresence mode="wait">
      {state === "done" ? (
        <motion.div key="done" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.8, ease }} className="flex flex-col items-center gap-5 py-10 text-center" role="status">
          <RoseTop className="h-24 w-24" />
          <h2 className="font-display text-[clamp(2rem,4vw,2.8rem)] font-light text-burgundy">{s.doneTitle}</h2>
          <p className="max-w-md text-lg text-ink-soft">{s.doneLead}</p>
          {STATIC && <p className="max-w-md text-[0.88rem] text-rose">{s.demoNote}</p>}
          <button type="button" onClick={reset} className={cn(buttonClass.secondary, "mt-4")}>
            {s.another}
          </button>
        </motion.div>
      ) : (
        <motion.form key="form" noValidate onSubmit={submit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-7" lang={lang}>
          {/* hidden from people, tempting to bots */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />

          <div className="grid gap-7 sm:grid-cols-2">
            <Field id={ids.name} label={s.name} error={errors.name}>
              <input
                id={ids.name}
                name="name"
                autoComplete="name"
                maxLength={LIMITS.name}
                value={values.name}
                onChange={(e) => setValues({ ...values, name: e.target.value })}
                placeholder={s.namePh}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? `${ids.name}-err` : undefined}
                className={input}
              />
            </Field>
            <Field id={ids.relation} label={s.relation} optional={s.optional}>
              <input id={ids.relation} name="relation" maxLength={LIMITS.relation} value={values.relation} onChange={(e) => setValues({ ...values, relation: e.target.value })} placeholder={s.relationPh} className={input} />
            </Field>
          </div>

          <Field id={ids.title} label={s.titleLabel} optional={s.optional}>
            <input id={ids.title} name="title" maxLength={LIMITS.title} value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} placeholder={s.titlePh} className={input} />
          </Field>

          <Field id={ids.memory} label={s.memory} error={errors.memory}>
            <textarea
              id={ids.memory}
              name="memory"
              rows={7}
              maxLength={LIMITS.body}
              value={values.memory}
              onChange={(e) => setValues({ ...values, memory: e.target.value })}
              placeholder={s.memoryPh}
              aria-invalid={!!errors.memory}
              aria-describedby={errors.memory ? `${ids.memory}-err` : undefined}
              className={cn(input, "resize-y font-display text-[1.15rem] leading-[1.8]")}
            />
          </Field>

          <Field id={ids.files} label={s.files} optional={s.optional} error={errors.files} hint={s.filesHint(LIMITS.imageMB, LIMITS.videoMB, LIMITS.audioMB)}>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                add(e.dataTransfer.files);
              }}
              className={cn("flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed px-6 py-8 text-center transition-colors", over ? "border-rose bg-blush/30" : "border-charcoal/20 bg-white/60")}
            >
              <Upload className="h-6 w-6 text-rose" strokeWidth={1.3} aria-hidden />
              <button type="button" onClick={() => fileInput.current?.click()} className={buttonClass.quiet}>
                {s.choose}
              </button>
              <span className="text-[0.85rem] text-ink-soft">{s.drop}</span>
              <input
                ref={fileInput}
                id={ids.files}
                type="file"
                multiple
                accept={acceptAttr}
                className="sr-only"
                aria-describedby={`${ids.files}-hint`}
                onChange={(e) => {
                  if (e.target.files) add(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            {files.length > 0 && (
              <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {files.map((f, i) => (
                  <li key={`${f.file.name}-${i}`} className="group relative aspect-square overflow-hidden rounded-[var(--radius-photo)] bg-mount shadow-[var(--shadow-paper)]">
                    {f.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.url} alt={f.file.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center text-[0.7rem] text-ink-soft">
                        {f.kind === "video" ? <FileVideo className="h-6 w-6 text-rose" strokeWidth={1.3} aria-hidden /> : <FileAudio className="h-6 w-6 text-rose" strokeWidth={1.3} aria-hidden />}
                        <span className="line-clamp-2 break-all">{f.file.name}</span>
                      </span>
                    )}
                    {f.kind !== "audio" && (
                      <span className="absolute inset-x-1 bottom-1 truncate rounded bg-white/90 px-1.5 py-0.5 text-center text-[0.68rem] text-charcoal">
                        {f.preparing ? "…" : f.prep?.date ? `${formatDate({ source: "exif", date: f.prep.date }, lang)} · ${s.fromFile}` : s.noDate}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setFiles((all) => all.filter((_, j) => j !== i))}
                      aria-label={`${s.remove}: ${f.file.name}`}
                      className="absolute end-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-charcoal shadow"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Field>

          {files.some((f) => f.kind !== "audio") && (
            <fieldset className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-white/70 p-5 ring-1 ring-charcoal/[0.06]">
              <legend className="sr-only">{s.whenQ}</legend>
              <span aria-hidden className="text-[0.98rem] text-charcoal">{s.whenQ}</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={s.whenQ}>
                {(["unknown", "date", "year", "decade"] as WhenMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={when.mode === m}
                    onClick={() => setWhen((w) => ({ ...w, mode: m }))}
                    className={cn("min-h-11 rounded-full border px-4 text-[0.92rem] transition-colors", when.mode === m ? "border-burgundy bg-burgundy text-white" : "border-charcoal/15 bg-white text-charcoal hover:border-burgundy/40")}
                  >
                    {s.whenModes[m]}
                  </button>
                ))}
              </div>
              {when.mode === "unknown" && <p className="text-[0.85rem] leading-relaxed text-ink-soft">{s.whenUnknownHint}</p>}
              {when.mode === "date" && (
                <input type="date" aria-label={s.whenModes.date} value={when.date} min="1880-01-01" max={new Date().toISOString().slice(0, 10)} onChange={(e) => setWhen((w) => ({ ...w, date: e.target.value }))} className={cn(input, "max-w-xs")} />
              )}
              {when.mode === "year" && (
                <input type="number" inputMode="numeric" aria-label={s.whenModes.year} placeholder={s.yearPh} min={1880} max={new Date().getFullYear()} value={when.year} onChange={(e) => setWhen((w) => ({ ...w, year: e.target.value }))} className={cn(input, "max-w-[12rem]")} />
              )}
              {when.mode === "decade" && (
                <div className="flex flex-wrap gap-2">
                  {DECADES.map((d) => (
                    <button key={d} type="button" aria-pressed={when.decade === d} onClick={() => setWhen((w) => ({ ...w, decade: d }))} className={cn("min-h-10 rounded-full border px-3 text-[0.88rem]", when.decade === d ? "border-burgundy bg-blush/60 text-burgundy" : "border-charcoal/15 bg-white text-charcoal")}>
                      {decadeLabel(d, lang)}
                    </button>
                  ))}
                </div>
              )}

              <span className="mt-3 text-[0.98rem] text-charcoal">{s.categoryQ}</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label={s.categoryQ}>
                {CATS.map((c) => (
                  <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(category === c ? "" : c)} className={cn("min-h-10 rounded-full border px-3 text-[0.88rem]", category === c ? "border-burgundy bg-blush/60 text-burgundy" : "border-charcoal/15 bg-white text-charcoal")}>
                    {t.gallery.categories[c]}
                  </button>
                ))}
              </div>
              <p className="text-[0.82rem] text-ink-soft">{s.categoryHint}</p>
            </fieldset>
          )}

          {files.some((f) => f.kind !== "audio") && tagOptions.length > 0 && (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 text-[0.98rem] text-charcoal">{s.people}</legend>
              <p className="text-[0.82rem] text-ink-soft">{s.peopleHint}</p>
              <div className="flex flex-wrap gap-2">
                {tagOptions.map((p) => {
                  const on = tagged.includes(p.id);
                  const label = cap(fam.nameOf(p.id));
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setTagged((cur) => (on ? cur.filter((x) => x !== p.id) : [...cur, p.id]))}
                      className={cn(
                        "inline-flex min-h-11 items-center gap-2 rounded-full border py-1 pe-4 ps-1 text-[0.9rem] transition-colors",
                        on ? "border-burgundy bg-burgundy text-white" : "border-charcoal/15 bg-white text-charcoal hover:border-burgundy/40"
                      )}
                    >
                      <PersonAvatar person={p} label={label} className="w-8 text-[0.7rem]" />
                      {label}
                    </button>
                  );
                })}
              </div>
              {tagged.map((id) => (
                <input key={id} type="hidden" name="people" value={id} />
              ))}
            </fieldset>
          )}

          {state === "full" && (
            <p role="alert" className="rounded-[var(--radius-card)] bg-blush/50 px-4 py-3 text-burgundy">
              {s.errors.full}
            </p>
          )}
          {state === "error" && (
            <p role="alert" className="rounded-[var(--radius-card)] bg-blush/50 px-4 py-3 text-burgundy">
              {s.errors.server}
            </p>
          )}

          <div>
            <button type="submit" disabled={state === "sending" || files.some((f) => f.preparing)} className={cn(buttonClass.primary, "w-full sm:w-auto disabled:opacity-60")}>
              {files.some((f) => f.preparing) ? s.preparing : state === "sending" ? s.sending : s.submit}
            </button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
