"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { BookOpen, FileText, ImagePlus, Mic, Network, Quote, ShieldCheck } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { ease } from "@/lib/motion";

export type Source = { n: number; kind: string; text: string; memoryId?: string; factId?: string; title?: string; author?: string; photo?: string };
export type Answer = { answer: string; sources: Source[]; known: boolean; feeling?: boolean } | { error: string };

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
    const a = r ? ((await r.json().catch(() => ({ error: "x" }))) as Answer) : { error: "x" };
    setRes(a);
    setBusy(false);
    // after a while with her answer, she may have a question of her own ("grandma asks")
    if (!("error" in a && a.error)) window.dispatchEvent(new CustomEvent("roza:engaged", { detail: { delay: 15000 } }));
  };
  return { ask, busy, res, reset: () => setRes(null) };
}

const KIND_ICON: Record<string, typeof Quote> = { fact: ShieldCheck, memory: BookOpen, note: Quote, ocr: FileText, transcript: Mic, tree: Network };

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
export function AnswerView({ res, onSource, compact, chat }: { res: Answer; onSource?: () => void; compact?: boolean; chat?: boolean }) {
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

  // the answer unfolds a paragraph (or, in a single paragraph, a sentence) at a time; its sources come last
  const paras = res.answer.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  const pieces = paras.length > 1 ? paras : res.answer.match(/[^.!?]+[.!?]+(?:\s*\[\d+\](?:,?\s*\[\d+\])*)?\s*|[^.!?]+$/g) ?? [res.answer];
  const STEP = 0.22;
  const sourcesAt = 0.25 + pieces.length * STEP;
  const textClass = compact ? "font-display text-[1.25rem] leading-relaxed text-charcoal" : chat ? "text-start font-display text-[clamp(1.2rem,2.2vw,1.55rem)] leading-relaxed text-charcoal" : "text-center font-display text-[clamp(1.3rem,2.4vw,1.75rem)] leading-relaxed text-charcoal";

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="flex flex-col gap-5">
      {paras.length > 1 ? (
        <div className="flex flex-col gap-3">
          {pieces.map((para, i) => (
            <motion.p key={i} dir="auto" className={textClass} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.15 + i * STEP }}>
              {render(para)}
            </motion.p>
          ))}
        </div>
      ) : (
        <p dir="auto" className={textClass}>
          {pieces.map((piece, i) => (
            <motion.span key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, ease, delay: 0.15 + i * STEP }}>
              {render(piece)}
            </motion.span>
          ))}
        </p>
      )}
      {/* nobody has told the site this yet: an invitation to tell it */}
      {!res.known && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease, delay: sourcesAt }} className={compact ? "flex flex-col items-start gap-3" : "flex flex-col items-center gap-3"}>
          <p className="text-ink-soft">{s.unknownInvite}</p>
          <a href="/share" onClick={onSource} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-burgundy px-5 text-[0.95rem] text-white transition-transform hover:-translate-y-0.5">
            <ImagePlus className="h-4 w-4" strokeWidth={1.6} aria-hidden />
            {s.addMemory}
          </a>
        </motion.div>
      )}
      {res.sources.length > 0 && (
        <div className="flex flex-col gap-2">
          <motion.span className={compact ? "label" : "label text-center"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: sourcesAt }}>
            {s.sources}
          </motion.span>
          <ul className={compact ? "flex flex-col gap-2" : "-mx-2 flex snap-x gap-3 overflow-x-auto px-2 pb-2 sm:flex-wrap sm:justify-center sm:overflow-visible"}>
            {res.sources.map((src, i) => {
              const Icon = KIND_ICON[src.kind] ?? Quote;
              return (
                <motion.li
                  key={src.n}
                  id={`ask-src-${src.n}`}
                  className={compact ? "" : "w-[17rem] shrink-0 snap-start"}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease, delay: sourcesAt + 0.1 + i * 0.08 }}
                >
                  <a
                    href={src.kind === "tree" ? "/family" : src.memoryId ? `/#m-${src.memoryId}` : "/#story"}
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
                </motion.li>
              );
            })}
          </ul>
        </div>
      )}
      {res.known && !compact && (
        <motion.a
          href="/share"
          onClick={onSource}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: sourcesAt + 0.3 + res.sources.length * 0.08 }}
          className="inline-flex min-h-11 items-center gap-2 self-center text-[0.92rem] text-burgundy underline decoration-dusty/50 underline-offset-4"
        >
          <ImagePlus className="h-4 w-4" strokeWidth={1.6} aria-hidden />
          {res.feeling ? s.feelingInvite : s.tellMore}
        </motion.a>
      )}
    </motion.div>
  );
}
