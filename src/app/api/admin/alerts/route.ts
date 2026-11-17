import { NextResponse } from "next/server";
import { isAdmin } from "@/server/auth";
import { alertEmail, emailOwner, setting } from "@/server/notify";
import { store } from "@/server/store";

export const runtime = "nodejs";

const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "Cache-Control": "no-store" } });
const valid = (e: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(e) && e.length <= 200;

/** where alerts go, and whether sending email is set up at all (never the key itself) */
async function state() {
  return { email: (await alertEmail()) ?? (await setting("ALERT_EMAIL")) ?? "", ready: !!(await setting("RESEND_API_KEY")) };
}

export async function GET(req: Request) {
  if (!(await isAdmin(req))) return json({ error: "unauthorized" }, 401);
  return json(await state());
}

/** { email } saves the address; { test: true } sends a test message to it */
export async function POST(req: Request) {
  if (!(await isAdmin(req))) return json({ error: "unauthorized" }, 401);
  const b = (await req.json().catch(() => ({}))) as { email?: unknown; test?: unknown };
  if (typeof b.email === "string") {
    const e = b.email.trim();
    if (e && !valid(e)) return json({ error: "email" }, 422);
    await store.setMeta("alert-email", e);
  }
  if (b.test === true) {
    const ok = await emailOwner(
      "בדיקה: התראות מהאתר של סבתא רוזה",
      `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6"><p>זו הודעת בדיקה מדף הניהול. אם היא הגיעה, ההתראות מהאתר יגיעו לכתובת הזו.</p></div>`
    );
    return json({ ...(await state()), sent: ok });
  }
  return json(await state());
}
