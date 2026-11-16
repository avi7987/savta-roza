"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, FileText, Pencil, Plus, RefreshCw, RotateCcw, Sparkles, X } from "lucide-react";
import { cn } from "@/components/ui";
import type { StoredFact, StoredText } from "@/server/store";

type Data = {
  facts: StoredFact[];
  texts: StoredText[];
  titles: Record<string, { title: string; author: string }>;
  queue: { waiting: number; failed: { id: string; type: string; memoryId: string; error?: string }[]; budget: { background: number; speech: number } };
  ai: boolean;
};

export const CATEGORY_HE: Record<StoredFact["category"], string> = { origin: "שורשים", family: "משפחה", home: "בית", work: "עבודה", events: "אירועים", traits: "אופי", food: "אוכל", other: "אחר" };
const KIND_HE = { memory: "מתוך הזיכרון", note: "ממה שהמשפחה סיפרה על תמונה", ocr: "מתוך מכתב או מסמך", transcript: "מתוך הקלטה", owner: "נכתב על ידי מנהל האתר" } as const;
const TABS = [
  ["pending", "הצעות לבדיקה"],
  ["approved", "מאומת"],
  ["rejected", "נדחו"],
] as const;

function FactForm({ fact, onSave, onCancel, busy }: { fact?: StoredFact; onSave: (v: Record<string, unknown>) => void; onCancel: () => void; busy: boolean }) {
  const [v, setV] = useState({ statement: fact?.statement ?? "", statementRu: fact?.statementRu ?? "", year: fact?.year ? String(fact.year) : "", place: fact?.place ?? "", category: fact?.category ?? "other" });
  const field = "w-full rounded-md border border-charcoal/20 bg-white px-3 py-2";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...v, year: Number(v.year) || undefined });
      }}
      className="mt-3 grid gap-3 rounded-md bg-ivory p-4 sm:grid-cols-2"
    >
      <label className="flex flex-col gap-1 sm:col-span-2">
        העובדה, בעברית
        <input value={v.statement} onChange={(e) => setV({ ...v, statement: e.target.value })} required maxLength={300} className={field} placeholder="למשל: רוזה נולדה בקייב" />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        ברוסית (לא חובה)
        <input value={v.statementRu} onChange={(e) => setV({ ...v, statementRu: e.target.value })} maxLength={300} dir="auto" className={field} />
      </label>
      <label className="flex flex-col gap-1">
        שנה (אם ידועה)
        <input value={v.year} onChange={(e) => setV({ ...v, year: e.target.value.replace(/\D/g, "").slice(0, 4) })} inputMode="numeric" className={field} />
      </label>
      <label className="flex flex-col gap-1">
        מקום (אם ידוע)
        <input value={v.place} onChange={(e) => setV({ ...v, place: e.target.value })} maxLength={80} className={field} />
      </label>
      <fieldset className="flex flex-col gap-1 sm:col-span-2">
        <legend className="mb-1">נושא</legend>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CATEGORY_HE) as StoredFact["category"][]).map((c) => (
            <button key={c} type="button" aria-pressed={v.category === c} onClick={() => setV({ ...v, category: c })} className={cn("min-h-9 rounded-full px-3 text-[0.88rem]", v.category === c ? "bg-burgundy text-white" : "border border-charcoal/15 bg-white")}>
              {CATEGORY_HE[c]}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={busy} className="rounded-full bg-burgundy px-5 py-2 text-white disabled:opacity-60">
          שמירה כמאומת
        </button>
        <button type="button" onClick={onCancel} className="px-3 text-ink-soft">
          ביטול
        </button>
      </div>
    </form>
  );
}

/**
 * What the site has learned about Rosa's life. Facts the computer found are suggestions, each with
 * the words it came from; only what the owner verifies is used to write the life story and to
 * answer the family's questions.
 */
/** how Rosa talked: words, pet names and sayings the answers in her voice may use */
function VoiceEditor({ token, onDone }: { token: string; onDone: (msg: string) => void }) {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/admin/voice", { headers: { "x-admin-token": token } })
      .then((r) => (r.ok ? r.json() : { voice: "" }))
      .then((d: { voice?: string }) => {
        setText(d.voice ?? "");
        setSaved(d.voice ?? "");
      })
      .catch(() => {});
  }, [token]);
  const save = async () => {
    setBusy(true);
    const r = await fetch("/api/admin/voice", { method: "POST", headers: { "x-admin-token": token, "Content-Type": "application/json" }, body: JSON.stringify({ voice: text }) }).catch(() => null);
    setBusy(false);
    if (!r?.ok) return onDone("השמירה לא הצליחה, נסו שוב");
    const d = (await r.json()) as { voice: string };
    setText(d.voice);
    setSaved(d.voice);
    onDone("נשמר. התשובות של סבתא ישתמשו בזה מעכשיו");
  };
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-white p-5 shadow-[var(--shadow-paper)]">
      <h3 className="font-display text-[1.35rem] text-burgundy">איך סבתא דיברה</h3>
      <p className="max-w-3xl text-[0.95rem] text-ink-soft">
        בחלק &quot;מה היית רוצה לשאול אותי?&quot; סבתא עונה בגוף ראשון. כתבו כאן מילים, כינויי חיבה וביטויים שהיו שלה, כל אחד בשורה, ואפשר להוסיף הסבר קצר. התשובות ישתמשו בהם מדי פעם, כשזה
        מתאים. העובדות עצמן ימשיכו להגיע רק ממה שהמשפחה שיתפה.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        maxLength={2000}
        dir="auto"
        placeholder={"למשל:\nמותק שלי (כך פנתה לנכדים)\nקושאי, קושאי! (תאכלו!)\nהכול יהיה בסדר, העיקר בריאות"}
        className="w-full rounded-md border border-charcoal/20 bg-white px-3 py-2 leading-relaxed"
      />
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy || text === saved} className="min-h-11 rounded-full bg-burgundy px-5 text-white disabled:opacity-40">
          {busy ? "שומר…" : "שמירה"}
        </button>
        <span className="text-[0.85rem] text-ink-soft">{text.length}/2000</span>
      </div>
    </section>
  );
}

