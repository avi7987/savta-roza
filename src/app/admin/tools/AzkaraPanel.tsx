"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, MessageCircle, Printer, QrCode } from "lucide-react";
import { Card } from "./Card";

/*
  Before the yearly memorial: a message for the family's WhatsApp group (when, where, and an
  invitation to add a memory to the site), and a QR code to the site, to attach or to print and put
  on the table. Everything is made here in the browser; nothing is sent anywhere until it is shared.
*/

type Form = { date: string; time: string; place: string; years: string; extra: string; target: "share" | "home" | "memories"; tone: "warm" | "short" };
const KEY = "roza-azkara";
const EMPTY: Form = { date: "", time: "", place: "", years: "", extra: "", target: "share", tone: "warm" };
const TARGETS = { share: ["הוספת זיכרון", "/share"], home: ["דף הבית", "/"], memories: ["ספר הזיכרונות", "/memories"] } as const;

const heDate = (d: Date) => d.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
const weekday = (d: Date) => d.toLocaleDateString("he-IL", { weekday: "long" });
/** a number in Hebrew letters, as dates are written: ט״ו, כ״ז, תשפ״ז */
function gematria(n: number) {
  const parts: [number, string][] = [[400, "ת"], [300, "ש"], [200, "ר"], [100, "ק"], [90, "צ"], [80, "פ"], [70, "ע"], [60, "ס"], [50, "נ"], [40, "מ"], [30, "ל"], [20, "כ"], [10, "י"], [9, "ט"], [8, "ח"], [7, "ז"], [6, "ו"], [5, "ה"], [4, "ד"], [3, "ג"], [2, "ב"], [1, "א"]];
  let s = "";
  let x = n;
  const take = (v: number, l: string) => {
    while (x >= v) {
      s += l;
      x -= v;
    }
  };
  take(400, "ת");
  // 15 and 16 are written ט״ו and ט״ז, never with the letters of God's name
  if (x % 100 === 15 || x % 100 === 16) {
    for (const [v, l] of parts.slice(1, 4)) take(v, l);
    s += x === 15 ? "טו" : "טז";
    x = 0;
  }
  for (const [v, l] of parts) take(v, l);
  return s.length > 1 ? `${s.slice(0, -1)}״${s.slice(-1)}` : `${s}׳`;
}
/** the Hebrew date, as the memorial is counted by it: ל׳ בכסלו תשפ״ז */
const hebrew = (d: Date) => {
  try {
    const p = new Intl.DateTimeFormat("he-u-ca-hebrew", { day: "numeric", month: "long", year: "numeric" }).formatToParts(d);
    const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
    return `${gematria(Number(get("day")))} ב${get("month")} ${gematria(Number(get("year")) % 1000)}`;
  } catch {
    return "";
  }
};

