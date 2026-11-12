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

type Picked = { file: File; url?: string; kind: "image" | "video" | "audio" };

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
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [over, setOver] = useState(false);

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
    setFiles((cur) => {
      const merged = [...cur, ...next];
      if (merged.length > LIMITS.maxFiles) problems.push(s.errors.count);
      return merged.slice(0, LIMITS.maxFiles);
    });
    setErrors((e) => ({ ...e, files: problems.join(" · ") }));
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
    files.forEach((f) => fd.append("files", f.file));
    try {
      const res = await fetch("/api/memories", { method: "POST", body: fd });
      if (!res.ok) throw new Error(String(res.status));
      setState("done");
    } catch {
      setState("error");
    }
  };

  const reset = () => {
    setValues({ name: "", relation: "", title: "", memory: "" });
    setFiles([]);
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

          {state === "error" && (
            <p role="alert" className="rounded-[var(--radius-card)] bg-blush/50 px-4 py-3 text-burgundy">
              {s.errors.server}
            </p>
          )}

          <div>
            <button type="submit" disabled={state === "sending"} className={cn(buttonClass.primary, "w-full sm:w-auto disabled:opacity-60")}>
              {state === "sending" ? s.sending : s.submit}
            </button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
