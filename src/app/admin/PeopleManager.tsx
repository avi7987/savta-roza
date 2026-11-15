"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GitMerge, Pencil, Search, Trash2 } from "lucide-react";
import { nameScore } from "@/lib/names";
import { cn } from "@/components/ui";
import { refreshNames } from "@/components/people/PeoplePicker";

type P = { id: string; name: string; nameAlt?: string; inTree: boolean; photo?: string; photos: number; memories: number; thumbs: string[] };

const label = (p: P) => [p.name, p.nameAlt].filter(Boolean).join(" · ");
const usage = (p: P) => (p.photos ? `מתויג ב־${p.photos === 1 ? "תמונה אחת" : `${p.photos} תמונות`}` : p.memories ? `מתויג ב־${p.memories === 1 ? "זיכרון אחד" : `${p.memories} זיכרונות`}` : "עוד לא מתויג באף תמונה");

function Avatar({ p }: { p: P }) {
  return p.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.photo} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
  ) : (
    <span aria-hidden className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[0.9rem]", p.inTree ? "bg-sage/25 text-sage-deep" : "bg-blush/60 text-burgundy")}>
      {p.name.trim().charAt(0)}
    </span>
  );
}

/** a small search for the person to merge into, closest names first */
function MergeInto({ from, people, onPick, onCancel }: { from: P; people: P[]; onPick: (p: P) => void; onCancel: () => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const others = people.filter((p) => p.id !== from.id);
    const query = q.trim() || from.name;
    return others
      .map((p) => ({ p, s: nameScore(query, [p.name, p.nameAlt ?? ""]) }))
      .filter((x) => q.trim() ? x.s >= 0.55 : x.s >= 0.6)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map((x) => x.p);
  }, [people, from, q]);
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-md bg-ivory p-3">
      <p className="text-[0.92rem] text-charcoal">
        עם מי לאחד את <b>{from.name}</b>? כל התיוגים שלו יעברו אליו, ו&quot;{from.name}&quot; יימחק מהמאגר.
      </p>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש שם…" className="w-full rounded-md border border-charcoal/20 bg-white px-3 py-2" />
      {!q.trim() && list.length > 0 && <p className="text-[0.82rem] text-ink-soft">שמות דומים:</p>}
      <ul className="flex flex-col gap-1">
        {list.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onPick(p)} className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-start hover:bg-white">
              <Avatar p={p} />
              <span className="flex flex-col leading-tight">
                <span>{label(p)}</span>
                <span className="text-[0.8rem] text-ink-soft">
                  {p.inTree ? "בעץ המשפחה" : "מאגר השמות"} · {usage(p)}
                </span>
              </span>
            </button>
          </li>
        ))}
        {q.trim() && !list.length && <li className="px-2 text-[0.9rem] text-ink-soft">לא נמצא אף אחד בשם הזה.</li>}
      </ul>
      <button type="button" onClick={onCancel} className="self-start px-2 py-1 text-ink-soft hover:text-charcoal">
        ביטול
      </button>
    </div>
  );
}

/**
 * The owner's list of everyone who is tagged: fix a spelling, merge two entries that are the same
 * person, or remove a name. Every change is carried through all photos and memories at once.
 */
