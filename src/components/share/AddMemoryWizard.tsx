"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Camera, ChefHat, FileAudio, FileVideo, Images, Mail, Mic, PenLine, Square, Upload, Video, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { ACCEPT, LIMITS, kindOf, maxBytes } from "@/lib/limits";
import { ease } from "@/lib/motion";
import { prepare, type Prepared } from "@/lib/mediaPrep";
import { decadeLabel, formatDate } from "@/lib/photoDate";
import { RoseTop } from "../Botanical";
import { STATIC } from "../Transition";
import { buttonClass, cn } from "../ui";
import PeoplePicker, { refreshNames, usePeople } from "../people/PeoplePicker";

type MType = "photos" | "video" | "audio" | "story" | "letter" | "recipe";
type TextType = "story" | "letter" | "recipe";
type Dup = { match: "exact" | "similar"; status: "approved" | "pending" } | "local";
type Picked = { file: File; url?: string; kind: "image" | "video" | "audio"; prep?: Prepared; preparing?: boolean; dup?: Dup | null };
type WhenMode = "unknown" | "date" | "year" | "decade";
type When = { mode: WhenMode; date: string; year: string; decade?: number };

const TYPES: { id: MType; Icon: typeof Images }[] = [
  { id: "photos", Icon: Images },
  { id: "video", Icon: Video },
  { id: "audio", Icon: Mic },
  { id: "story", Icon: PenLine },
  { id: "letter", Icon: Mail },
  { id: "recipe", Icon: ChefHat },
];
const isText = (t: MType | null): t is TextType => t === "story" || t === "letter" || t === "recipe";
const DECADES = [1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
const DRAFT = "roza-draft-v1";
const NAME = "roza-my-name";
const STEPS = 4;

/** copies that are not sent: the exact same file already on the site, or picked twice */
const blocked = (f: Picked) => f.dup === "local" || (!!f.dup && f.dup.match === "exact");
const acceptFor = (t: MType | null) => (t === "video" ? ACCEPT.video : t === "audio" ? ACCEPT.audio : ACCEPT.image).join(",");

const input =
  "w-full rounded-[var(--radius-card)] border border-charcoal/15 bg-white px-4 py-3.5 text-[1.05rem] text-charcoal outline-none transition-[border-color,box-shadow] placeholder:text-charcoal/35 focus:border-rose focus:shadow-[0_0_0_3px_rgba(184,92,120,0.15)] aria-[invalid=true]:border-burgundy";
const bigBtn =
  "inline-flex min-h-14 items-center justify-center gap-2.5 rounded-[var(--radius-card)] border border-burgundy/20 bg-white px-5 text-[1.02rem] text-burgundy shadow-[0_1px_2px_rgba(60,40,30,0.06)] transition-colors hover:border-burgundy/50 hover:bg-blush/20";

function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-[1.02rem] text-charcoal">
      {children}
    </label>
  );
}

function Err({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return (
    <p id={id} role="alert" className="text-[0.95rem] text-burgundy">
      {text}
    </p>
  );
}

/** a tap-to-record button: the browser's own recorder, saved as an audio file */
function Recorder({ onDone, onDenied }: { onDone: (f: File) => void; onDenied: () => void }) {
  const { t } = useLang();
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [secs, setSecs] = useState(0);
  const supported = typeof window !== "undefined" && "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia;

  useEffect(() => {
    if (!rec) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [rec]);

  if (!supported) return null;

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported(m));
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const mime = (r.mimeType || type || "audio/webm").split(";")[0];
        const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
        onDone(new File(chunks, `recording-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.${ext}`, { type: mime }));
        setRec(null);
      };
      r.start();
      setSecs(0);
      setRec(r);
    } catch {
      onDenied();
    }
  };

  return rec ? (
    <button type="button" onClick={() => rec.stop()} className={cn(bigBtn, "border-burgundy bg-burgundy text-white hover:bg-burgundy/90")}>
      <Square className="h-4 w-4" fill="currentColor" aria-hidden />
      {t.wizard.stopRecording}
      <span className="tabular-nums opacity-80" aria-live="polite">
        {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
      </span>
    </button>
  ) : (
    <button type="button" onClick={start} className={bigBtn}>
      <Mic className="h-5 w-5" strokeWidth={1.6} aria-hidden />
      {t.wizard.record}
    </button>
  );
}

