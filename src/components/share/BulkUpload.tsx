"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Check, FolderOpen, ImagePlus, RotateCcw, Video } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { PICK_MB, SEND_MB, kindOf } from "@/lib/limits";
import { prepare, shrinkImage, shrinkVideo } from "@/lib/mediaPrep";
import { STATIC, TLink } from "../Transition";
import { buttonClass, cn } from "../ui";

type Status = "waiting" | "preparing" | "shrinking" | "sending" | "done" | "dup" | "failed" | "big" | "type" | "full";
type Item = { id: number; file: File; kind: "image" | "video" | null; status: Status; progress: number; thumb?: string };

const NAME = "roza-my-name";
/** photos are quick; videos take the device's full attention, so one at a time */
const PARALLEL = 3;
const finished = (s: Status) => s === "done" || s === "dup" || s === "failed" || s === "big" || s === "type" || s === "full";

/** every file inside dropped folders */
async function filesFromDrop(dt: DataTransfer): Promise<File[]> {
  const entries = Array.from(dt.items)
    .map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null))
    .filter(Boolean) as FileSystemEntry[];
  if (!entries.length) return Array.from(dt.files);
  const out: File[] = [];
  const walk = async (e: FileSystemEntry): Promise<void> => {
    if (e.isFile) out.push(await new Promise<File>((ok, no) => (e as FileSystemFileEntry).file(ok, no)));
    else if (e.isDirectory) {
      const reader = (e as FileSystemDirectoryEntry).createReader();
      // a folder is read in batches until an empty one comes back
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((ok, no) => reader.readEntries(ok, no));
        if (!batch.length) break;
        for (const x of batch) await walk(x);
      }
    }
  };
  for (const e of entries) await walk(e).catch(() => {});
  return out;
}

/** send one file as its own memory, with the upload's progress */
function send(fd: FormData, onProgress: (p: number) => void) {
  return new Promise<number>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/memories");
    xhr.setRequestHeader("x-bulk", "1");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => resolve(0);
    xhr.onload = () => resolve(xhr.status);
    xhr.send(fd);
  });
}

/**
 * Many photos and videos at once: the name once, then a queue in the background. Each file is
 * dated from itself, checked against what the site already has, made smaller, and sent on its own,
 * so one failure never stops the rest.
 */
