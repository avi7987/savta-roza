"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { useLang } from "@/lib/i18n";
import type { PhotoDate } from "@/lib/photoDate";
import { refreshPhotos } from "./gallery/usePhotos";

/**
 * Anyone can ask for something to be removed. Nothing is deleted here:
 * the request goes to the site owner, who decides.
 */
export function RemovalRequest({ memoryId, file, requested, tone = "light", onSent }: { memoryId: string; file?: string; requested?: boolean; tone?: "light" | "dark"; onSent?: () => void }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">(requested ? "sent" : "idle");
  const [reason, setReason] = useState("");
  const [by, setBy] = useState("");
  const dark = tone === "dark";
  const muted = dark ? "text-ivory/55 hover:text-ivory" : "text-ink-soft hover:text-burgundy";

  if (state === "sent")
    return <span className={`inline-flex items-center gap-1.5 text-[0.82rem] ${dark ? "text-ivory/55" : "text-ink-soft"}`}>
      <Flag className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
      {requested ? t.removal.pending : t.removal.sent}
    </span>;

  const send = async () => {
    setState("sending");
    const r = await fetch("/api/removal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memoryId, file, reason, by }),
    }).catch(() => null);
    if (r?.ok) {
      setState("sent");
      onSent?.();
      refreshPhotos();
    } else setState("failed");
  };

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 text-[0.82rem] transition-colors ${muted}`}>
        <Flag className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
        {t.removal.ask}
      </button>
    );

  const field = dark
    ? "w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-ivory placeholder:text-ivory/40"
    : "w-full rounded-lg border border-charcoal/15 bg-white/70 px-3 py-2 text-sm text-charcoal placeholder:text-ink-soft/70";

  return (
    <div className={`flex w-full max-w-sm flex-col gap-2 rounded-2xl p-4 text-start ${dark ? "bg-white/5" : "bg-blush/40"}`}>
      <strong className={`font-display text-lg ${dark ? "text-ivory" : "text-burgundy"}`}>{t.removal.title}</strong>
      <p className={`text-[0.85rem] ${dark ? "text-ivory/65" : "text-ink-soft"}`}>{t.removal.lead}</p>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.removal.reason} aria-label={t.removal.reason} rows={2} maxLength={500} className={field} />
      <input value={by} onChange={(e) => setBy(e.target.value)} placeholder={t.removal.name} aria-label={t.removal.name} maxLength={80} className={field} />
      {state === "failed" && <p role="alert" className="text-[0.82rem] text-burgundy">{t.removal.failed}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={state === "sending"} onClick={send} className="min-h-10 rounded-full bg-rose px-4 text-sm text-white transition-opacity disabled:opacity-60">
          {t.removal.send}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={`min-h-10 rounded-full px-4 text-sm ${muted}`}>
          {t.removal.cancel}
        </button>
      </div>
    </div>
  );
}

export const DECADES = [1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

/** "Know when it was taken?" — one tap on a decade. Only offered while the date is unknown or a machine guess. */
export function DecadePicker({ memoryId, file, tone = "light", onDated }: { memoryId: string; file: string; tone?: "light" | "dark"; onDated?: (d: PhotoDate) => void }) {
  const { t, lang } = useLang();
  const [state, setState] = useState<"idle" | "sending" | "done" | "failed">("idle");
  const dark = tone === "dark";
  const label = (d: number) => (lang === "ru" ? `${d}-е` : `שנות ה־${String(d).slice(2)}`);

  if (state === "done") return <p className={`text-[0.85rem] ${dark ? "text-ivory/70" : "text-sage-deep"}`}>{t.dating.thanks}</p>;

  const pick = async (decade: number) => {
    setState("sending");
    const r = await fetch("/api/photos/date", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memoryId, file, decade }),
    }).catch(() => null);
    if (r?.ok) {
      const d = (await r.json()) as { date: PhotoDate };
      setState("done");
      onDated?.(d.date);
      refreshPhotos();
    } else setState("failed");
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <span className={`text-[0.85rem] ${dark ? "text-ivory/70" : "text-ink-soft"}`}>{t.dating.ask}</span>
      <div className="flex flex-wrap justify-center gap-1.5">
        {DECADES.map((d) => (
          <button
            key={d}
            type="button"
            disabled={state === "sending"}
            onClick={() => pick(d)}
            className={`min-h-9 rounded-full border px-3 text-[0.8rem] tabular-nums transition-colors disabled:opacity-50 ${dark ? "border-white/20 text-ivory/80 hover:bg-white/10" : "border-charcoal/15 text-charcoal hover:bg-blush/50"}`}
          >
            {label(d)}
          </button>
        ))}
      </div>
      {state === "failed" && <p role="alert" className="text-[0.82rem] text-burgundy">{t.dating.failed}</p>}
    </div>
  );
}