export default function PeopleManager({ token, onDone }: { token: string; onDone: (msg: string) => void }) {
  const [people, setPeople] = useState<P[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [merging, setMerging] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // pairs the owner said are different people, remembered in this browser
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("roza-admin-different") ?? "[]");
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("roza-admin-different", JSON.stringify(dismissed));
    } catch {}
  }, [dismissed]);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/people", { headers: { "x-admin-token": token } }).catch(() => null);
    if (r?.ok) setPeople((await r.json()).people);
    setLoaded(true);
  }, [token]);
  useEffect(() => void load(), [load]);

  const call = async (body: object, ok: string) => {
    setBusy(true);
    const r = await fetch("/api/admin/people", { method: "POST", headers: { "x-admin-token": token, "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (r?.status === 409) {
      const d = await r.json();
      const other = people.find((p) => p.id === d.other);
      onDone(`כבר יש מישהו בשם הזה${other ? ` (${label(other)})` : ""}. אם זה אותו אדם, אפשר לאחד ביניהם.`);
      return false;
    }
    if (!r?.ok) {
      onDone("הפעולה לא הצליחה. נסו שוב.");
      return false;
    }
    const d = await r.json();
    onDone(d.changed ? `${ok} עודכנו ${d.changed === 1 ? "זיכרון אחד" : `${d.changed} זיכרונות`}.` : ok);
    setEditing(null);
    setMerging(null);
    setConfirmDelete(null);
    refreshNames();
    await load();
    return true;
  };

  // pairs that look like the same person, at least one of them from the shared list
  const suspects = useMemo(() => {
    const out: { a: P; b: P; s: number }[] = [];
    const listed = people.filter((p) => !p.inTree);
    for (const a of listed)
      for (const b of people) {
        if (a.id === b.id || (!b.inTree && b.id < a.id)) continue;
        const key = [a.id, b.id].sort().join("|");
        if (dismissed.includes(key)) continue;
        const sc = Math.max(nameScore(a.name, [b.name, b.nameAlt ?? ""]), nameScore(b.name, [a.name]));
        if (sc >= 0.75) out.push({ a, b, s: sc });
      }
    // the likeliest pairs first
    return out.sort((x, y) => y.s - x.s).slice(0, 12);
  }, [people, dismissed]);

  // tree members nobody has tagged yet stay out of the way unless asked for (or searched)
  const hiddenTree = people.filter((p) => p.inTree && !p.photos && !p.memories).length;
  const shown = people
    .filter((p) => !q.trim() || nameScore(q, [p.name, p.nameAlt ?? ""]) >= 0.55)
    .filter((p) => q.trim() || showAll || !p.inTree || p.photos || p.memories)
    .sort((a, b) => Number(a.inTree) - Number(b.inTree) || b.photos - a.photos || a.name.localeCompare(b.name, "he"));

  if (!loaded) return <p className="mt-8 text-ink-soft">טוען…</p>;

  return (
    <div className="mt-8 flex flex-col gap-8">
      <p className="max-w-3xl text-ink-soft">
        כל מי שתויג בתמונות ובזיכרונות. אנשים מעץ המשפחה מסומנים בירוק, ואת השם שלהם משנים דרך עץ המשפחה. שמות מהמאגר (מי שלא בעץ) אפשר לתקן, לאחד או למחוק כאן, וכל
        שינוי מתעדכן מיד בכל התמונות, בזיכרונות ובחיפוש.
      </p>

      {suspects.length > 0 && (
        <section className="rounded-lg bg-blush/25 p-5">
          <h3 className="font-display text-xl text-burgundy">אולי אלה אותו אדם?</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {suspects.map(({ a, b }) => {
              const into = b.inTree || b.photos > a.photos ? b : a;
              const from = into === a ? b : a;
              return (
                <li key={a.id + b.id} className="flex flex-wrap items-center gap-3 rounded-md bg-white p-3">
                  <span className="flex items-center gap-2">
                    <Avatar p={from} /> {label(from)}
                  </span>
                  <span className="text-ink-soft">ו־</span>
                  <span className="flex items-center gap-2">
                    <Avatar p={into} /> {label(into)}
                  </span>
                  <span className="ms-auto flex gap-2">
                    <button type="button" disabled={busy} onClick={() => call({ action: "merge", id: from.id, into: into.id }, `"${from.name}" אוחד עם "${into.name}".`)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-burgundy px-4 text-white disabled:opacity-60">
                      <GitMerge className="h-4 w-4" aria-hidden />
                      איחוד ל&quot;{into.name}&quot;
                    </button>
                    <button type="button" onClick={() => setDismissed((d) => [...d, [a.id, b.id].sort().join("|")])} className="min-h-10 px-3 text-ink-soft hover:text-charcoal">
                      אלה אנשים שונים
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש אדם…" aria-label="חיפוש אדם" className="w-full rounded-md border border-charcoal/20 bg-white py-2.5 pe-3 ps-9" />
      </div>

      <ul className="flex flex-col gap-2">
        {shown.map((p) => (
          <li key={p.id} className={cn("rounded-lg bg-white p-4 shadow-[var(--shadow-paper)]", p.inTree && "bg-white/70")}>
            <div className="flex flex-wrap items-center gap-3">
              <Avatar p={p} />
              <div className="flex min-w-[10rem] flex-1 flex-col leading-tight">
                {editing === p.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (draft.trim() && draft.trim() !== p.name) call({ action: "rename", id: p.id, name: draft }, `השם עודכן ל"${draft.trim()}" בכל האתר.`);
                      else setEditing(null);
                    }}
                    className="flex flex-wrap gap-2"
                  >
                    <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={60} aria-label="שם חדש" className="rounded-md border border-charcoal/20 px-3 py-1.5" />
                    <button type="submit" disabled={busy} className="rounded-full bg-burgundy px-4 py-1.5 text-white disabled:opacity-60">
                      שמירה
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className="px-2 text-ink-soft">
                      ביטול
                    </button>
                  </form>
                ) : (
                  <span className="text-[1.05rem]">{label(p)}</span>
                )}
                <span className="mt-1 text-[0.85rem] text-ink-soft">
                  <span className={cn("me-2 rounded-full px-2 py-0.5 text-[0.75rem]", p.inTree ? "bg-sage/25 text-sage-deep" : "bg-blush/50 text-burgundy")}>{p.inTree ? "עץ המשפחה" : "מאגר השמות"}</span>
                  {usage(p)}
                </span>
              </div>
              {p.thumbs.length > 0 && (
                <div className="flex gap-1">
                  {p.thumbs.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={src} alt="" loading="lazy" className="h-11 w-11 rounded object-cover" />
                  ))}
                </div>
              )}
              {!p.inTree && editing !== p.id && (
                <div className="flex flex-wrap gap-1">
                  <button type="button" onClick={() => (setEditing(p.id), setDraft(p.name), setMerging(null), setConfirmDelete(null))} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-charcoal hover:bg-ivory">
                    <Pencil className="h-4 w-4" aria-hidden /> עריכת שם
                  </button>
                  <button type="button" onClick={() => (setMerging(merging === p.id ? null : p.id), setConfirmDelete(null))} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-charcoal hover:bg-ivory">
                    <GitMerge className="h-4 w-4" aria-hidden /> איחוד עם…
                  </button>
                  <button type="button" onClick={() => (setConfirmDelete(p.id), setMerging(null))} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-burgundy hover:bg-blush/30">
                    <Trash2 className="h-4 w-4" aria-hidden /> מחיקה
                  </button>
                </div>
              )}
            </div>
            {merging === p.id && <MergeInto from={p} people={people} onCancel={() => setMerging(null)} onPick={(into) => call({ action: "merge", id: p.id, into: into.id }, `"${p.name}" אוחד עם "${into.name}".`)} />}
            {confirmDelete === p.id && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md bg-blush/30 p-3">
                <span>
                  למחוק את &quot;{p.name}&quot;? {p.photos || p.memories ? `התיוג שלו יוסר מ${p.photos ? `־${p.photos} תמונות` : `־${p.memories} זיכרונות`}. התמונות עצמן לא יימחקו.` : ""}
                </span>
                <button type="button" disabled={busy} onClick={() => call({ action: "delete", id: p.id }, `"${p.name}" נמחק מהמאגר.`)} className="rounded-full bg-burgundy px-4 py-1.5 text-white disabled:opacity-60">
                  כן, למחוק
                </button>
                <button type="button" onClick={() => setConfirmDelete(null)} className="px-2 text-ink-soft">
                  ביטול
                </button>
              </div>
            )}
          </li>
        ))}
        {!q.trim() && hiddenTree > 0 && (
          <li>
            <button type="button" onClick={() => setShowAll(!showAll)} className="min-h-11 px-2 text-burgundy underline decoration-dusty/50 underline-offset-4">
              {showAll ? "הסתרת מי שעוד לא תויג" : `הצגת עוד ${hiddenTree} אנשים מעץ המשפחה שעוד לא תויגו`}
            </button>
          </li>
        )}
        {!shown.length && <li className="text-ink-soft">אין עדיין אף אחד{q ? " בשם הזה" : ""}.</li>}
      </ul>
    </div>
  );
}