/**
 * "Add a memory" in four short steps: what you are sharing, the thing itself, a few optional
 * details, and a last look before sending. Large targets, one question per screen, and a draft
 * kept in this browser so nothing typed is lost.
 */
export default function AddMemoryWizard() {
  const { t, lang } = useLang();
  const s = t.share;
  const w = t.wizard;
  const uid = useId();
  const pickRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  const [type, setType] = useState<MType | null>(null);
  const [values, setValues] = useState({ name: "", relation: "", title: "", memory: "" });
  const [files, setFiles] = useState<Picked[]>([]);
  const [when, setWhen] = useState<When>({ mode: "unknown", date: "", year: "" });
  const [tagged, setTagged] = useState<string[]>([]);
  const [newNames, setNewNames] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "done" | "error" | "full">("idle");
  const [progress, setProgress] = useState(0);
  const [over, setOver] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const [restored, setRestored] = useState<null | { files: boolean }>(null);
  const ready = useRef(false);
  const trap = useRef<HTMLInputElement>(null);
  const { labelOf } = usePeople();

  // arrive with ?type=photos, or pick up a draft left earlier in this browser
  useEffect(() => {
    let name = "";
    try {
      name = localStorage.getItem(NAME) ?? "";
      const d = JSON.parse(localStorage.getItem(DRAFT) ?? "null");
      if (d && Date.now() - d.at < 14 * 864e5 && (d.type || d.values?.memory || d.values?.title)) {
        setType(d.type ?? null);
        setValues({ ...d.values, name: d.values?.name || name });
        if (d.when) setWhen(d.when);
        if (Array.isArray(d.tagged)) setTagged(d.tagged);
        if (Array.isArray(d.newNames)) setNewNames(d.newNames);
        setStep(d.fileCount && d.step > 1 ? 1 : Math.min(d.step ?? 0, 3));
        setRestored({ files: d.fileCount > 0 });
        ready.current = true;
        return;
      }
    } catch {}
    const q = new URLSearchParams(window.location.search).get("type") as MType | null;
    if (q && TYPES.some((x) => x.id === q)) {
      setType(q);
      setStep(1);
    }
    if (name) setValues((v) => ({ ...v, name }));
    ready.current = true;
  }, []);

  // keep a draft of everything typed (files cannot be kept)
  useEffect(() => {
    if (!ready.current || state === "done") return;
    const id = setTimeout(() => {
      try {
        if (!type && !values.memory && !values.title) localStorage.removeItem(DRAFT);
        else localStorage.setItem(DRAFT, JSON.stringify({ at: Date.now(), type, values, when, tagged, newNames, step, fileCount: files.length }));
      } catch {}
    }, 400);
    return () => clearTimeout(id);
  }, [type, values, when, tagged, newNames, step, files.length, state]);

  // previews are released when the page closes, not each time the list changes
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // each new step is announced and starts at its top
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headRef.current?.focus({ preventScroll: true });
    headRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [step]);

  const add = (list: FileList | File[]) => {
    const next: Picked[] = [];
    const problems: string[] = [];
    for (const file of Array.from(list)) {
      const kind = kindOf(file.type);
      if (!kind) problems.push(s.errors.type(file.name));
      else if (file.size > maxBytes(kind)) problems.push(s.errors.size(file.name));
      else {
        const url = kind === "image" ? URL.createObjectURL(file) : undefined;
        if (url) urls.current.push(url);
        next.push({ file, kind, url, preparing: kind !== "audio" });
      }
    }
    setFiles((cur) => {
      const merged = [...cur, ...next];
      if (merged.length > LIMITS.maxFiles) problems.push(s.errors.count);
      return merged.slice(0, LIMITS.maxFiles);
    });
    setErrors((e) => ({ ...e, files: problems.join(" · "), content: "" }));
    // the file's own date, a small preview, and whether the site already has it, all in the browser
    next
      .filter((p) => p.kind !== "audio")
      .forEach((p) =>
        prepare(p.file)
          .catch(() => ({}))
          .then(async (prep: Prepared) => {
            let dup: Dup | null = null;
            if (!STATIC && (prep.sha || prep.phash)) {
              try {
                const r = await fetch("/api/photos/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ sha: prep.sha, phash: prep.phash }] }) });
                dup = r.ok ? ((await r.json()).results?.[0] ?? null) : null;
              } catch {}
            }
            setFiles((cur) => {
              const twice = !!prep.sha && cur.some((x) => x.file !== p.file && x.prep?.sha === prep.sha && !blocked(x));
              return cur.map((x) => (x.file === p.file ? { ...x, prep, preparing: false, dup: twice ? "local" : dup } : x));
            });
          })
      );
  };

  const sendable = files.filter((f) => !blocked(f));
  const visual = files.some((f) => f.kind !== "audio");
  const preparing = files.some((f) => f.preparing);

  const checkContent = () => {
    const e: Record<string, string> = {};
    if (type === "recipe" && !values.title.trim()) e.title = w.needTitle;
    if (!values.memory.trim() && sendable.length === 0) e.content = files.length ? s.errors.allDup : w.needContent;
    setErrors(e);
    return !Object.keys(e).length;
  };

  const go = (n: number) => {
    if (n > step && step === 1 && !checkContent()) return;
    setErrors({});
    setStep(n);
  };

  const reset = () => {
    try {
      localStorage.removeItem(DRAFT);
    } catch {}
    setType(null);
    setValues((v) => ({ name: v.name, relation: "", title: "", memory: "" }));
    setFiles([]);
    setTagged([]);
    setNewNames([]);
    setWhen({ mode: "unknown", date: "", year: "" });
    setErrors({});
    setSkipped(0);
    setRestored(null);
    setState("idle");
    setStep(0);
  };

  const submit = () => {
    if (!values.name.trim()) {
      setErrors({ name: s.errors.name });
      document.getElementById(`${uid}-name`)?.focus();
      return;
    }
    if (!checkContent()) {
      setStep(1);
      return;
    }
    try {
      localStorage.setItem(NAME, values.name.trim());
    } catch {}
    setState("sending");
    setProgress(0);
    if (STATIC) {
      setTimeout(() => setState("done"), 700);
      return;
    }
    const fd = new FormData();
    fd.set("type", type ?? "story");
    fd.set("website", trap.current?.value ?? "");
    fd.set("name", values.name.trim());
    fd.set("relation", values.relation.trim());
    fd.set("title", values.title.trim());
    fd.set("memory", values.memory.trim());
    tagged.forEach((id) => fd.append("people", id));
    newNames.forEach((n) => fd.append("newPeople", n));
    sendable.forEach((f, i) => {
      fd.append("files", f.file);
      if (f.prep?.thumb) fd.append(`thumb-${i}`, f.prep.thumb, "thumb.jpg");
    });
    fd.set("filesMeta", JSON.stringify(sendable.map((f) => ({ date: f.prep?.date, nameDate: f.prep?.nameDate, width: f.prep?.width, height: f.prep?.height, sha: f.prep?.sha, phash: f.prep?.phash }))));
    fd.set("when", JSON.stringify({ mode: when.mode, date: when.date, year: Number(when.year) || undefined, decade: when.decade }));

    // a plain request, so the upload can show how far along it is
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/memories");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => setState("error");
    xhr.onload = () => {
      if (xhr.status === 507) return setState("full");
      if (xhr.status === 409) {
        setErrors({ content: s.errors.allDup });
        setState("idle");
        setStep(1);
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) return setState("error");
      let body: { skipped?: number } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      setSkipped((body.skipped ?? 0) + (files.length - sendable.length));
      try {
        localStorage.removeItem(DRAFT);
      } catch {}
      if (newNames.length) refreshNames();
      setState("done");
    };
    xhr.send(fd);
  };

  const ids = { name: `${uid}-name`, rel: `${uid}-rel`, title: `${uid}-title`, mem: `${uid}-mem`, files: `${uid}-files` };

  if (state === "done")
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }} className="flex flex-col items-center gap-5 py-10 text-center" role="status">
        <RoseTop className="h-24 w-24" />
        <h2 className="font-display text-[clamp(2rem,4vw,2.8rem)] font-light text-burgundy">{s.doneTitle}</h2>
        <p className="max-w-md text-lg text-ink-soft">{s.doneLead}</p>
        {STATIC && <p className="max-w-md text-[0.88rem] text-rose">{s.demoNote}</p>}
        {skipped > 0 && <p className="max-w-md text-[0.92rem] text-ink-soft">{s.skipped(skipped)}</p>}
        <button type="button" onClick={reset} className={cn(buttonClass.secondary, "mt-4")}>
          {s.another}
        </button>
      </motion.div>
    );

  /* ---------- pieces ---------- */

  const fileArea = (accept: string, label?: string) => (
    <div className="flex flex-col gap-3">
      {label && <span className="text-[1.02rem] text-charcoal">{label}</span>}
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
        className={cn("flex flex-col gap-3 rounded-[var(--radius-card)] border-2 border-dashed p-4 transition-colors sm:p-6", over ? "border-rose bg-blush/30" : "border-charcoal/15 bg-white/50")}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {type === "audio" ? (
            <Recorder onDone={(f) => add([f])} onDenied={() => setErrors((e) => ({ ...e, files: w.micDenied }))} />
          ) : (
            <button type="button" onClick={() => camRef.current?.click()} className={cn(bigBtn, "sm:hidden")}>
              <Camera className="h-5 w-5" strokeWidth={1.6} aria-hidden />
              {w.camera}
            </button>
          )}
          <button type="button" onClick={() => pickRef.current?.click()} className={cn(bigBtn, type !== "audio" && "sm:col-span-2")}>
            <Upload className="h-5 w-5" strokeWidth={1.6} aria-hidden />
            {files.length ? w.pickMore : w.pick}
          </button>
        </div>
        <p className="hidden text-center text-[0.88rem] text-ink-soft sm:block">{w.drop}</p>
        <p id={`${ids.files}-hint`} className="text-center text-[0.82rem] text-ink-soft">
          {s.filesHint(LIMITS.imageMB, LIMITS.videoMB, LIMITS.audioMB)}
        </p>
        <input
          ref={pickRef}
          id={ids.files}
          type="file"
          multiple
          accept={accept}
          className="sr-only"
          tabIndex={-1}
          aria-describedby={`${ids.files}-hint`}
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={camRef}
          type="file"
          accept={type === "video" ? "video/*" : "image/*"}
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <Err id={`${ids.files}-err`} text={errors.files} />
      {files.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {files.map((f, i) => (
            <li key={`${f.file.name}-${i}`} className={cn("relative aspect-square overflow-hidden rounded-[var(--radius-photo)] bg-mount shadow-[var(--shadow-paper)]", blocked(f) && "opacity-60 grayscale")}>
              {f.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.url} alt={f.file.name} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center text-[0.72rem] text-ink-soft">
                  {f.kind === "video" ? <FileVideo className="h-7 w-7 text-rose" strokeWidth={1.3} aria-hidden /> : <FileAudio className="h-7 w-7 text-rose" strokeWidth={1.3} aria-hidden />}
                  <span className="line-clamp-2 break-all">{f.file.name}</span>
                </span>
              )}
              {f.dup && (
                <span className={cn("absolute inset-x-0 top-0 px-1.5 py-1 text-center text-[0.68rem] leading-tight text-white", blocked(f) ? "bg-charcoal/80" : "bg-[#9a6a1c]/90")}>
                  {f.dup === "local" ? s.dupLocal : f.dup.match === "exact" ? (f.dup.status === "pending" ? s.dupPending : s.dupExact) : s.dupSimilar}
                </span>
              )}
              {f.kind !== "audio" && !blocked(f) && (
                <span className="absolute inset-x-1 bottom-1 truncate rounded bg-white/90 px-1.5 py-0.5 text-center text-[0.7rem] text-charcoal">
                  {f.preparing ? "…" : (f.prep?.date ?? f.prep?.nameDate) ? `${formatDate({ source: "exif", date: (f.prep?.date ?? f.prep?.nameDate)! }, lang)} · ${s.fromFile}` : s.noDate}
                </span>
              )}
              <button
                type="button"
                onClick={() => setFiles((all) => all.filter((_, j) => j !== i))}
                aria-label={`${s.remove}: ${f.file.name}`}
                className="absolute end-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-charcoal shadow"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {files.some((f) => f.dup && f.dup !== "local" && f.dup.match === "similar") && <p className="text-[0.85rem] text-[#7a5212]">{s.dupSimilarHint}</p>}
    </div>
  );

  const titleField = (label: string, ph: string) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={ids.title}>{label}</Label>
      <input
        id={ids.title}
        maxLength={LIMITS.title}
        value={values.title}
        onChange={(e) => setValues({ ...values, title: e.target.value })}
        placeholder={ph}
        aria-invalid={!!errors.title}
        aria-describedby={errors.title ? `${ids.title}-err` : undefined}
        className={input}
      />
      <Err id={`${ids.title}-err`} text={errors.title} />
    </div>
  );

  const textField = (label: string, ph: string, rows: number) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={ids.mem}>{label}</Label>
      <textarea
        id={ids.mem}
        rows={rows}
        maxLength={LIMITS.body}
        value={values.memory}
        onChange={(e) => setValues({ ...values, memory: e.target.value })}
        placeholder={ph}
        aria-invalid={!!errors.content && !files.length}
        className={cn(input, "resize-y font-display text-[1.15rem] leading-[1.8]")}
      />
    </div>
  );

  const whenLabel = () =>
    when.mode === "date" && when.date
      ? formatDate({ source: "user", date: when.date }, lang)
      : when.mode === "year" && when.year
        ? when.year
        : when.mode === "decade" && when.decade
          ? decadeLabel(when.decade, lang)
          : w.noWhen;

  /* ---------- steps ---------- */

  const heading = (title: string, lead?: string) => (
    <div className="flex flex-col gap-2">
      <h2 ref={headRef} tabIndex={-1} className="font-display text-[clamp(1.7rem,3.4vw,2.3rem)] font-light leading-tight text-burgundy outline-none">
        {title}
      </h2>
      {lead && <p className="text-[1.02rem] leading-relaxed text-ink-soft">{lead}</p>}
    </div>
  );

  const stepBody = () => {
    if (step === 0)
      return (
        <div className="flex flex-col gap-6">
          {heading(w.typeQ, w.typeLead)}
          <div role="radiogroup" aria-label={w.typeQ} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TYPES.map(({ id, Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={type === id}
                onClick={() => {
                  if (type !== id) setFiles([]);
                  setType(id);
                  setStep(1);
                }}
                className={cn(
                  "flex min-h-[8.5rem] flex-col items-start justify-between gap-3 rounded-[var(--radius-card)] border bg-white p-4 text-start transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-burgundy/40 hover:shadow-[var(--shadow-paper)] sm:p-5",
                  type === id ? "border-burgundy ring-2 ring-burgundy/20" : "border-charcoal/10"
                )}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blush/50 text-burgundy">
                  <Icon className="h-5 w-5" strokeWidth={1.6} aria-hidden />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[1.08rem] font-medium text-charcoal">{w.types[id][0]}</span>
                  <span className="text-[0.85rem] leading-snug text-ink-soft">{w.types[id][1]}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      );

    if (step === 1)
      return (
        <div className="flex flex-col gap-6">
          {heading(type ? w.types[type][0] : w.steps[1])}
          {isText(type) ? (
            <>
              {titleField(w.titles[type], w.titlePhs[type])}
              {textField(w.bodies[type], w.bodyPhs[type], 8)}
              {fileArea(ACCEPT.image.join(","), w.attachScan[type])}
            </>
          ) : (
            <>
              {fileArea(acceptFor(type))}
              {textField(w.wordsOptional, w.wordsPh, 3)}
            </>
          )}
          <Err id={`${uid}-content-err`} text={errors.content} />
        </div>
      );

    if (step === 2)
      return (
        <div className="flex flex-col gap-7">
          {heading(w.detailsTitle, w.detailsLead)}
          {!isText(type) && titleField(s.titleLabel + ` (${s.optional})`, s.titlePh)}

          {visual && (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 text-[1.02rem] text-charcoal">{s.whenQ}</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={s.whenQ}>
                {(["unknown", "date", "year", "decade"] as WhenMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={when.mode === m}
                    onClick={() => setWhen((x) => ({ ...x, mode: m }))}
                    className={cn("min-h-12 rounded-full border px-5 text-[0.98rem] transition-colors", when.mode === m ? "border-burgundy bg-burgundy text-white" : "border-charcoal/15 bg-white text-charcoal hover:border-burgundy/40")}
                  >
                    {s.whenModes[m]}
                  </button>
                ))}
              </div>
              {when.mode === "unknown" && <p className="text-[0.88rem] leading-relaxed text-ink-soft">{s.whenUnknownHint}</p>}
              {when.mode === "date" && (
                <input type="date" aria-label={s.whenModes.date} value={when.date} min="1880-01-01" max={new Date().toISOString().slice(0, 10)} onChange={(e) => setWhen((x) => ({ ...x, date: e.target.value }))} className={cn(input, "max-w-xs")} />
              )}
              {when.mode === "year" && (
                <input type="number" inputMode="numeric" aria-label={s.whenModes.year} placeholder={s.yearPh} min={1880} max={new Date().getFullYear()} value={when.year} onChange={(e) => setWhen((x) => ({ ...x, year: e.target.value }))} className={cn(input, "max-w-[12rem]")} />
              )}
              {when.mode === "decade" && (
                <div className="flex flex-wrap gap-2">
                  {DECADES.map((d) => (
                    <button key={d} type="button" aria-pressed={when.decade === d} onClick={() => setWhen((x) => ({ ...x, decade: d }))} className={cn("min-h-11 rounded-full border px-4 text-[0.92rem]", when.decade === d ? "border-burgundy bg-blush/60 text-burgundy" : "border-charcoal/15 bg-white text-charcoal")}>
                      {decadeLabel(d, lang)}
                    </button>
                  ))}
                </div>
              )}
            </fieldset>
          )}

          <PeoplePicker
            label={visual ? s.people : w.about}
            selected={tagged}
            added={newNames}
            onChange={(ids, names) => {
              setTagged(ids);
              setNewNames(names);
            }}
          />
        </div>
      );

    const thumbs = files.filter((f) => !blocked(f));
    return (
      <div className="flex flex-col gap-7">
        {heading(w.youTitle, w.youLead)}
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor={ids.name}>{s.name}</Label>
            <input
              id={ids.name}
              autoComplete="name"
              maxLength={LIMITS.name}
              value={values.name}
              onChange={(e) => {
                setValues({ ...values, name: e.target.value });
                if (errors.name) setErrors((x) => ({ ...x, name: "" }));
              }}
              placeholder={s.namePh}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? `${ids.name}-err` : undefined}
              className={input}
            />
            <Err id={`${ids.name}-err`} text={errors.name} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={ids.rel}>
              {s.relation} <span className="text-[0.82rem] text-ink-soft">({s.optional})</span>
            </Label>
            <input id={ids.rel} maxLength={LIMITS.relation} value={values.relation} onChange={(e) => setValues({ ...values, relation: e.target.value })} placeholder={s.relationPh} className={input} />
          </div>
        </div>

        {/* what it will look like */}
        <section aria-label={w.preview} className="flex flex-col gap-4 rounded-[4px] bg-white p-4 shadow-[0_1px_2px_rgba(60,40,30,0.1),0_8px_24px_-8px_rgba(60,40,30,0.12)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[0.85rem] text-ink-soft">
            <span>{type ? w.types[type][0] : ""}</span>
            <button type="button" onClick={() => setStep(1)} className={cn(buttonClass.quiet, "min-h-10 text-[0.9rem]")}>
              {w.edit}
            </button>
          </div>
          {thumbs.length > 0 && (
            <ul className="flex gap-2 overflow-x-auto">
              {thumbs.slice(0, 8).map((f, i) => (
                <li key={i} className="h-20 w-20 shrink-0 overflow-hidden rounded-[3px] bg-mount">
                  {f.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-rose">{f.kind === "video" ? <FileVideo className="h-6 w-6" strokeWidth={1.3} aria-hidden /> : <FileAudio className="h-6 w-6" strokeWidth={1.3} aria-hidden />}</span>
                  )}
                </li>
              ))}
              {thumbs.length > 8 && <li className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[3px] bg-mount text-ink-soft">+{thumbs.length - 8}</li>}
            </ul>
          )}
          {values.title.trim() && <h3 className="font-hand text-[1.35rem] leading-snug text-burgundy">{values.title}</h3>}
          {values.memory.trim() && <p className="line-clamp-6 whitespace-pre-line font-display text-[1.08rem] leading-[1.8] text-charcoal/90">{values.memory}</p>}
          <dl className="flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-3 text-[0.88rem] text-ink-soft">
            {thumbs.length > 0 && (
              <div className="flex gap-1">
                <dt className="sr-only">{s.files}</dt>
                <dd>{w.files(thumbs.length)}</dd>
              </div>
            )}
            {visual && (
              <div className="flex gap-1">
                <dt className="sr-only">{s.whenQ}</dt>
                <dd>{whenLabel()}</dd>
              </div>
            )}
            {tagged.length + newNames.length > 0 && (
              <div className="flex gap-1">
                <dt className="sr-only">{s.people}</dt>
                <dd>{[...tagged.map(labelOf), ...newNames].join(", ")}</dd>
              </div>
            )}
            {values.name.trim() && (
              <div className="flex gap-1">
                <dt className="sr-only">{s.name}</dt>
                <dd className="font-hand text-[1rem] text-rose">{values.name}</dd>
              </div>
            )}
          </dl>
        </section>

        <p className="rounded-[var(--radius-card)] bg-sage/15 px-4 py-3 text-[0.95rem] leading-relaxed text-sage-deep">{w.reassure}</p>

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
      </div>
    );
  };

  const Back = lang === "he" ? ArrowRight : ArrowLeft;
  const Next = lang === "he" ? ArrowLeft : ArrowRight;

  return (
    <div className="flex flex-col gap-8" lang={lang}>
      {/* hidden from people, tempting to bots */}
      <input ref={trap} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      {/* where you are */}
      <div className="flex flex-col gap-3">
        <ol className="grid grid-cols-4 gap-1.5" aria-label={w.stepOf(step + 1, STEPS)}>
          {w.steps.map((label, i) => (
            <li key={label} aria-current={i === step ? "step" : undefined} className="flex flex-col gap-1.5">
              <span className={cn("h-1.5 rounded-full transition-colors duration-500", i <= step ? "bg-rose" : "bg-charcoal/10")} />
              <span className={cn("hidden text-[0.82rem] sm:block", i === step ? "text-burgundy" : "text-ink-soft")}>{label}</span>
            </li>
          ))}
        </ol>
        <span className="text-[0.85rem] text-ink-soft sm:hidden">
          {w.stepOf(step + 1, STEPS)} · {w.steps[step]}
        </span>
      </div>

      {restored && step > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-card)] bg-blush/30 px-4 py-3 text-[0.92rem] text-burgundy">
          {w.draftRestored} {restored.files && w.draftFiles}
          <button type="button" onClick={reset} className={cn(buttonClass.quiet, "min-h-10")}>
            {w.startOver}
          </button>
        </p>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} initial={{ opacity: 0, x: lang === "he" ? -16 : 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease }}>
          {stepBody()}
        </motion.div>
      </AnimatePresence>

      {step > 0 && (
        <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={() => go(step - 1)} disabled={state === "sending"} className={cn(buttonClass.secondary, "min-h-14 justify-center")}>
            <Back className="h-4 w-4" aria-hidden />
            {w.back}
          </button>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            {step === 2 && (
              <button type="button" onClick={() => go(3)} className={cn(buttonClass.quiet, "min-h-14 justify-center px-4")}>
                {w.skip}
              </button>
            )}
            {step < 3 ? (
              <button type="button" onClick={() => go(step + 1)} disabled={preparing} className={cn(buttonClass.primary, "min-h-14 justify-center px-8 disabled:opacity-60")}>
                {preparing ? s.preparing : w.next}
                {!preparing && <Next className="h-4 w-4" aria-hidden />}
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={state === "sending" || preparing} className={cn(buttonClass.primary, "relative min-h-14 justify-center overflow-hidden px-8 disabled:opacity-90")}>
                {state === "sending" && <span aria-hidden className="absolute inset-y-0 start-0 bg-burgundy/60 transition-[width] duration-300" style={{ width: `${progress}%` }} />}
                <span className="relative" aria-live="polite">
                  {state === "sending" ? (files.length ? w.uploading(progress) : s.sending) : s.submit}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
