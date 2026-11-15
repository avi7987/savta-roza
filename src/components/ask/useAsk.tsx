"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { BookOpen, FileText, Mic, Quote, ShieldCheck } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { ease } from "@/lib/motion";

export type Source = { n: number; kind: string; text: string; memoryId?: string; factId?: string; title?: string; author?: string; photo?: string };
export type Answer = { answer: string; sources: Source[]; known: boolean } | { error: string };

/** asks the site a question about Rosa; the answer comes only from what the family shared */
export function useAsk() {
  const { lang } = useLang();
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Answer | null>(null);
  const ask = async (q: string) => {
    if (q.trim().length < 3 || busy) return;
    setBusy(true);
    setRes(null);
    const r = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q, lang }) }).catch(() => null);
    setRes(r ? ((await r.json().catch(() => ({ error: "x" }))) as Answer) : { error: "x" });
    setBusy(false);
  };
  return { ask, busy, res, reset: () => setRes(null) };
}

const KIND_ICON: Record<string, typeof Quote> = { fact: ShieldCheck, memory: BookOpen, note: Quote, ocr: FileText, transcript: Mic };

/** three soft dots while the answer is being written */
export function Thinking({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-3 text-ink-soft">
      <span className="flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="h-2 w-2 rounded-full bg-rose" animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }} transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }} />
        ))}
      </span>
      {label}
    </div>
  );
}

/** the answer, its [n] marks linked to the source cards beneath it */
export function AnswerView({ res, onSource, compact }: { res: Answer; onSource?: () => void; compact?: boolean }) {
  const { t } = useLang();
  const s = t.search;
  if ("error" in res) return <p className="text-center text-burgundy">{res.error === "tired" ? s.tired : s.askFailed}</p>;
  const render = (text: string) =>
    text.split(/(\[\d+\](?:,?\s*\[\d+\])*)/g).map((part, i) => {
      const nums = [...part.matchAll(/\[(\d+)\]/g)].map((m) => m[1]);
      return nums.length && /^\[/.test(part) ? (
        <span key={i} className="whitespace-nowrap">
          {nums.map((n) => (
            <a key={n} href={`#ask-src-${n}`} className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blush/70 px-1 align-[0.15em] font-sans text-[0.68rem] text-burgundy no-underline">
              {n}
            </a>
          ))}
        </span>
      ) : (
        <span key={i}>{part}</span>
      );
    });

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="flex flex-col gap-5">
      <p dir="auto" className={compact ? "font-display text-[1.25rem] leading-relaxed text-charcoal" : "text-center font-display text-[clamp(1.3rem,2.4vw,1.75rem)] leading-relaxed text-charcoal"}>
        {render(res.answer)}
      </p>
      {res.sources.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className={compact ? "label" : "label text-center"}>{s.sources}</span>
          <ul className={compact ? "flex flex-col gap-2" : "-mx-2 flex snap-x gap-3 overflow-x-auto px-2 pb-2 sm:flex-wrap sm:justify-center sm:overflow-visible"}>
            {res.sources.map((src) => {
              const Icon = KIND_ICON[src.kind] ?? Quote;
              return (
                <li key={src.n} id={`ask-src-${src.n}`} className={compact ? "" : "w-[17rem] shrink-0 snap-start"}>
                  <a
                    href={src.memoryId ? `/#m-${src.memoryId}` : "/#story"}
                    onClick={onSource}
                    className="flex h-full items-start gap-3 rounded-[14px] bg-white/85 p-3 text-start ring-1 ring-line transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[var(--shadow-paper)]"
                  >
                    {src.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src.photo} alt="" className="h-14 w-14 shrink-0 rounded-[8px] object-cover" />
                    ) : (
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[8px] bg-blush/40 text-rose">
                        <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                      </span>
                    )}
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex items-center gap-1.5 text-[0.75rem] text-ink-soft">
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blush/70 px-1 text-[0.62rem] text-burgundy">{src.n}</span>
                        {s.kinds[src.kind] ?? src.kind}
                        {src.author ? ` · ${src.author}` : ""}
                      </span>
                      <span dir="auto" className="line-clamp-2 text-[0.9rem] leading-snug text-charcoal/85">
                        {src.text}
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
