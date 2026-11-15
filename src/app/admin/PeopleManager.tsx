"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GitMerge, Pencil, Search, Trash2 } from "lucide-react";
import { nameScore } from "@/lib/names";
import { cn } from "@/components/ui";
import { refreshNames } from "@/components/people/PeoplePicker";
import { ui } from "@/i18n/ui";
import type { RelKey } from "@/lib/family";

type Tree = { relation: RelKey; parentId?: string; partnerId?: string; editable: boolean; movable: boolean; deletable: boolean; blockers: string[] };
type P = { id: string; name: string; nameAlt?: string; gender?: "f" | "m" | "x"; born?: string; died?: string; birthplace?: string; inTree: boolean; photo?: string; photos: number; memories: number; thumbs: string[]; tree?: Tree };
const REL = ui.he.family.rel;
const relOf = (p: P) => (p.tree ? REL[p.tree.relation][p.gender ?? "x"] : "");

/** where someone can be put in the tree, as seen from Rosa */
const PLACES = [
  ["child", "בן / בת של רוזה"],
  ["grandchild", "נכד / נכדה"],
  ["great", "נין / נינה"],
  ["partner", "בן / בת זוג של…"],
  ["sibling", "אח / אחות של רוזה"],
] as const;
type PlaceKind = (typeof PLACES)[number][0];
const currentPlace = (r?: RelKey): PlaceKind | "" => (r === "child" || r === "grandchild" || r === "great" || r === "sibling" ? r : r === "partner" || r === "childInLaw" ? "partner" : "");

const ERRORS: Record<string, string> = {
  parent: "צריך לבחור הורה מתאים מהרשימה.",
  partner: "צריך לבחור עם מי.",
  cycle: "אי אפשר לשים מישהו מתחת לצאצא של עצמו.",
  slots: "אי אפשר להעביר: אחרים בעץ תלויים בהורה שנוצר יחד איתו",
  dependents: "לפני שמוחקים, צריך להעביר או למחוק את מי שתלוי בו בעץ",
  name: "צריך שם.",
  fixed: "את האדם הזה אי אפשר למחוק.",
};

