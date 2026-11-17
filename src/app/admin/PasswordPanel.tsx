"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { cn } from "@/components/ui";

const MIN = 6;

/** The owner chooses their own admin password. The one in Cloudflare's settings keeps working as a way back in. */
export default function PasswordPanel({ token, onChanged }: { token: string; onChanged: (pw: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "short" | "differ" | "space" | "failed">("idle");

  const save = async () => {
    if (pw.length < MIN) return setState("short");
    if (pw.trim() !== pw) return setState("space");
    if (pw !== again) return setState("differ");
    setState("saving");
    const r = await fetch("/api/admin/password", { method: "POST", headers: { "x-admin-token": token, "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) }).catch(() => null);
    if (!r?.ok) return setState("failed");
    setState("idle");
    setOpen(false);
    setPw("");
    setAgain("");
    onChanged(pw);
  };

  const field = "w-full rounded-md border border-charcoal/20 bg-white px-4 py-3 text-left aria-[invalid=true]:border-burgundy";
  const msg = { short: `לפחות ${MIN} תווים`, space: "בלי רווחים בהתחלה או בסוף", differ: "שתי הסיסמאות לא זהות", failed: "השמירה לא הצליחה. נסו שוב." } as Record<string, string>;

  return (
    <section className="mt-6 rounded-lg bg-white px-6 py-4 shadow-[var(--shadow-paper)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2.5 text-charcoal">
          <KeyRound className="h-5 w-5 text-rose" strokeWidth={1.6} aria-hidden />
          הסיסמה לדף הניהול
        </span>
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="min-h-11 rounded-full border border-charcoal/20 px-5 text-burgundy hover:bg-blush/30">
          {open ? "ביטול" : "לבחור סיסמה משלכם"}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", visualDuration: 0.35, bounce: 0 }}
            className="overflow-hidden"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <div className="grid gap-3 pb-2 pt-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.95rem]">סיסמה חדשה</span>
                <span className="relative">
                  <input type={show ? "text" : "password"} autoComplete="new-password" dir="ltr" value={pw} onChange={(e) => (setPw(e.target.value), setState("idle"))} aria-invalid={state === "short" || state === "space"} className={cn(field, "pr-11")} />
                  <button type="button" onClick={() => setShow((x) => !x)} aria-label={show ? "להסתיר" : "להציג"} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-soft hover:text-burgundy">
                    {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                  </button>
                </span>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.95rem]">שוב, לבדיקה</span>
                <input type={show ? "text" : "password"} autoComplete="new-password" dir="ltr" value={again} onChange={(e) => (setAgain(e.target.value), setState("idle"))} aria-invalid={state === "differ"} className={field} />
              </label>
            </div>
            <p className="text-[0.88rem] leading-relaxed text-ink-soft">
              לפחות {MIN} תווים. אחרי כמה ניסיונות שגויים הכניסה ננעלת לרבע שעה, כך שגם סיסמה קצרה מוגנת. אם תשכחו אותה, הסיסמה שמוגדרת ב־Cloudflare (ADMIN_TOKEN) תמיד ממשיכה לעבוד.
            </p>
            {state in msg && (
              <p role="alert" className="mt-2 text-burgundy">
                {msg[state]}
              </p>
            )}
            <button type="submit" disabled={state === "saving"} className={cn("mb-2 mt-3 min-h-11 rounded-full bg-rose px-6 text-white transition-colors hover:bg-burgundy disabled:opacity-60")}>
              {state === "saving" ? "שומרים…" : "לשמור סיסמה"}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </section>
  );
}