export default function KnowledgeManager({ token, onDone }: { token: string; onDone: (msg: string) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("pending");
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showTexts, setShowTexts] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/knowledge", { headers: { "x-admin-token": token } }).catch(() => null);
    if (r?.ok) setData(await r.json());
  }, [token]);
  useEffect(() => void load(), [load]);

  const call = async (body: object, ok?: string) => {
    setBusy(true);
    const r = await fetch("/api/admin/knowledge", { method: "POST", headers: { "x-admin-token": token, "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (!r?.ok) {
      onDone("הפעולה לא הצליחה. נסו שוב.");
      return null;
    }
    const d = await r.json();
    if (ok) onDone(ok);
    setEditing(null);
    setAdding(false);
    await load();
    return d;
  };

  if (!data) return <p className="mt-8 text-ink-soft">טוען…</p>;
  const facts = data.facts.filter((f) => f.status === tab).sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
  const count = (s: string) => data.facts.filter((f) => f.status === s).length;

  return (
    <div className="mt-8 flex flex-col gap-8">
      <p className="max-w-3xl text-ink-soft">
        מכל מה שהמשפחה משתפת, המחשב קורא מכתבים ומתכונים מצולמים, כותב את מה שנאמר בהקלטות, ומחפש עובדות על החיים של רוזה. כל עובדה מגיעה עם המילים המדויקות שמהן נלקחה, והיא נשארת
        &quot;הצעה&quot; עד שאתם מאשרים אותה. רק עובדות מאומתות משמשות לכתיבת סיפור החיים ולתשובות על שאלות.
      </p>

      <VoiceEditor token={token} onDone={onDone} />

      <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg bg-white p-5 shadow-[var(--shadow-paper)]">
        <span className="flex items-center gap-2">
          <Sparkles className={cn("h-5 w-5", data.ai ? "text-sage-deep" : "text-ink-soft")} aria-hidden />
          {data.ai ? "הבינה המלאכותית זמינה" : "הבינה המלאכותית לא זמינה כאן (היא פועלת באתר ב־Cloudflare)"}
        </span>
        <span className="text-ink-soft">
          ממתינים לעיבוד: <b className="text-charcoal">{data.queue.waiting}</b>
        </span>
        <span className="text-ink-soft">נשאר להיום: {Math.max(0, data.queue.budget.background)} קריאות, {Math.max(0, data.queue.budget.speech)} תמלולים</span>
        <span className="ms-auto flex flex-wrap gap-2">
          <button type="button" disabled={busy || !data.ai || !data.queue.waiting} onClick={() => call({ action: "process" }, "העיבוד רץ. מה שלא הספיק ימשיך בפעם הבאה.")} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-burgundy px-4 text-white disabled:opacity-50">
            <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} aria-hidden /> לעבד עכשיו
          </button>
          <button type="button" disabled={busy} onClick={() => call({ action: "backfill" }, "כל מה שכבר באתר נכנס לתור. הוא יעובד בהדרגה, קצת כל יום.")} className="min-h-10 rounded-full border border-charcoal/20 bg-white px-4">
            לעבור על כל מה שכבר באתר
          </button>
          {data.queue.failed.length > 0 && (
            <button type="button" disabled={busy} onClick={() => call({ action: "retry" }, "ננסה שוב.")} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-charcoal/20 bg-white px-4">
              <RotateCcw className="h-4 w-4" aria-hidden /> לנסות שוב ({data.queue.failed.length})
            </button>
          )}
        </span>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="flex gap-1 border-b border-line">
          {TABS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("min-h-11 border-b-2 px-4", tab === k ? "border-burgundy text-burgundy" : "border-transparent text-ink-soft")}>
              {l} <span className="tabular-nums text-[0.85rem] opacity-70">{count(k)}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => (setAdding(!adding), setEditing(null))} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-dashed border-burgundy/40 px-4 text-burgundy">
          <Plus className="h-4 w-4" aria-hidden /> הוספת עובדה
        </button>
      </div>

      {adding && <FactForm busy={busy} onCancel={() => setAdding(false)} onSave={(v) => call({ action: "add", ...v }, "העובדה נוספה כמאומתת.")} />}

      <ul className="flex flex-col gap-3">
        {facts.map((f) => (
          <li key={f.id} className="rounded-lg bg-white p-4 shadow-[var(--shadow-paper)]">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
                <p className="text-[1.05rem]">{f.statement}</p>
                {f.statementRu && (
                  <p dir="auto" className="text-[0.9rem] text-ink-soft">
                    {f.statementRu}
                  </p>
                )}
                <p className="mt-1 flex flex-wrap gap-1.5 text-[0.78rem]">
                  <span className="rounded-full bg-blush/50 px-2 py-0.5 text-burgundy">{CATEGORY_HE[f.category]}</span>
                  {f.year && <span className="rounded-full bg-ivory px-2 py-0.5 tabular-nums">{f.year}</span>}
                  {f.place && <span className="rounded-full bg-ivory px-2 py-0.5">{f.place}</span>}
                  <span className="rounded-full bg-ivory px-2 py-0.5 text-ink-soft">{f.by === "ai" ? "נמצא על ידי המחשב" : "נכתב ידנית"}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {f.status !== "approved" && (
                  <button type="button" disabled={busy} onClick={() => call({ action: "verify", id: f.id }, "אומת.")} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-sage-deep px-4 text-white">
                    <Check className="h-4 w-4" aria-hidden /> נכון
                  </button>
                )}
                <button type="button" onClick={() => (setEditing(editing === f.id ? null : f.id), setAdding(false))} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 hover:bg-ivory">
                  <Pencil className="h-4 w-4" aria-hidden /> תיקון
                </button>
                {f.status !== "rejected" && (
                  <button type="button" disabled={busy} onClick={() => call({ action: "reject", id: f.id }, "נדחה.")} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-burgundy hover:bg-blush/30">
                    <X className="h-4 w-4" aria-hidden /> לא נכון
                  </button>
                )}
                {f.status !== "pending" && (
                  <button type="button" disabled={busy} onClick={() => call({ action: "suggest", id: f.id })} className="min-h-10 rounded-full px-3 text-ink-soft hover:bg-ivory">
                    החזרה להצעות
                  </button>
                )}
              </div>
            </div>
            {f.sources.some((s) => s.kind !== "owner") && (
              <ul className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3 text-[0.88rem]">
                {f.sources
                  .filter((s) => s.kind !== "owner")
                  .map((s, i) => (
                    <li key={i} className="flex flex-col gap-0.5">
                      {s.quote && <q className="text-charcoal/90">{s.quote}</q>}
                      <span className="text-ink-soft">
                        {KIND_HE[s.kind]} ·{" "}
                        <a href={`/#m-${s.memoryId}`} target="_blank" rel="noreferrer" className="text-burgundy underline decoration-dusty/50 underline-offset-4">
                          {data.titles[s.memoryId]?.title || "זיכרון"}
                        </a>
                        {data.titles[s.memoryId]?.author ? ` · ${data.titles[s.memoryId].author}` : ""}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
            {editing === f.id && <FactForm fact={f} busy={busy} onCancel={() => setEditing(null)} onSave={(v) => call({ action: "edit", id: f.id, ...v }, "תוקן ואומת.")} />}
          </li>
        ))}
        {!facts.length && <li className="text-ink-soft">{tab === "pending" ? "אין כרגע הצעות לבדיקה." : tab === "approved" ? "עוד אין עובדות מאומתות." : "לא נדחה שום דבר."}</li>}
      </ul>

      {data.texts.length > 0 && (
        <section className="flex flex-col gap-3">
          <button type="button" onClick={() => setShowTexts(!showTexts)} aria-expanded={showTexts} className="inline-flex w-fit items-center gap-2 text-burgundy">
            <FileText className="h-4 w-4" aria-hidden />
            מה נקרא מהקבצים ({data.texts.length})
          </button>
          {showTexts && (
            <ul className="flex flex-col gap-3">
              {data.texts.map((t) => (
                <li key={t.id} className="rounded-lg bg-white p-4 shadow-[var(--shadow-paper)]">
                  <p className="mb-2 text-[0.85rem] text-ink-soft">
                    {t.source === "ocr" ? "הטקסט במכתב / במסמך" : "תמלול ההקלטה"} ·{" "}
                    <a href={`/#m-${t.memoryId}`} target="_blank" rel="noreferrer" className="text-burgundy underline decoration-dusty/50 underline-offset-4">
                      {data.titles[t.memoryId]?.title || "זיכרון"}
                    </a>{" "}
                    · נעשה במחשב, ייתכנו טעויות
                  </p>
                  <p dir="auto" className="whitespace-pre-line text-[0.95rem] leading-relaxed">
                    {t.text}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