/** fix a tree person's details and, when it came in as a request, their place in the tree */
function TreeEdit({ p, people, busy, onSave, onCancel }: { p: P; people: P[]; busy: boolean; onSave: (details: object, place?: object) => void; onCancel: () => void }) {
  const [f, setF] = useState({ name: p.name, nameAlt: p.nameAlt ?? "", gender: p.gender ?? "x", born: p.born ?? "", died: p.died ?? "", birthplace: p.birthplace ?? "" });
  const was = currentPlace(p.tree?.relation);
  const [kind, setKind] = useState<PlaceKind | "">(was);
  const [target, setTarget] = useState((was === "partner" ? p.tree?.partnerId : p.tree?.parentId) ?? "");
  const tree = people.filter((x) => x.inTree && x.id !== p.id && x.tree);
  const options =
    kind === "grandchild" ? tree.filter((x) => x.tree!.relation === "child") : kind === "great" ? tree.filter((x) => x.tree!.relation === "grandchild" || x.tree!.relation === "great") : kind === "partner" ? tree.filter((x) => x.tree!.relation !== "parent") : [];
  const needsTarget = kind === "grandchild" || kind === "great" || kind === "partner";
  const placeChanged = !!p.tree?.movable && !!kind && (kind !== was || (needsTarget && target !== ((was === "partner" ? p.tree?.partnerId : p.tree?.parentId) ?? "")));
  const field = "w-full rounded-md border border-charcoal/20 bg-white px-3 py-2";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(f, placeChanged ? { kind, parentId: kind !== "partner" ? target : undefined, partnerOf: kind === "partner" ? target : undefined } : undefined);
      }}
      className="mt-3 grid gap-4 rounded-md bg-ivory p-4 sm:grid-cols-2"
    >
      <label className="flex flex-col gap-1">
        שם
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} required className={field} />
      </label>
      <label className="flex flex-col gap-1">
        שם ברוסית (לא חובה)
        <input value={f.nameAlt} onChange={(e) => setF({ ...f, nameAlt: e.target.value })} maxLength={80} dir="auto" className={field} />
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend>מין</legend>
        <div className="flex gap-2">
          {(
            [
              ["f", "אישה"],
              ["m", "גבר"],
              ["x", "לא לציין"],
            ] as const
          ).map(([g, l]) => (
            <button key={g} type="button" aria-pressed={f.gender === g} onClick={() => setF({ ...f, gender: g })} className={cn("min-h-10 rounded-full px-4", f.gender === g ? "bg-burgundy text-white" : "border border-charcoal/20 bg-white")}>
              {l}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          שנת לידה
          <input value={f.born} onChange={(e) => setF({ ...f, born: e.target.value })} maxLength={20} inputMode="numeric" className={field} />
        </label>
        <label className="flex flex-col gap-1">
          שנת פטירה
          <input value={f.died} onChange={(e) => setF({ ...f, died: e.target.value })} maxLength={20} inputMode="numeric" className={field} />
        </label>
        <label className="flex flex-col gap-1 col-span-2">
          מקום לידה
          <input value={f.birthplace} onChange={(e) => setF({ ...f, birthplace: e.target.value })} maxLength={80} className={field} />
        </label>
      </div>

      {p.tree?.movable ? (
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-1">המקום בעץ</legend>
          <div className="flex flex-wrap gap-2">
            {PLACES.map(([k, l]) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => (setKind(k), setTarget(""))} className={cn("min-h-10 rounded-full px-4", kind === k ? "bg-burgundy text-white" : "border border-charcoal/20 bg-white")}>
                {l}
              </button>
            ))}
          </div>
          {needsTarget && (
            <label className="mt-1 flex max-w-sm flex-col gap-1">
              {kind === "partner" ? "בן/בת הזוג של:" : kind === "grandchild" ? "הילד/ה של (מילדיה של רוזה):" : "הילד/ה של (מהנכדים):"}
              <select value={target} onChange={(e) => setTarget(e.target.value)} required className={field}>
                <option value="">בחירה…</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {label(o)} ({relOf(o)})
                  </option>
                ))}
              </select>
              {!options.length && <span className="text-[0.85rem] text-burgundy">אין עדיין בעץ מישהו מתאים. אפשר קודם להוסיף אותו דרך עץ המשפחה באתר.</span>}
            </label>
          )}
        </fieldset>
      ) : (
        <p className="text-[0.88rem] text-ink-soft sm:col-span-2">את המקום של {p.name} בעץ אי אפשר להזיז מכאן (הוא חלק מהמבנה הבסיסי של העץ), אבל אפשר לתקן את הפרטים.</p>
      )}

      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={busy || (needsTarget && placeChanged && !target)} className="rounded-full bg-burgundy px-5 py-2 text-white disabled:opacity-60">
          שמירה
        </button>
        <button type="button" onClick={onCancel} className="px-3 text-ink-soft">
          ביטול
        </button>
      </div>
    </form>
  );
}

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
    if (r?.status === 422) {
      const d = await r.json().catch(() => ({}));
      onDone(`${ERRORS[d.error] ?? "הפעולה לא הצליחה."}${d.names?.length ? `: ${d.names.join(", ")}` : ""}`);
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
        כל האנשים באתר: מי שבעץ המשפחה (בירוק) ומי שתויג בתמונות בלי להיות בעץ (בוורוד). אנשים בעץ אפשר לערוך, להעביר למקום הנכון בעץ או להסיר ממנו. שמות
        מהמאגר אפשר לתקן, לאחד או למחוק. כל שינוי מתעדכן מיד בעץ, בתמונות, בזיכרונות ובחיפוש.
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
                {editing === p.id && !p.inTree ? (
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
                  <span className={cn("me-2 rounded-full px-2 py-0.5 text-[0.75rem]", p.inTree ? "bg-sage/25 text-sage-deep" : "bg-blush/50 text-burgundy")}>{p.inTree ? `עץ המשפחה${relOf(p) ? ` · ${relOf(p)}` : ""}` : "מאגר השמות"}</span>
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
              {p.inTree && p.tree && editing !== p.id && (
                <div className="flex flex-wrap gap-1">
                  <button type="button" onClick={() => (setEditing(p.id), setMerging(null), setConfirmDelete(null))} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-charcoal hover:bg-ivory">
                    <Pencil className="h-4 w-4" aria-hidden /> עריכה
                  </button>
                  {p.tree.deletable && (
                    <button type="button" onClick={() => (setConfirmDelete(p.id), setMerging(null))} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-burgundy hover:bg-blush/30">
                      <Trash2 className="h-4 w-4" aria-hidden /> הסרה מהעץ
                    </button>
                  )}
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
            {editing === p.id && p.inTree && (
              <TreeEdit p={p} people={people} busy={busy} onCancel={() => setEditing(null)} onSave={(details, place) => call({ action: "editTree", id: p.id, details, place }, place ? `${p.name} הועבר/ה למקום החדש בעץ.` : `הפרטים של ${p.name} עודכנו.`)} />
            )}
            {merging === p.id && <MergeInto from={p} people={people} onCancel={() => setMerging(null)} onPick={(into) => call({ action: "merge", id: p.id, into: into.id }, `"${p.name}" אוחד עם "${into.name}".`)} />}
            {confirmDelete === p.id && p.inTree && p.tree && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md bg-blush/30 p-3">
                {p.tree.blockers.length ? (
                  <span>
                    אי אפשר להסיר את {p.name} עדיין: {p.tree.blockers.join(", ")} תלויים בו/בה בעץ. קודם צריך להעביר אותם למקום אחר (בעריכה) או להסיר אותם.
                  </span>
                ) : (
                  <>
                    <span>
                      להסיר את {p.name} מעץ המשפחה? {p.photos || p.memories ? "התיוג שלו/ה יוסר מהתמונות. התמונות עצמן לא יימחקו." : ""}
                    </span>
                    <button type="button" disabled={busy} onClick={() => call({ action: "deleteTree", id: p.id }, `${p.name} הוסר/ה מהעץ.`)} className="rounded-full bg-burgundy px-4 py-1.5 text-white disabled:opacity-60">
                      כן, להסיר
                    </button>
                  </>
                )}
                <button type="button" onClick={() => setConfirmDelete(null)} className="px-2 text-ink-soft">
                  ביטול
                </button>
              </div>
            )}
            {confirmDelete === p.id && !p.inTree && (
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