function message(f: Form, url: string) {
  const d = f.date ? new Date(`${f.date}T12:00:00`) : null;
  const when = d ? `${weekday(d)}, ${heDate(d)}${hebrew(d) ? ` (${hebrew(d)})` : ""}` : "[תאריך]";
  const n = Number(f.years);
  const occasion = n > 0 ? `${n === 1 ? "שנה" : n === 2 ? "שנתיים" : `${n} שנים`} לפטירתה של סבתא רוזה ז״ל` : "את האזכרה של סבתא רוזה ז״ל";
  const where = [f.place && `📍 ${f.place}`, f.time && `🕯️ בשעה ${f.time}`].filter(Boolean).join("\n");
  if (f.tone === "short")
    return [`תזכורת: ב${when} נציין ${occasion}.`, where, f.extra, "", `מוזמנים להוסיף לאתר שלה תמונה, סיפור או משפט שאתם זוכרים:`, url].filter((x) => x !== undefined).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return [
    "משפחה יקרה ❤️",
    "",
    `ב${when} נתאסף לציין ${occasion}.`,
    where,
    f.extra,
    "",
    "לקראת האזכרה, נשמח מאוד אם כל אחד יוסיף לאתר של סבתא משהו שהוא זוכר ממנה: תמונה, סיפור, מתכון, או משפט שהיא הייתה אומרת. כל זיכרון, גם קטן, שומר אותה איתנו.",
    "",
    url,
    "(אפשר גם לסרוק את הקוד המצורף)",
  ]
    .filter((x) => x !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function AzkaraPanel() {
  const [f, setF] = useState<Form>(EMPTY);
  const [text, setText] = useState("");
  const [edited, setEdited] = useState(false);
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    // the real site, also when this page is opened on the test site
    setOrigin(location.origin.replace("//redesign-", "//"));
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (v) setF({ ...EMPTY, ...v });
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(f));
    } catch {}
  }, [f]);

  const url = `${origin}${TARGETS[f.target][1]}`;
  const auto = useMemo(() => message(f, url), [f, url]);
  // the message follows the form, until it is edited by hand
  useEffect(() => {
    if (!edited) setText(auto);
  }, [auto, edited]);
  useEffect(() => {
    if (!origin) return;
    QRCode.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: "M", color: { dark: "#5e2338", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, [url, origin]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = qr;
    a.download = "סבתא-רוזה-QR.png";
    a.click();
  };
  // a card to print and put on the table: the code, large, and what it is for
  const print = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>סבתא רוזה · QR</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500&display=swap" rel="stylesheet">
<style>@page{size:A5;margin:14mm}body{margin:0;font-family:Rubik,Arial,sans-serif;color:#3b2a2f;text-align:center}
.card{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:calc(100vh - 2px);gap:10px}
h1{font-family:Rubik,sans-serif;font-weight:500;font-size:34px;color:#762e49;margin:0}
p{font-size:18px;margin:0;line-height:1.5}img{width:62mm;height:62mm;margin:8px 0}.u{font-size:13px;color:#8a6b74;direction:ltr}</style></head>
<body><div class="card"><h1>יש לכם זיכרון מסבתא רוזה?</h1><p>תמונה, סיפור, מתכון או משפט שלה.<br>סרקו והוסיפו לאתר שלה.</p><img src="${qr}" alt=""><p class="u">${url}</p></div>
<script>window.onload=()=>setTimeout(()=>window.print(),400)</script></body></html>`);
    w.document.close();
  };

  const field = "min-h-11 w-full rounded-md border border-charcoal/20 bg-white px-3.5";
  const label = "flex flex-col gap-1.5 text-[0.95rem]";
  const d = f.date ? new Date(`${f.date}T12:00:00`) : null;
  return (
    <Card icon={<MessageCircle className="h-5 w-5" strokeWidth={1.6} aria-hidden />} title="הודעה לאזכרה" lead="הודעת תזכורת לקבוצת הוואטסאפ של המשפחה, וקוד QR לאתר.">
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="grid content-start gap-3 sm:grid-cols-2">
          <label className={label}>
            תאריך האזכרה
            <input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} className={field} />
            {d && <span className="text-[0.85rem] text-ink-soft">{[weekday(d), hebrew(d)].filter(Boolean).join(" · ")}</span>}
          </label>
          <label className={label}>
            שעה
            <input type="time" value={f.time} onChange={(e) => set("time", e.target.value)} className={field} />
          </label>
          <label className={`${label} sm:col-span-2`}>
            מקום
            <input value={f.place} onChange={(e) => set("place", e.target.value)} placeholder="למשל: בית העלמין בחולון, ואחר כך אצל אבי" className={field} />
          </label>
          <label className={label}>
            כמה שנים לפטירתה (לא חובה)
            <input inputMode="numeric" value={f.years} onChange={(e) => set("years", e.target.value.replace(/\D/g, "").slice(0, 2))} className={field} />
          </label>
          <label className={label}>
            הקישור יוביל אל
            <select value={f.target} onChange={(e) => set("target", e.target.value as Form["target"])} className={field}>
              {Object.entries(TARGETS).map(([k, [name]]) => (
                <option key={k} value={k}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className={`${label} sm:col-span-2`}>
            עוד משהו להוסיף (לא חובה)
            <input value={f.extra} onChange={(e) => set("extra", e.target.value)} placeholder="למשל: אחרי האזכרה נאכל יחד" className={field} />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2" role="group" aria-label="סגנון ההודעה">
            {(
              [
                ["warm", "חמה ומזמינה"],
                ["short", "קצרה"],
              ] as const
            ).map(([k, name]) => (
              <button key={k} type="button" aria-pressed={f.tone === k} onClick={() => (set("tone", k), setEdited(false))} className={f.tone === k ? "min-h-10 rounded-full bg-burgundy px-4 text-white" : "min-h-10 rounded-full border border-charcoal/20 px-4 text-charcoal"}>
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <label className={label}>
            ההודעה (אפשר לערוך)
            <textarea value={text} onChange={(e) => (setText(e.target.value), setEdited(true))} rows={11} dir="rtl" className="w-full rounded-md border border-charcoal/20 bg-[#fbf8f4] p-3.5 leading-relaxed" />
          </label>
          {edited && (
            <button type="button" onClick={() => setEdited(false)} className="w-fit text-[0.88rem] text-ink-soft underline underline-offset-4 hover:text-burgundy">
              לחזור להודעה לפי הפרטים
            </button>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copy} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-rose px-5 text-white hover:bg-burgundy">
              <Copy className="h-4 w-4" aria-hidden />
              {copied ? "הועתק!" : "להעתיק"}
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-charcoal/20 px-5 text-burgundy hover:bg-blush/30">
              <MessageCircle className="h-4 w-4" aria-hidden />
              לפתוח בוואטסאפ
            </a>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-5 border-t border-line pt-5">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={`קוד QR אל ${url}`} className="h-36 w-36 rounded-md ring-1 ring-line" />
        ) : (
          <span className="flex h-36 w-36 items-center justify-center rounded-md bg-mount text-ink-soft">
            <QrCode className="h-8 w-8" aria-hidden />
          </span>
        )}
        <div className="flex flex-col gap-2">
          <p className="text-[0.95rem]">
            קוד QR אל <span dir="ltr" className="text-ink-soft">{url.replace(/^https?:\/\//, "")}</span>
          </p>
          <p className="max-w-sm text-[0.88rem] text-ink-soft">בוואטסאפ אי אפשר לצרף תמונה מתוך קישור: הורידו את הקוד וצרפו אותו להודעה בקבוצה. או הדפיסו כרטיס ושימו אותו על השולחן באזכרה.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={download} disabled={!qr} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-charcoal/20 px-5 text-burgundy hover:bg-blush/30 disabled:opacity-50">
              <Download className="h-4 w-4" aria-hidden />
              להוריד את הקוד
            </button>
            <button type="button" onClick={print} disabled={!qr} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-charcoal/20 px-5 text-burgundy hover:bg-blush/30 disabled:opacity-50">
              <Printer className="h-4 w-4" aria-hidden />
              כרטיס להדפסה
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
