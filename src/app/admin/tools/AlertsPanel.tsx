"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { Card } from "./Card";

type State = { email: string; ready: boolean; sent?: boolean };

/** Where the site's alerts (storage nearly full, and the like) are sent. */
export default function AlertsPanel({ token }: { token: string }) {
  const [s, setS] = useState<State | null>(null);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/alerts", { headers: { "x-admin-token": token } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: State | null) => {
        if (!d) return;
        setS(d);
        setEmail(d.email);
      })
      .catch(() => {});
  }, [token]);

  const post = async (body: object) => {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/admin/alerts", { method: "POST", headers: { "x-admin-token": token, "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (!r) return setMsg({ ok: false, text: "אין חיבור. נסו שוב." }), null;
    if (r.status === 422) return setMsg({ ok: false, text: "הכתובת לא נראית תקינה." }), null;
    const d = (await r.json()) as State;
    setS(d);
    return d;
  };

  const save = async () => {
    const d = await post({ email });
    if (d) setMsg({ ok: true, text: email.trim() ? "נשמר. ההתראות יישלחו לכתובת הזו." : "נמחק. לא יישלחו התראות במייל." });
  };
  const test = async () => {
    const d = await post({ email, test: true });
    if (d) setMsg(d.sent ? { ok: true, text: "נשלחה הודעת בדיקה. בדקו את תיבת הדואר (וגם את הספאם)." } : { ok: false, text: "הבדיקה לא נשלחה. ראו את ההסבר למטה." });
  };

  const field = "min-h-11 w-full rounded-md border border-charcoal/20 bg-white px-4 text-left";
  return (
    <Card icon={<Mail className="h-5 w-5" strokeWidth={1.6} aria-hidden />} title="התראות במייל" lead="לאן לשלוח התראה כשהאחסון מתקרב לתקרה, או מתמלא.">
      {!s ? (
        <div className="h-11 animate-pulse rounded-md bg-mount" aria-hidden />
      ) : (
        <>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <input type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" aria-label="כתובת מייל להתראות" className={`${field} sm:max-w-sm`} />
            <button type="submit" disabled={busy} className="min-h-11 rounded-full bg-rose px-6 text-white hover:bg-burgundy disabled:opacity-60">
              לשמור
            </button>
            <button type="button" onClick={test} disabled={busy || !email.trim() || !s.ready} className="min-h-11 rounded-full border border-charcoal/20 px-5 text-burgundy hover:bg-blush/30 disabled:opacity-50">
              לשלוח בדיקה
            </button>
          </form>
          {msg && (
            <p role="status" className={msg.ok ? "mt-2 text-burgundy" : "mt-2 text-burgundy"}>
              {msg.ok ? "✓ " : ""}
              {msg.text}
            </p>
          )}
          <div className="mt-3 rounded-md bg-blush/25 p-3 text-[0.9rem] leading-relaxed text-charcoal">
            {s.ready ? (
              <p>
                שירות המייל מחובר. <b>שימו לב:</b> בלי דומיין משלכם, השירות (Resend, בחינם) שולח רק לכתובת שאיתה נפתח החשבון שלו. אם הבדיקה לא מגיעה, השתמשו בכתובת הזו.
              </p>
            ) : (
              <p>
                <b>שירות המייל עוד לא מחובר,</b> אז כרגע לא יישלחו התראות. כדי לחבר (פעם אחת, בחינם): פותחים חשבון ב־resend.com עם המייל שלכם, יוצרים שם API Key, ומוסיפים אותו ב־Cloudflare כ־Secret בשם RESEND_API_KEY (באותו מקום שבו נמצא ADMIN_TOKEN). אחרי זה כתבו כאן את אותו מייל ולחצו &quot;לשלוח בדיקה&quot;.
              </p>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
