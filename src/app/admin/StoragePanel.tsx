"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";

type Part = { bytes: number; count: number };
type Report = { used: number; cap: number; warn: number; free: number; kinds: { image: Part; video: Part; audio: Part; extra: Part } };

const GB = 1024 ** 3;
const MB = 1024 ** 2;
/** sizes the way people say them: megabytes under a gigabyte, gigabytes above */
const size = (b: number) => (b >= GB ? `${Number((b / GB).toFixed(2))}GB` : b >= MB ? `${Math.round(b / MB)}MB` : `${Math.max(0, Math.round(b / 1024))}KB`);
const num = (n: number) => n.toLocaleString("he-IL");

// one color per kind, from the site's own rose and burgundy
const PARTS: { key: keyof Report["kinds"]; label: string; unit: string; color: string }[] = [
  { key: "image", label: "תמונות", unit: "תמונות", color: "#b5566f" },
  { key: "video", label: "סרטונים", unit: "סרטונים", color: "#762e49" },
  { key: "audio", label: "הקלטות", unit: "הקלטות", color: "#c98a9b" },
  { key: "extra", label: "תצוגות מקדימות ופסקולים", unit: "קבצים", color: "#e3bcc6" },
];

/** How much room is used and left for new photos, videos and recordings, against the cap that keeps the site free. */
export default function StoragePanel({ token }: { token: string }) {
  const [r, setR] = useState<Report | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/admin/storage", { headers: { "x-admin-token": token } })
      .then((x) => (x.ok ? x.json() : Promise.reject()))
      .then(setR)
      .catch(() => setFailed(true));
  }, [token]);

  if (failed) return <section className="mt-6 rounded-lg bg-white p-6 text-ink-soft shadow-[var(--shadow-paper)]">לא הצלחנו לבדוק כמה מקום תפוס. נסו לרענן.</section>;
  if (!r) return <section className="mt-6 h-40 animate-pulse rounded-lg bg-white/60 shadow-[var(--shadow-paper)]" aria-hidden />;

  const left = Math.max(0, r.cap - r.used);
  const pct = Math.min(100, (r.used / r.cap) * 100);
  const state = r.used >= r.cap ? "full" : r.used >= r.warn ? "warn" : "ok";
  // a rough idea of what still fits, from the average size of what the family already uploaded
  const avg = (p: Part, fallback: number) => (p.count ? p.bytes / p.count : fallback);
  const photos = Math.floor(left / avg(r.kinds.image, 2 * MB));
  const videos = r.kinds.video.count ? Math.floor(left / avg(r.kinds.video, 0)) : 0;

  return (
    <section aria-labelledby="storage-title" className="mt-6 rounded-lg bg-white p-6 shadow-[var(--shadow-paper)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="storage-title" className="font-display text-2xl text-burgundy">
          מקום לאחסון
        </h2>
        <p className="text-[0.95rem] text-ink-soft">
          תקרה של {size(r.cap)} (החינם של Cloudflare הוא {size(r.free)})
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <p className="text-[1.05rem] text-charcoal">
          <b className="font-display text-[2.2rem] font-normal tabular-nums text-burgundy">{size(r.used)}</b> בשימוש ·{" "}
          <b className="tabular-nums">{size(left)}</b> פנויים
        </p>
        <span className={state === "ok" ? "rounded-full bg-blush/50 px-3 py-1 text-[0.88rem] text-burgundy" : "rounded-full bg-burgundy px-3 py-1 text-[0.88rem] text-white"}>
          {state === "full" ? "מלא: העלאת קבצים נעצרה" : state === "warn" ? "מתקרב לתקרה" : pct < 1 ? "פחות מ־1% בשימוש" : `${Math.round(pct)}% בשימוש`}
        </span>
      </div>

      {/* the bar: each kind its own color, and a mark where the warning comes */}
      <div className="relative mt-4 h-4 overflow-hidden rounded-full bg-mount ring-1 ring-line" role="img" aria-label={`${size(r.used)} בשימוש מתוך ${size(r.cap)}`}>
        <div className="flex h-full">
          {PARTS.map((p, i) => (
            <motion.span
              key={p.key}
              initial={{ width: 0 }}
              animate={{ width: `${(r.kinds[p.key].bytes / r.cap) * 100}%` }}
              transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="h-full"
              style={{ background: p.color }}
            />
          ))}
        </div>
        <span aria-hidden className="absolute inset-y-0 w-px bg-burgundy/50" style={{ insetInlineStart: `${(r.warn / r.cap) * 100}%` }} />
      </div>

      <ul className="mt-4 grid gap-x-6 gap-y-2 text-[0.92rem] sm:grid-cols-2 lg:grid-cols-4">
        {PARTS.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="text-charcoal">{p.label}</span>
            <span className="ms-auto tabular-nums text-ink-soft sm:ms-0">
              {size(r.kinds[p.key].bytes)}
              {p.key !== "extra" && ` · ${num(r.kinds[p.key].count)}`}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-5 grid gap-3 rounded-md bg-blush/25 p-4 text-[0.95rem] leading-relaxed text-charcoal">
        <p>
          <b className="text-burgundy">בערך כמה עוד אפשר להעלות:</b> כ־{num(photos)} תמונות
          {videos > 0 && <>, או כ־{num(videos)} סרטונים</>}, לפי הגודל הממוצע של מה שכבר באתר. זו הערכה גסה בלבד.
        </p>
        <p className="text-ink-soft">
          ב־{size(r.warn)} תישלח התראה במייל. ב־{size(r.cap)} העלאת תמונות, סרטונים והקלטות נעצרת לבד, כדי שלא יהיה חיוב. זיכרונות בכתב ממשיכים להתקבל. כדי לפנות מקום מוחקים תוכן מיותר ב&quot;כל התוכן&quot;, והקבצים שלו נמחקים.
        </p>
      </div>
    </section>
  );
}
