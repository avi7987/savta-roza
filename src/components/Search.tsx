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

type Result = { type: "photo" | "memory"; id: string; ids?: string[]; count?: number; memoryId: string; file?: string; kind?: string; title?: string; text?: string; author: string; year?: number; src?: string };

function SearchDialog({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const { photos } = usePhotos();
  const { open } = useLightbox();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState(false);
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
                        {[r.author, r.year, (r.count ?? 1) > 1 ? t.gallery.items(r.count!) : ""].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
