"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Flag, Image as ImageIcon, LogOut, Mic, RefreshCw, Trash2, Undo2, Video, X } from "lucide-react";
import { family as seed } from "@/content/family";
import { FamilyGraph, expandRequest, mergePeople, type TreePerson } from "@/lib/family";
import type { Status, StoredFile, StoredMemory, StoredPerson } from "@/server/store";
import { RoseBud } from "@/components/Botanical";
import { cn } from "@/components/ui";
import { decadeLabel, decadeOf, formatDate, sortYear, sourceLabel } from "@/lib/photoDate";
import { sha256, thumbFromBlob } from "@/lib/mediaPrep";
import { compare } from "@/lib/dedupe";
import type { CategoryId } from "@/content/types";

const CAT_HE: Record<CategoryId, string> = { family: "משפחה", childhood: "ילדות", celebrations: "חגיגות", travel: "טיולים", moments: "רגעים מיוחדים", grandchildren: "נכדים" };

/** When a photo was taken: shown, corrected, or estimated on request. */
function FileMeta({ memoryId, file, token, onSaved }: { memoryId: string; file: StoredFile; token: string; onSaved: (msg: string) => void }) {
  const [year, setYear] = useState(file.date?.year ? String(file.date.year) : "");
  const [cat, setCat] = useState<string>(file.category ?? "");
  const [busy, setBusy] = useState<"" | "save" | "ai">("");
  const [note, setNote] = useState("");
  if (file.kind === "audio") return null;

  const save = async () => {
    setBusy("save");
    const y = Number(year);
    const res = await fetch(`/api/memories/${memoryId}`, {
      method: "PATCH",
      headers: { "x-admin-token": token, "Content-Type": "application/json" },
      body: JSON.stringify({ files: [{ name: file.name, date: year ? { year: y } : undefined, category: cat }] }),
    });
    setBusy("");
    onSaved(res.ok ? "נשמר." : "השמירה לא הצליחה.");
  };

  const estimate = async () => {
    setBusy("ai");
    setNote("");
    const fd = new FormData();
    fd.set("file", file.name);
    // older uploads have no preview yet: make one here from the photo itself
    if (!file.thumb && file.kind === "image") {
      try {
        const r = await fetch(`/api/files/memories/${memoryId}/${file.name}`, { headers: { "x-admin-token": token } });
        const t = await thumbFromBlob(await r.blob());
        if (t.thumb) {
          fd.set("thumb", t.thumb, "thumb.jpg");
          fd.set("width", String(t.width));
          fd.set("height", String(t.height));
        }
      } catch {}
    }
    const res = await fetch(`/api/memories/${memoryId}/estimate`, { method: "POST", headers: { "x-admin-token": token }, body: fd });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (data.ok) onSaved("ההערכה עודכנה.");
    else setNote("לא הצלחנו להעריך את התמונה הזו כרגע. אפשר לכתוב שנה ידנית.");
  };

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md bg-ivory p-3 text-sm">
      <span className="text-charcoal">
        <b>מתי צולם:</b> {file.date ? `${formatDate(file.date, "he")} · ${sourceLabel(file.date, "he")}` : "עוד לא ידוע"}
      </span>
      {file.date?.source === "ai" && file.date.clues && <span className="text-ink-soft">{file.date.clues}</span>}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5">
          שנה
          <input type="number" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="1968" className="w-24 rounded border border-charcoal/20 bg-white px-2 py-1.5" />
        </label>
        <label className="flex items-center gap-1.5">
          נושא
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded border border-charcoal/20 bg-white px-2 py-1.5">
            <option value="">—</option>
            {(Object.keys(CAT_HE) as CategoryId[]).map((c) => (
              <option key={c} value={c}>
                {CAT_HE[c]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={save} disabled={!!busy} className="min-h-9 rounded-full bg-charcoal px-4 text-white disabled:opacity-50">
          {busy === "save" ? "שומרים…" : "שמירה"}
        </button>
        {(file.kind === "image" || file.thumb) && (
          <button type="button" onClick={estimate} disabled={!!busy} className="min-h-9 rounded-full border border-burgundy/30 px-4 text-burgundy disabled:opacity-50">
            {busy === "ai" ? "מעריכים…" : "הערכה אוטומטית"}
          </button>
        )}
      </div>
      {note && <span className="text-burgundy">{note}</span>}
    </div>
  );
}

type Kind = "memories" | "family";
type Section = "removals" | "memories" | "family" | "story";
type Item = StoredMemory | StoredPerson;

const TABS: { id: Status; label: string; empty: string }[] = [
  { id: "pending", label: "ממתינים לאישור", empty: "אין כרגע שום דבר שמחכה לאישור." },
  { id: "approved", label: "מופיעים באתר", empty: "עוד אין כאן שום דבר." },
  { id: "rejected", label: "הוסרו", empty: "לא הוסר שום דבר." },
];

type Notes = Record<string, { title?: string; text?: string; titleRu?: string; textRu?: string }>;
const ALL_DECADES = [1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

/** Optional words for each decade of the life story. Photos fill the decades on their own. */
function StoryEditor({ token, memories, onSaved }: { token: string; memories: StoredMemory[]; onSaved: (msg: string) => void }) {
  const [notes, setNotes] = useState<Notes>({});
  const [extra, setExtra] = useState<number[]>([]);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/story")
      .then((r) => (r.ok ? r.json() : { decades: {} }))
      .then((d: { decades: Notes }) => setNotes(d.decades ?? {}))
      .catch(() => {});
  }, []);

  const counts = useMemo(() => {
    const c = new Map<number, number>();
    for (const m of memories) {
      if (m.status === "rejected") continue;
      for (const f of m.files) {
        const y = sortYear(f.date);
        if (y) c.set(decadeOf(y), (c.get(decadeOf(y)) ?? 0) + 1);
      }
    }
    return c;
  }, [memories]);

  const decades = Array.from(new Set([...counts.keys(), ...Object.keys(notes).map(Number), ...extra])).sort((a, b) => a - b);
  const missing = ALL_DECADES.filter((d) => !decades.includes(d));

  const save = async (d: number, form: HTMLFormElement) => {
    const v = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setBusy(d);
    const r = await fetch("/api/story", { method: "PUT", headers: { "x-admin-token": token, "Content-Type": "application/json" }, body: JSON.stringify({ decade: d, ...v }) }).catch(() => null);
    setBusy(null);
    if (r?.ok) {
      setNotes((await r.json()).decades ?? notes);
      onSaved("נשמר. זה מופיע עכשיו בסיפור החיים.");
    } else onSaved("השמירה לא הצליחה. נסו שוב.");
  };

  const field = "w-full rounded-md border border-charcoal/20 bg-white px-3 py-2";
  return (
    <div className="mt-8 flex flex-col gap-6">
      <p className="text-ink-soft">
        התמונות נכנסות לכל עשור לבד, לפי השנה שבה צולמו. כאן אפשר (לא חובה) לתת לעשור כותרת ולכתוב עליו כמה מילים, בעברית וברוסית.
        מה שלא נכתב ברוסית יוצג בעברית.
      </p>
      {decades.map((d) => {
        const n = notes[String(d)] ?? {};
        return (
          <form
            key={`${d}-${JSON.stringify(n)}`}
            onSubmit={(e) => {
              e.preventDefault();
              save(d, e.currentTarget);
            }}
            className="flex flex-col gap-3 rounded-lg bg-white p-6 shadow-[var(--shadow-paper)]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-2xl text-burgundy">{decadeLabel(d, "he")}</span>
              <span className="text-sm text-ink-soft">{counts.get(d) ?? 0} תמונות וסרטונים</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                כותרת (עברית)
                <input name="title" defaultValue={n.title ?? ""} maxLength={120} placeholder={`למשל: ${decadeLabel(d, "he")} בקייב`} className={field} />
              </label>
              <label className="flex flex-col gap-1 text-sm" dir="ltr">
                <span dir="rtl">כותרת (רוסית)</span>
                <input name="titleRu" defaultValue={n.titleRu ?? ""} maxLength={120} lang="ru" className={field} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                כמה מילים (עברית)
                <textarea name="text" defaultValue={n.text ?? ""} maxLength={2000} rows={4} className={field} />
              </label>
              <label className="flex flex-col gap-1 text-sm" dir="ltr">
                <span dir="rtl">כמה מילים (רוסית)</span>
                <textarea name="textRu" defaultValue={n.textRu ?? ""} maxLength={2000} rows={4} lang="ru" className={field} />
              </label>
            </div>
            <button type="submit" disabled={busy === d} className="min-h-11 w-fit rounded-full bg-rose px-6 text-white hover:bg-burgundy disabled:opacity-50">
              {busy === d ? "שומרים…" : "שמירה"}
            </button>
          </form>
        );
      })}
      {missing.length > 0 && (
        <label className="flex flex-wrap items-center gap-3 text-ink-soft">
          הוספת עשור שעוד אין בו תמונות:
          <select value="" onChange={(e) => e.target.value && setExtra((x) => [...x, Number(e.target.value)])} className="min-h-11 rounded-md border border-charcoal/20 bg-white px-3">
            <option value="">בחרו</option>
            {missing.map((d) => (
              <option key={d} value={d}>
                {decadeLabel(d, "he")}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

type Removal = { m: StoredMemory; file?: StoredFile; req: NonNullable<StoredMemory["deleteRequest"]> };

const REL: Record<string, string> = { child: "בן/בת של רוזה", grandchild: "נכד/ה של רוזה", great: "נין/נינה של רוזה", partner: "בן/בת זוג", sibling: "אח/אחות של רוזה", parent: "הורה של רוזה" };
const fmtDate = (iso: string) => new Date(iso).toLocaleString("he-IL", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Files of a submission, fetched with the moderator's password so pending ones can be previewed. */
function FilePreview({ collection, id, file, token, onPrints }: { collection: Kind; id: string; file: StoredFile; token: string; onPrints?: (p: { sha?: string; phash?: string }) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    fetch(`/api/files/${collection}/${id}/${file.name}`, { headers: { "x-admin-token": token } })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (b && alive) {
          made = URL.createObjectURL(b);
          setUrl(made);
          // photos uploaded before fingerprints existed get them now, so duplicates can be found
          if (onPrints && file.kind === "image" && (!file.sha || !file.phash)) {
            Promise.all([sha256(b).catch(() => undefined), thumbFromBlob(b).then((t) => t.phash).catch(() => undefined)]).then(([sha, phash]) => (sha || phash) && onPrints({ sha, phash }));
          }
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
    // runs once per file; the fingerprint callback is only a side note
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection, id, file.name, token]);

  const size = `${(file.size / 1024 / 1024).toFixed(1)}MB`;
  if (!url)
    return (
      <span className="flex h-40 w-full items-center justify-center rounded-md bg-mount text-sm text-ink-soft">
        {file.kind === "image" ? <ImageIcon className="h-5 w-5" aria-hidden /> : file.kind === "video" ? <Video className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
      </span>
    );
  if (file.kind === "image")
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md bg-mount">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="max-h-72 w-full object-contain" />
      </a>
    );
  if (file.kind === "video") return <video src={url} controls className="max-h-72 w-full rounded-md bg-charcoal" aria-label={`סרטון · ${size}`} />;
  return <audio src={url} controls className="w-full" aria-label={`הקלטה · ${size}`} />;
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [section, setSection] = useState<Section>("removals");
  const kind: Kind = section === "family" ? "family" : "memories";
  const [tab, setTab] = useState<Status>("approved");
  const [data, setData] = useState<{ memories: StoredMemory[]; family: StoredPerson[] }>({ memories: [], family: [] });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async (tk: string) => {
    setError("");
    setBusy(true);
    try {
      const get = (k: Kind) => fetch(`/api/admin/memories?status=all&kind=${k}`, { headers: { "x-admin-token": tk } });
      const [m, f] = await Promise.all([get("memories"), get("family")]);
      if (m.status === 401) {
        setAuthed(false);
        setError("הסיסמה לא נכונה. בדקו שהעתקתם אותה במלואה.");
        try {
          sessionStorage.removeItem("roza-admin");
        } catch {}
        return;
      }
      setData({ memories: (await m.json()).memories ?? [], family: (await f.json()).memories ?? [] });
      setAuthed(true);
      try {
        sessionStorage.setItem("roza-admin", tk);
      } catch {}
    } catch {
      setError("לא הצלחנו להתחבר לאתר. בדקו את החיבור לאינטרנט ונסו שוב.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("roza-admin");
      if (saved) {
        setToken(saved);
        load(saved);
      }
    } catch {}
  }, [load]);

  /* names for family-tree requests: everyone approved or waiting, the way the site shows them */
  const graph = useMemo(() => {
    const people: TreePerson[] = [...data.family]
      .filter((p) => p.status !== "rejected")
      .reverse()
      .flatMap((p) => expandRequest(p, `fam-${p.id}`));
    return new FamilyGraph(mergePeople(seed, people));
  }, [data.family]);
  const nameOf = (id?: string) => {
    if (!id) return "";
    const p = graph.byId.get(id);
    if (!p) return "אדם שכבר לא בעץ";
    if (p.name) return p.name;
    return "מקום ריק בעץ";
  };

  const describePerson = (p: StoredPerson) => {
    if (p.replaces) return `משלים/ה פרטים למקום שכבר קיים בעץ: ${nameOf(p.replaces)}`;
    const parts = [REL[p.kind ?? ""] ?? ""];
    if (p.kind === "grandchild" || p.kind === "great") {
      parts.push(p.parentId ? `ההורה: ${nameOf(p.parentId)}` : `ההורה עוד לא היה בעץ ונוצר עכשיו${p.parentName ? `: ${p.parentName}` : " (בלי שם)"}`);
      if (p.kind === "great" && !p.parentId) parts.push(p.grandparentId ? `דרך: ${nameOf(p.grandparentId)}` : `ודרך ילד/ה חדש/ה של רוזה${p.grandparentName ? `: ${p.grandparentName}` : ""}`);
    }
    if (p.partnerOf) parts.push(`בן/בת הזוג של ${nameOf(p.partnerOf)}`);
    return parts.join(" · ");
  };

  const decide = async (item: Item, status: Status) => {
    setBusy(true);
    const res = await fetch(`/api/${kind === "family" ? "family" : "memories"}/${item.id}`, {
      method: "PATCH",
      headers: { "x-admin-token": token, "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("הפעולה לא הצליחה. נסו שוב.");
      return;
    }
    setToast(status === "approved" ? "אושר. זה מופיע עכשיו באתר." : status === "rejected" ? "הוסר. זה לא יופיע באתר, והקבצים שלו נמחקו." : "הוחזר לממתינים.");
    setTimeout(() => setToast(""), 3200);
    load(token);
  };

  /** another photo on the site (approved or waiting) that this one repeats */
  const dupOf = (m: StoredMemory, f: StoredFile) => {
    for (const o of data.memories) {
      if (o.id === m.id || o.status === "rejected") continue;
      for (const g of o.files) {
        const match = compare(f, g);
        // of two waiting copies, mark only the newer one
        if (match && !(o.status === "pending" && m.status === "pending" && o.createdAt > m.createdAt)) return { match, other: o };
      }
    }
    return null;
  };
  const savePrints = async (memoryId: string, name: string, p: { sha?: string; phash?: string }) => {
    const r = await fetch(`/api/memories/${memoryId}`, { method: "PATCH", headers: { "x-admin-token": token, "Content-Type": "application/json" }, body: JSON.stringify({ files: [{ name, ...p }] }) });
    if (r.ok) load(token);
  };

  const act = async (memoryId: string, body: object, msg: string) => {
    setBusy(true);
    const r = await fetch(`/api/memories/${memoryId}`, { method: "PATCH", headers: { "x-admin-token": token, "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (!r?.ok) {
      setError("הפעולה לא הצליחה. נסו שוב.");
      return;
    }
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
    load(token);
  };

  const removals: Removal[] = data.memories
    .filter((m) => m.status !== "rejected")
    .flatMap((m) => [
      ...(m.deleteRequest ? [{ m, req: m.deleteRequest }] : []),
      ...m.files.filter((f) => f.deleteRequest).map((f) => ({ m, file: f, req: f.deleteRequest! })),
    ]);

  const list = (kind === "memories" ? data.memories : data.family) as Item[];
  const count = (k: Kind, s: Status) => (k === "memories" ? data.memories : data.family).filter((x) => x.status === s).length;
  const shown = list.filter((x) => x.status === tab);

  return (
    <div dir="rtl" lang="he" className="min-h-screen bg-ivory">
      <header className="border-b border-line bg-paper/80">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <span className="flex items-center gap-2.5 text-burgundy">
            <RoseBud className="h-9 w-6" still />
            <span className="font-display text-xl">ניהול האתר של סבתא רוזה</span>
          </span>
          <span className="flex items-center gap-2">
            <a href="/" target="_blank" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-burgundy/25 px-4 text-[0.92rem] text-burgundy hover:bg-white">
              <ExternalLink className="h-4 w-4" aria-hidden />
              פתיחת האתר
            </a>
            {authed && (
              <button
                type="button"
                onClick={() => {
                  try {
                    sessionStorage.removeItem("roza-admin");
                  } catch {}
                  setAuthed(false);
                  setToken("");
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[0.92rem] text-ink-soft hover:text-charcoal"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                יציאה
              </button>
            )}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 pb-24 pt-10">
        {!authed ? (
          <div className="mx-auto max-w-md rounded-lg bg-white p-8 shadow-[var(--shadow-paper)]">
            <h1 className="font-display text-3xl font-light text-burgundy">כניסה לניהול</h1>
            <p className="mt-3 leading-relaxed text-ink-soft">כאן מטפלים בבקשות הסרה, מאשרים אנשים לעץ המשפחה וכותבים מילים לסיפור החיים.</p>
            <form
              className="mt-6 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                load(token.trim());
              }}
            >
              <label htmlFor="tk">סיסמת ניהול</label>
              <input id="tk" type="password" autoComplete="current-password" value={token} onChange={(e) => setToken(e.target.value)} className="rounded-md border border-charcoal/20 bg-white px-4 py-3 text-left" dir="ltr" />
              <button type="submit" disabled={busy || !token} className="mt-2 min-h-12 rounded-full bg-rose text-white transition-colors hover:bg-burgundy disabled:opacity-50">
                {busy ? "נכנסים…" : "כניסה"}
              </button>
              {error && <p role="alert" className="text-burgundy">{error}</p>}
            </form>
          </div>
        ) : (
          <>
            <section className="rounded-lg bg-white p-6 shadow-[var(--shadow-paper)]">
              <h1 className="font-display text-3xl font-light text-burgundy">שלום! כך זה עובד</h1>
              <ol className="mt-4 grid gap-3 text-[0.98rem] leading-relaxed text-charcoal sm:grid-cols-3">
                <li className="rounded-md bg-blush/30 p-4">
                  <b className="block text-burgundy">1. כל המשפחה מעלה</b>
                  תמונות, סרטונים וזיכרונות מופיעים באתר מיד, בלי לחכות לכם, ומסתדרים לבד לפי השנים.
                </li>
                <li className="rounded-md bg-blush/30 p-4">
                  <b className="block text-burgundy">2. רק אתם מוחקים</b>
                  מי שרוצה שמשהו יוסר שולח בקשה. היא מגיעה ל&quot;בקשות הסרה&quot; ושום דבר לא נמחק בלעדיכם.
                </li>
                <li className="rounded-md bg-blush/30 p-4">
                  <b className="block text-burgundy">3. עץ המשפחה אצלכם</b>
                  אנשים שמוסיפים את עצמם לעץ מופיעים רק אחרי שאישרתם ב&quot;עץ המשפחה&quot;.
                </li>
              </ol>
            </section>

            <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="מה לנהל">
                {(
                  [
                    ["removals", "בקשות הסרה", removals.length],
                    ["memories", "כל התוכן", data.memories.filter((m) => m.status === "pending").length],
                    ["family", "עץ המשפחה", count("family", "pending")],
                    ["story", "סיפור החיים", 0],
                  ] as [Section, string, number][]
                ).map(([k, label, n]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={section === k}
                    onClick={() => {
                      setSection(k);
                      setTab(k === "family" && count("family", "pending") > 0 ? "pending" : "approved");
                    }}
                    className={cn("inline-flex min-h-11 items-center gap-2 rounded-full px-5", section === k ? "bg-burgundy text-white" : "border border-charcoal/20 bg-white text-charcoal")}
                  >
                    {label}
                    {n > 0 && <span className={cn("rounded-full px-2 text-[0.8rem]", section === k ? "bg-white text-burgundy" : "bg-rose text-white")}>{n}</span>}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => load(token)} disabled={busy} className="inline-flex min-h-11 items-center gap-2 px-3 text-ink-soft hover:text-charcoal">
                <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} aria-hidden />
                רענון
              </button>
            </div>

            {error && <p role="alert" className="mt-4 text-burgundy">{error}</p>}

            {section === "story" && (
              <StoryEditor
                token={token}
                memories={data.memories}
                onSaved={(msg) => {
                  setToast(msg);
                  setTimeout(() => setToast(""), 3200);
                }}
              />
            )}

            {section === "removals" &&
              (removals.length === 0 ? (
                <div className="mt-12 flex flex-col items-center gap-4 rounded-lg border border-dashed border-dusty/50 px-6 py-14 text-center">
                  <RoseBud className="h-12 w-8" still />
                  <p className="font-display text-xl text-charcoal">אין בקשות הסרה.</p>
                  <p className="max-w-md text-ink-soft">כשמישהו במשפחה ילחץ &quot;בקשה להסרה&quot; על תמונה או זיכרון, זה יופיע כאן ותחליטו אם למחוק.</p>
                </div>
              ) : (
                <ul className="mt-8 flex flex-col gap-6">
                  {removals.map(({ m, file, req }) => (
                    <li key={`${m.id}-${file?.name ?? ""}`} className="rounded-lg bg-white p-6 shadow-[var(--shadow-paper)]">
                      <div className="mb-4 flex items-start gap-3 rounded-md bg-[#f6ead2] p-4 text-[#6b4a12]">
                        <Flag className="mt-1 h-4 w-4 shrink-0" aria-hidden />
                        <div className="flex flex-col gap-1">
                          <b>
                            {file ? "בקשה להסיר תמונה" : "בקשה להסיר זיכרון"}
                            {req.by ? ` · מאת ${req.by}` : ""}
                          </b>
                          {req.reason ? <span dir="auto">&quot;{req.reason}&quot;</span> : <span>לא נכתבה סיבה.</span>}
                          <span className="text-sm opacity-80">{fmtDate(req.at)}</span>
                        </div>
                      </div>
                      <span className="text-sm text-ink-soft">
                        הועלה על ידי {m.author} · {fmtDate(m.createdAt)}
                      </span>
                      {!file && m.body && <p className="mt-2 whitespace-pre-wrap font-display text-lg leading-relaxed text-charcoal/90" dir="auto">{m.body}</p>}
                      {(file ? [file] : m.files).length > 0 && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {(file ? [file] : m.files).map((f) => (
                            <FilePreview key={f.name} collection="memories" id={m.id} file={f} token={token} />
                          ))}
                        </div>
                      )}
                      <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-4">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => (file ? act(m.id, { removeFile: file.name }, "התמונה נמחקה מהאתר.") : act(m.id, { status: "rejected" }, "הזיכרון הוסר מהאתר."))}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-burgundy px-6 text-white disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                          {file ? "למחוק את התמונה" : "להסיר את הזיכרון"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => (file ? act(m.id, { files: [{ name: file.name, keep: true }] }, "נשאר באתר.") : act(m.id, { keep: true }, "נשאר באתר."))}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-charcoal/20 px-5 text-charcoal hover:bg-ivory disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" aria-hidden />
                          להשאיר באתר
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ))}

            {(section === "memories" || section === "family") && (
            <>
            <div role="tablist" className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
              {TABS.filter((tb) => kind === "family" || tb.id !== "pending" || count("memories", "pending") > 0).map((tb) => (
                <button
                  key={tb.id}
                  role="tab"
                  aria-selected={tab === tb.id}
                  onClick={() => setTab(tb.id)}
                  className={cn("min-h-11 whitespace-nowrap border-b-2 px-4", tab === tb.id ? "border-burgundy text-burgundy" : "border-transparent text-ink-soft")}
                >
                  {tb.label} <span className="tabular-nums opacity-70">· {count(kind, tb.id)}</span>
                </button>
              ))}
            </div>

            {shown.length === 0 && (
              <div className="mt-12 flex flex-col items-center gap-4 rounded-lg border border-dashed border-dusty/50 px-6 py-14 text-center">
                <RoseBud className="h-12 w-8" still />
                <p className="font-display text-xl text-charcoal">{TABS.find((x) => x.id === tab)!.empty}</p>
                {tab === "pending" && (
                  <p className="max-w-md text-ink-soft">
                    רוצים לנסות? פתחו את האתר, הוסיפו את עצמכם לעץ, ולחצו כאן &quot;רענון&quot;.
                  </p>
                )}
                {tab === "pending" && (
                  <a href={kind === "memories" ? "/share" : "/#family"} target="_blank" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-rose px-6 text-white hover:bg-burgundy">
                    {kind === "memories" ? "שיתוף זיכרון" : "הוספת אדם לעץ"}
                  </a>
                )}
              </div>
            )}

            <ul className="mt-8 flex flex-col gap-6">
              <AnimatePresence initial={false}>
                {shown.map((item) => {
                  const m = item as StoredMemory;
                  const p = item as StoredPerson;
                  return (
                    <motion.li key={item.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="rounded-lg bg-white p-6 shadow-[var(--shadow-paper)]">
                      {kind === "family" ? (
                        <div className="flex flex-col gap-2">
                          <span className="font-display text-2xl text-burgundy">
                            {p.name}
                            {p.nameAlt && <span className="ms-2 text-lg text-ink-soft">{p.nameAlt}</span>}
                          </span>
                          <span className="text-charcoal">{describePerson(p)}</span>
                          {(p.born || p.birthplace) && <span className="text-sm text-ink-soft">{[p.born && `נולד/ה ${p.born}`, p.birthplace].filter(Boolean).join(" · ")}</span>}
                          {p.about && <p className="whitespace-pre-wrap font-display text-lg leading-relaxed text-charcoal/90" dir="auto">{p.about}</p>}
                          <span className="text-sm text-ink-soft">נשלח: {fmtDate(p.createdAt)}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="font-display text-2xl text-burgundy">{m.title || "זיכרון"}</span>
                            <span className="text-sm text-ink-soft">{fmtDate(m.createdAt)}</span>
                          </div>
                          <span className="text-charcoal">
                            מאת <b>{m.author}</b>
                            {m.relation ? ` · ${m.relation}` : ""}
                            {m.lang === "ru" ? " · נכתב ברוסית" : ""}
                          </span>
                          {m.body && <p className="mt-1 whitespace-pre-wrap font-display text-lg leading-relaxed text-charcoal/90" dir="auto" lang={m.lang}>{m.body}</p>}
                          {m.people?.length ? <span className="text-sm text-ink-soft">מופיעים בתמונות: {m.people.map((id) => nameOf(id)).join(", ")}</span> : null}
                        </div>
                      )}

                      {item.files.length > 0 && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {item.files.map((f) => (
                            <div key={f.name}>
                              {kind === "memories" && item.status !== "rejected" && (() => {
                                const d = dupOf(m, f);
                                if (!d) return null;
                                return (
                                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-[#f6ead2] px-3 py-2 text-sm text-[#6b4a12]">
                                    <span>
                                      {d.match === "exact" ? "כפילות: התמונה הזו כבר " : "נראית כמו תמונה ש"}
                                      {d.other.status === "approved" ? (d.match === "exact" ? "מופיעה באתר" : "כבר מופיעה באתר") : d.match === "exact" ? "נשלחה ומחכה לאישור" : "כבר נשלחה"}
                                      {` (מאת ${d.other.author})`}
                                    </span>
                                    {item.status === "pending" && item.files.length === 1 && (
                                      <button type="button" disabled={busy} onClick={() => decide(item, "rejected")} className="min-h-9 rounded-full bg-[#6b4a12] px-3 text-white disabled:opacity-50">
                                        הסרת הכפילות
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                              <FilePreview collection={kind} id={item.id} file={f} token={token} onPrints={kind === "memories" ? (p) => savePrints(item.id, f.name, p) : undefined} />
                              {kind === "memories" && item.status !== "rejected" && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => window.confirm("למחוק את הקובץ הזה מהאתר? אי אפשר לבטל.") && act(item.id, { removeFile: f.name }, "הקובץ נמחק.")}
                                  className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-sm text-ink-soft hover:text-burgundy disabled:opacity-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                  מחיקת הקובץ
                                </button>
                              )}
                              {kind === "memories" && (
                                <FileMeta
                                  key={`${f.name}-${f.date?.year ?? ""}-${f.date?.source ?? ""}-${f.category ?? ""}`}
                                  memoryId={item.id}
                                  file={f}
                                  token={token}
                                  onSaved={(msg) => {
                                    setToast(msg);
                                    setTimeout(() => setToast(""), 2600);
                                    load(token);
                                  }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {item.status === "rejected" && item.files.length === 0 && <p className="mt-3 text-sm text-ink-soft">הקבצים של הפריט הזה נמחקו.</p>}

                      <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-4">
                        {item.status !== "approved" && (
                          <button type="button" disabled={busy} onClick={() => decide(item, "approved")} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-rose px-6 text-white hover:bg-burgundy disabled:opacity-50">
                            <Check className="h-4 w-4" aria-hidden />
                            אישור ופרסום באתר
                          </button>
                        )}
                        {item.status !== "rejected" && (
                          <button type="button" disabled={busy} onClick={() => decide(item, "rejected")} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-charcoal/20 px-5 text-charcoal hover:bg-ivory disabled:opacity-50">
                            <X className="h-4 w-4" aria-hidden />
                            {item.status === "approved" ? "הסרה מהאתר" : "לא לפרסם"}
                          </button>
                        )}
                        {item.status === "rejected" && (
                          <button type="button" disabled={busy} onClick={() => decide(item, "pending")} className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-ink-soft hover:text-charcoal disabled:opacity-50">
                            <Undo2 className="h-4 w-4" aria-hidden />
                            החזרה לממתינים
                          </button>
                        )}
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
            </>
            )}
          </>
        )}
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div role="status" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed inset-x-0 bottom-6 z-50 mx-auto w-fit max-w-[90vw] rounded-full bg-charcoal px-6 py-3 text-white shadow-[var(--shadow-lift)]">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
