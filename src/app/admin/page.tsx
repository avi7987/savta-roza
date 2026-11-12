"use client";

import { useCallback, useEffect, useState } from "react";
import type { StoredMemory, StoredPerson, Status } from "@/server/store";

type Kind = "memories" | "family";
const KIND: Record<string, string> = { child: "בן/בת של רוזה", grandchild: "נכד/ה", great: "נין/נינה", partner: "בן/בת זוג", sibling: "אח/ות של רוזה", parent: "הורה של רוזה" };
const describe = (p: StoredPerson) => {
  if (p.replaces) return `השלמה/עדכון של מקום בעץ (${p.replaces})`;
  const parts = [KIND[p.kind ?? ""] ?? ""];
  if (p.parentId) parts.push(`ההורה: ${p.parentId}`);
  if (!p.parentId && (p.kind === "grandchild" || p.kind === "great")) parts.push(`ההורה חדש: ${p.parentName || "ללא שם"}`);
  if (p.kind === "great" && !p.parentId) parts.push(p.grandparentId ? `הסבא/סבתא: ${p.grandparentId}` : `הסבא/סבתא חדש/ה: ${p.grandparentName || "ללא שם"}`);
  if (p.partnerOf) parts.push(`בן/בת הזוג של: ${p.partnerOf}`);
  return parts.join(" · ");
};

/** Moderation for the family: read what was shared, approve it to the site or set it aside. */
export default function AdminPage() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Status>("pending");
  const [kind, setKind] = useState<Kind>("memories");
  const [items, setItems] = useState<(StoredMemory | StoredPerson)[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("roza-admin");
      if (saved) setToken(saved);
    } catch {}
  }, []);

  const load = useCallback(
    async (tk = token, status = tab, k = kind) => {
      setError("");
      const res = await fetch(`/api/admin/memories?status=${status}&kind=${k}`, { headers: { "x-admin-token": tk } });
      if (res.status === 401) {
        setAuthed(false);
        setError("הסיסמה לא נכונה");
        return;
      }
      const data = await res.json();
      setItems(data.memories ?? []);
      setAuthed(true);
      try {
        sessionStorage.setItem("roza-admin", tk);
      } catch {}
    },
    [token, tab, kind]
  );

  const decide = async (id: string, status: Status) => {
    const res = await fetch(`/api/${kind === "family" ? "family" : "memories"}/${id}`, { method: "PATCH", headers: { "x-admin-token": token, "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (res.ok) setItems((all) => all.filter((m) => m.id !== id));
    else setError("הפעולה לא הצליחה, נסו שוב");
  };

  const tabs: { id: Status; label: string }[] = [
    { id: "pending", label: "ממתינים" },
    { id: "approved", label: "פורסמו" },
    { id: "rejected", label: "לא פורסמו" },
  ];

  return (
    <main dir="rtl" lang="he" className="mx-auto min-h-screen max-w-4xl px-5 py-16">
      <h1 className="font-display text-4xl font-light text-burgundy">ניהול זיכרונות</h1>
      <p className="mt-2 text-ink-soft">זיכרונות חדשים מופיעים באתר רק אחרי אישור כאן.</p>

      {!authed ? (
        <form
          className="mt-10 flex max-w-sm flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            load(token);
          }}
        >
          <label htmlFor="tk" className="text-charcoal">
            סיסמת ניהול
          </label>
          <input id="tk" type="password" autoComplete="current-password" value={token} onChange={(e) => setToken(e.target.value)} className="rounded-md border border-charcoal/20 bg-white px-4 py-3" />
          <button type="submit" className="min-h-12 rounded-full bg-rose text-white">
            כניסה
          </button>
          {error && <p role="alert" className="text-burgundy">{error}</p>}
        </form>
      ) : (
        <>
          <div className="mt-10 flex gap-3">
            {(["memories", "family"] as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => {
                  setKind(k);
                  load(token, tab, k);
                }}
                className={`min-h-11 rounded-full px-5 ${kind === k ? "bg-burgundy text-white" : "border border-charcoal/20 text-charcoal"}`}
              >
                {k === "memories" ? "זיכרונות" : "עץ המשפחה"}
              </button>
            ))}
          </div>
          <div role="tablist" className="mt-6 flex gap-2 border-b border-line">
            {tabs.map((tb) => (
              <button
                key={tb.id}
                role="tab"
                aria-selected={tab === tb.id}
                onClick={() => {
                  setTab(tb.id);
                  load(token, tb.id, kind);
                }}
                className={`min-h-11 px-4 ${tab === tb.id ? "border-b-2 border-burgundy text-burgundy" : "text-ink-soft"}`}
              >
                {tb.label}
              </button>
            ))}
          </div>
          {error && <p role="alert" className="mt-4 text-burgundy">{error}</p>}
          {items.length === 0 && <p className="mt-10 text-ink-soft">אין כאן כרגע זיכרונות.</p>}
          <ul className="mt-8 flex flex-col gap-6">
            {items.map((item) => {
              const m = item as StoredMemory;
              const person = item as StoredPerson;
              const collection = kind;
              return (
              <li key={m.id} className="rounded-md bg-white p-6 shadow-[var(--shadow-paper)]">
                {kind === "family" ? (
                  <div className="flex flex-col gap-2">
                    <span className="font-display text-xl text-burgundy">
                      {person.name}
                      {person.nameAlt ? ` · ${person.nameAlt}` : ""}
                    </span>
                    <span className="text-sm text-ink-soft">
                      {describe(person)} · {new Date(person.createdAt).toLocaleString("he-IL")}
                    </span>
                    {(person.born || person.birthplace) && <span className="text-sm">{[person.born, person.birthplace].filter(Boolean).join(" · ")}</span>}
                    {person.about && <p dir="auto" className="whitespace-pre-wrap leading-relaxed">{person.about}</p>}
                  </div>
                ) : (
                <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-xl text-burgundy">{m.title || "ללא כותרת"}</span>
                  <span className="text-sm text-ink-soft">
                    {m.author}
                    {m.relation ? ` · ${m.relation}` : ""} · {new Date(m.createdAt).toLocaleString("he-IL")}
                  </span>
                </div>
                <p lang={m.lang} dir="auto" className="mt-3 whitespace-pre-wrap leading-relaxed text-charcoal">
                  {m.body}
                </p>
                {m.people?.length ? <p className="mt-2 text-sm text-ink-soft">מסומנים: {m.people.join(", ")}</p> : null}
                </>
                )}
                {m.files.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-2 text-sm">
                    {m.files.map((f) => (
                      <li key={f.name}>
                        <button
                          type="button"
                          className="rounded-full border border-line px-3 py-1 text-burgundy"
                          onClick={async () => {
                            const r = await fetch(`/api/files/${collection}/${m.id}/${f.name}`, { headers: { "x-admin-token": token } });
                            if (r.ok) window.open(URL.createObjectURL(await r.blob()), "_blank");
                          }}
                        >
                          {f.kind === "image" ? "תמונה" : f.kind === "video" ? "סרטון" : "הקלטה"} · {(f.size / 1024 / 1024).toFixed(1)}MB
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-5 flex gap-3">
                  {m.status !== "approved" && (
                    <button type="button" onClick={() => decide(m.id, "approved")} className="min-h-11 rounded-full bg-rose px-5 text-white">
                      אישור ופרסום
                    </button>
                  )}
                  {m.status !== "rejected" && (
                    <button type="button" onClick={() => decide(m.id, "rejected")} className="min-h-11 rounded-full border border-charcoal/20 px-5 text-charcoal">
                      לא לפרסם
                    </button>
                  )}
                </div>
              </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