export default function BulkUpload() {
  const { t } = useLang();
  const b = t.bulk;
  const [name, setName] = useState("");
  const [nameErr, setNameErr] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const next = useRef(1);
  const running = useRef(0);
  const seen = useRef(new Set<string>());
  const nameRef = useRef(name);
  nameRef.current = name;
  const pickRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setName(localStorage.getItem(NAME) ?? "");
    } catch {}
  }, []);

  const patch = (id: number, p: Partial<Item>) => setItems((cur) => cur.map((x) => (x.id === id ? { ...x, ...p } : x)));

  // the queue: start waiting files while there is room
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const pump = () => {
    for (;;) {
      const cur = itemsRef.current;
      const videoBusy = cur.some((x) => x.kind === "video" && (x.status === "preparing" || x.status === "shrinking"));
      const nextItem = cur.find((x) => x.status === "waiting" && !(x.kind === "video" && videoBusy));
      if (!nextItem || running.current >= PARALLEL) return;
      running.current++;
      // mark it taken right away, so the next turn of the loop does not pick it again
      itemsRef.current = cur.map((x) => (x.id === nextItem.id ? { ...x, status: "preparing" } : x));
      patch(nextItem.id, { status: "preparing" });
      work(nextItem).finally(() => {
        running.current--;
        setTimeout(pump, 0);
      });
    }
  };

  const work = async (it: Item) => {
    const kind = it.kind!;
    const prep = await prepare(it.file).catch(() => ({}) as Awaited<ReturnType<typeof prepare>>);
    if (prep.thumb) patch(it.id, { thumb: URL.createObjectURL(prep.thumb) });
    // the same file twice in this upload (e.g. in two folders)
    if (prep.sha) {
      if (seen.current.has(prep.sha)) return patch(it.id, { status: "dup" });
      seen.current.add(prep.sha);
    }
    // already on the site (the very same file)? then it is not sent again
    if (prep.sha || prep.phash) {
      try {
        const r = await fetch("/api/photos/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ sha: prep.sha, phash: prep.phash }] }) });
        const hit = r.ok ? (await r.json()).results?.[0] : null;
        if (hit?.match === "exact") return patch(it.id, { status: "dup" });
      } catch {}
    }
    patch(it.id, { status: kind === "video" ? "shrinking" : "preparing", progress: 0 });
    const small = kind === "image" ? await shrinkImage(it.file) : await shrinkVideo(it.file, (p) => patch(it.id, { progress: p }));
    if (small.size > SEND_MB * 1024 * 1024) return patch(it.id, { status: "big" });

    const fd = new FormData();
    fd.set("type", kind === "video" ? "video" : "photos");
    fd.set("name", nameRef.current.trim());
    fd.set("memory", "");
    fd.append("files", small);
    if (prep.thumb) fd.append("thumb-0", prep.thumb, "thumb.jpg");
    if (prep.sound) fd.append("sound-0", prep.sound, "sound.wav");
    fd.set("filesMeta", JSON.stringify([{ date: prep.date, nameDate: prep.nameDate, width: prep.width, height: prep.height, sha: prep.sha, phash: prep.phash }]));
    fd.set("when", JSON.stringify({ mode: "unknown" }));
    // a busy moment on the server is tried again, a little later each time
    for (let attempt = 0; attempt < 4; attempt++) {
      patch(it.id, { status: "sending", progress: 0 });
      const status = STATIC ? 200 : await send(fd, (p) => patch(it.id, { progress: p }));
      if (status >= 200 && status < 300) return patch(it.id, { status: "done" });
      if (status === 409) return patch(it.id, { status: "dup" });
      if (status === 507) return patch(it.id, { status: "full" });
      if (status === 413) return patch(it.id, { status: "big" });
      if (status === 422) return patch(it.id, { status: "failed" });
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt + (status === 429 ? 20000 : 0)));
    }
    patch(it.id, { status: "failed" });
  };

  const add = (list: File[]) => {
    if (!nameRef.current.trim()) {
      setNameErr(true);
      document.getElementById("bulk-name")?.focus();
      return;
    }
    try {
      localStorage.setItem(NAME, nameRef.current.trim());
    } catch {}
    const fresh: Item[] = list
      .filter((f) => !f.name.startsWith("."))
      .map((file) => {
        const k = kindOf(file.type);
        const kind = k === "image" || k === "video" ? k : null;
        const status: Status = !kind ? "type" : file.size > PICK_MB[kind] * 1024 * 1024 ? "big" : "waiting";
        return { id: next.current++, file, kind, status, progress: 0 };
      });
    itemsRef.current = [...itemsRef.current, ...fresh];
    setItems(itemsRef.current);
    setTimeout(pump, 0);
  };

  const retry = () => {
    itemsRef.current = itemsRef.current.map((x) => (x.status === "failed" ? { ...x, status: "waiting", progress: 0 } : x));
    setItems(itemsRef.current);
    setTimeout(pump, 0);
  };

  // keep the screen awake while files are going up (where the browser allows it)
  const busy = items.some((x) => !finished(x.status));
  useEffect(() => {
    if (!busy || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => {
      lock?.release().catch(() => {});
      window.removeEventListener("beforeunload", warn);
    };
  }, [busy]);

  const total = items.length;
  const done = items.filter((x) => finished(x.status)).length;
  const up = items.filter((x) => x.status === "done").length;
  const dup = items.filter((x) => x.status === "dup").length;
  const failed = items.filter((x) => ["failed", "big", "type", "full"].includes(x.status)).length;
  const label = (x: Item) => {
    const st = b.status;
    if (x.status === "shrinking") return st.shrinking(Math.round(x.progress * 100));
    if (x.status === "sending") return st.sending(Math.round(x.progress * 100));
    return st[x.status] as string;
  };
  const field = "w-full rounded-[var(--radius-card)] border border-charcoal/15 bg-white px-4 py-3.5 text-[1.05rem] text-charcoal outline-none focus:border-rose focus:shadow-[0_0_0_3px_rgba(184,92,120,0.15)] aria-[invalid=true]:border-burgundy";

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-[clamp(1.7rem,3vw,2.2rem)] font-light text-burgundy">{b.title}</h2>
        <p className="text-[1.02rem] leading-relaxed text-ink-soft">{b.lead}</p>
      </div>

      <label className="flex max-w-md flex-col gap-2">
        <span className="text-[1.02rem] text-charcoal">{b.name}</span>
        <input
          id="bulk-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameErr(false);
          }}
          maxLength={80}
          autoComplete="name"
          placeholder={b.namePh}
          aria-invalid={nameErr}
          className={field}
        />
        {nameErr && <span role="alert" className="text-[0.92rem] text-burgundy">{b.needName}</span>}
      </label>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setOver(false);
          add(await filesFromDrop(e.dataTransfer));
        }}
        className={cn("flex flex-col items-center gap-4 rounded-[18px] border-2 border-dashed px-5 py-10 text-center transition-colors", over ? "border-rose bg-blush/30" : "border-dusty/50 bg-white/50")}
      >
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => pickRef.current?.click()} className={cn(buttonClass.primary, "min-h-14")}>
            <ImagePlus className="h-5 w-5" strokeWidth={1.6} aria-hidden />
            {b.pick}
          </button>
          <button type="button" onClick={() => folderRef.current?.click()} className={cn(buttonClass.secondary, "min-h-14")}>
            <FolderOpen className="h-5 w-5" strokeWidth={1.6} aria-hidden />
            {b.folder}
          </button>
        </div>
        <span className="text-[0.92rem] text-ink-soft">{b.drop}</span>
        <input ref={pickRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => (add(Array.from(e.target.files ?? [])), (e.target.value = ""))} />
        <input
          ref={folderRef}
          type="file"
          multiple
          className="hidden"
          // a whole folder (Chrome, Edge, Firefox, Safari on a computer)
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          onChange={(e) => (add(Array.from(e.target.files ?? [])), (e.target.value = ""))}
        />
      </div>

      {total > 0 && (
        <section aria-live="polite" className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-display text-[1.3rem] text-burgundy">{b.summary(done, total)}</span>
              <span className="text-[0.9rem] text-ink-soft">{b.counts(up, dup, failed)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-blush/40">
              <motion.div className="h-full origin-left rounded-full bg-rose rtl:origin-right" animate={{ scaleX: total ? done / total : 0 }} transition={{ type: "spring", visualDuration: 0.4, bounce: 0 }} />
            </div>
            {busy ? <p className="text-[0.9rem] text-ink-soft">{b.keepOpen}</p> : <p className="text-[1rem] text-burgundy">{b.allDone}</p>}
          </div>

          {!busy && (
            <div className="flex flex-wrap gap-3">
              {items.some((x) => x.status === "failed") && (
                <button type="button" onClick={retry} className={cn(buttonClass.secondary, "min-h-12")}>
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  {b.retry}
                </button>
              )}
              <TLink href="/sort" className={cn(buttonClass.primary, "min-h-12")}>
                {b.sort}
              </TLink>
              <TLink href="/gallery" className={cn(buttonClass.secondary, "min-h-12")}>
                {b.album}
              </TLink>
            </div>
          )}

          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
            {items.map((x) => (
              <li key={x.id} className="flex flex-col gap-1">
                <div className="relative aspect-square overflow-hidden rounded-[10px] bg-mount">
                  {x.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={x.thumb} alt="" className={cn("h-full w-full object-cover transition-opacity", !finished(x.status) && "opacity-60")} />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-dusty">{x.kind === "video" ? <Video className="h-6 w-6" aria-hidden /> : <ImagePlus className="h-6 w-6" aria-hidden />}</span>
                  )}
                  {x.status === "done" && (
                    <span className="absolute end-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-rose shadow">
                      <Check className="h-4 w-4" aria-hidden />
                    </span>
                  )}
                  {(x.status === "sending" || x.status === "shrinking") && (
                    <span className="absolute inset-x-0 bottom-0 h-1 bg-white/60">
                      <span className="block h-full bg-rose" style={{ width: `${Math.round(x.progress * 100)}%` }} />
                    </span>
                  )}
                </div>
                <span className={cn("truncate text-[0.75rem]", ["failed", "big", "type", "full"].includes(x.status) ? "text-burgundy" : "text-ink-soft")} title={x.file.name}>
                  {label(x)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
