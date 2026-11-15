"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Mic, Search as SearchIcon, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { ease } from "@/lib/motion";
import { useLightbox } from "./Lightbox";
import Portal from "./Portal";
import { getLenis } from "./Transition";
import { usePhotos } from "./gallery/usePhotos";
import { cn } from "./ui";

type Result = { type: "photo" | "memory"; id: string; ids?: string[]; count?: number; memoryId: string; file?: string; kind?: string; title?: string; text?: string; author: string; year?: number; src?: string; related?: boolean };
type Source = { n: number; kind: string; text: string; memoryId?: string; factId?: string; title?: string; author?: string; photo?: string };
type Answer = { answer: string; sources: Source[]; known: boolean } | { error: string };

/** "Ask about grandma": an answer written only from the archive, with the sources under it */
function Ask({ onClose }: { onClose: () => void }) {
  const { t, lang } = useLang();
  const s = t.search;
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Answer | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => input.current?.focus(), []);

  const ask = async () => {
    if (q.trim().length < 3 || busy) return;
    setBusy(true);
    setRes(null);
    const r = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q, lang }) }).catch(() => null);
    setRes(r ? ((await r.json().catch(() => ({ error: "x" }))) as Answer) : { error: "x" });
    setBusy(false);
  };

  // the answer with its [n] marks turned into small superscript links to the cards
  const render = (text: string) =>
    text.split(/(\[\d+\])/g).map((part, i) => {
      const m = part.match(/^\[(\d+)\]$/);
      return m ? (
        <a key={i} href={`#src-${m[1]}`} className="mx-0.5 align-super text-[0.7em] text-burgundy no-underline">
          {m[1]}
        </a>
      ) : (
        <span key={i}>{part}</span>
      );
    });

  return (
    <div className="mt-4 flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
        className="flex flex-col gap-3"
      >
        <textarea
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask();
            }
          }}
          rows={2}
          maxLength={300}
          placeholder={s.askPlaceholder}
          aria-label={s.modeAsk}
          className="w-full resize-none rounded-[var(--radius-card)] border border-charcoal/15 bg-white px-4 py-3 font-display text-[1.3rem] outline-none focus:border-rose"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-lg text-[0.85rem] text-ink-soft">{s.askHint}</p>
          <button type="submit" disabled={busy || q.trim().length < 3} className="min-h-12 rounded-full bg-burgundy px-7 text-white disabled:opacity-50">
            {s.askButton}
          </button>
        </div>
      </form>
      <div aria-live="polite">
        {busy && <p className="text-ink-soft">{s.thinking}</p>}
        {res && "error" in res && <p className="text-burgundy">{res.error === "tired" ? s.tired : s.askFailed}</p>}
        {res && "answer" in res && (
          <div className="flex flex-col gap-5">
            <p dir="auto" className="rounded-[var(--radius-card)] bg-white p-5 font-display text-[1.25rem] leading-relaxed text-charcoal shadow-[var(--shadow-paper)]">
              {render(res.answer)}
            </p>
            {res.sources.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="label">{s.sources}</h3>
                <ul className="flex flex-col gap-2">
                  {res.sources.map((src) => (
                    <li key={src.n} id={`src-${src.n}`}>
                      <a
                        href={src.memoryId ? `/#m-${src.memoryId}` : "/#story"}
                        onClick={() => onClose()}
                        className="flex items-start gap-3 rounded-[10px] bg-white/70 p-3 ring-1 ring-line hover:ring-burgundy/40"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blush/60 text-[0.8rem] text-burgundy">{src.n}</span>
                        {src.photo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={src.photo} alt="" className="h-14 w-14 shrink-0 rounded-[6px] object-cover" />
                        )}
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-[0.8rem] text-ink-soft">
                            {s.kinds[src.kind] ?? src.kind}
                            {src.title ? ` · ${src.title}` : ""}
                            {src.author ? ` · ${src.author}` : ""}
                          </span>
                          <span dir="auto" className="line-clamp-3 text-[0.95rem] text-charcoal/85">
                            {src.text}
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const { photos } = usePhotos();
  const { open } = useLightbox();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"search" | "ask">("search");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getLenis()?.stop();
    input.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("keydown", esc);
      getLenis()?.start();
    };
  }, [onClose]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    setBusy(true);
    const ctl = new AbortController();
    const id = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d: { results: Result[] }) => setResults(d.results ?? []))
        .catch(() => {})
        .finally(() => setBusy(false));
    }, 280);
    return () => {
      clearTimeout(id);
      ctl.abort();
    };
  }, [q]);

  const pick = (r: Result) => {
    if (r.type === "photo") {
      const list = (results ?? []).filter((x) => x.type === "photo").flatMap((x) => x.ids ?? [x.id]).map((id) => photos.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
      const i = list.findIndex((p) => p.id === r.id);
      if (i >= 0) {
        onClose();
        setTimeout(() => open(list, i), 60);
        return;
      }
    }
    onClose();
    window.location.href = `/#m-${r.memoryId}`;
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={t.search.title}
      data-lenis-prevent
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease }}
      className="fixed inset-0 z-[90] overflow-y-auto bg-ivory/97 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-3xl flex-col px-[var(--spacing-gutter)] pb-16" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
        <div role="tablist" className="mt-2 flex gap-1 self-start rounded-full bg-white/80 p-1 ring-1 ring-line">
          {(["search", "ask"] as const).map((k) => (
            <button key={k} role="tab" aria-selected={mode === k} type="button" onClick={() => setMode(k)} className={cn("min-h-10 rounded-full px-4 text-[0.95rem]", mode === k ? "bg-burgundy text-white" : "text-charcoal")}>
              {k === "search" ? t.search.modeSearch : t.search.modeAsk}
            </button>
          ))}
        </div>
        {mode === "ask" ? (
          <>
            <div className="flex justify-end">
              <button type="button" onClick={onClose} aria-label={t.lightbox.close} className="-mt-11 flex h-12 w-12 items-center justify-center rounded-full text-burgundy hover:bg-white">
                <X className="h-6 w-6" strokeWidth={1.4} aria-hidden />
              </button>
            </div>
            <Ask onClose={onClose} />
          </>
        ) : (
        <>
        <div className="flex items-center gap-3 border-b border-charcoal/15 py-3">
          <SearchIcon className="h-6 w-6 shrink-0 text-rose" strokeWidth={1.5} aria-hidden />
          <input
            ref={input}
            type="text"
            enterKeyHint="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.search.placeholder}
            aria-label={t.search.title}
            className="min-h-14 w-full bg-transparent font-display text-[clamp(1.4rem,4vw,2rem)] text-charcoal outline-none placeholder:text-ink-soft/60"
          />
          <button type="button" onClick={onClose} aria-label={t.lightbox.close} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-burgundy hover:bg-white">
            <X className="h-6 w-6" strokeWidth={1.4} aria-hidden />
          </button>
        </div>
        <p className="mt-3 text-[0.9rem] text-ink-soft">{t.search.hint}</p>

        <div aria-live="polite" className="mt-6">
          {busy && results === null && <p className="text-ink-soft">{t.search.searching}</p>}
          {results && results.length === 0 && <p className="font-display text-xl text-charcoal">{t.search.none}</p>}
          {results && results.length > 0 && (
            <ul className="flex flex-col divide-y divide-line">
              {results.map((r) => (
                <li key={`${r.type}-${r.id}`}>
                  <button type="button" onClick={() => pick(r)} className="flex w-full items-start gap-4 py-4 text-start transition-colors hover:bg-white/60">
                    {r.type === "photo" && r.src && r.kind !== "audio" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.src} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-[6px] object-cover" />
                    ) : (
                      <span className={cn("flex h-20 w-20 shrink-0 items-center justify-center rounded-[6px] bg-blush/50 text-rose")}>
                        {r.kind === "audio" ? <Mic className="h-6 w-6" strokeWidth={1.4} aria-hidden /> : <span className="font-display text-3xl">“</span>}
                      </span>
                    )}
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="font-display text-lg text-burgundy">{r.title || (r.type === "photo" ? t.search.photo : t.search.memory)}</span>
                      {r.text && <span dir="auto" className="line-clamp-2 text-[0.95rem] text-charcoal/80">{r.text}</span>}
                      <span className="text-[0.8rem] text-ink-soft">
                        {[r.related ? t.search.related : "", r.author, r.year, (r.count ?? 1) > 1 ? t.gallery.items(r.count!) : ""].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        </>
        )}
      </div>
    </motion.div>
  );
}

/** A quiet magnifying glass that opens a search across the whole archive. */
export default function SearchButton({ className }: { className?: string }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={t.search.title} className={cn("flex h-11 w-11 items-center justify-center rounded-full text-burgundy transition-colors hover:bg-white/70", className)}>
        <SearchIcon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
      </button>
      <Portal>
        <AnimatePresence>{open && <SearchDialog key="search" onClose={() => setOpen(false)} />}</AnimatePresence>
      </Portal>
    </>
  );
}
