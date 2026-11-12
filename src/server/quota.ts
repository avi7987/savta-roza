import "server-only";
import { emailOwner, setting } from "./notify";
import { store, storageUsed } from "./store";

const GB = 1024 ** 3;
/** hard stop for new files (default 8 GB, well inside Cloudflare R2's free 10 GB) and an early warning (default 7 GB); both can be changed with STORAGE_CAP_GB / STORAGE_WARN_GB */
async function limits() {
  const num = async (k: string, d: number) => {
    const v = Number(await setting(k));
    return Number.isFinite(v) && v > 0 ? v : d;
  };
  return { cap: (await num("STORAGE_CAP_GB", 8)) * GB, warn: (await num("STORAGE_WARN_GB", 7)) * GB };
}
const DAY = 24 * 60 * 60 * 1000;

const gb = (b: number) => (b / GB).toFixed(2);

/** Send an alert of this kind at most once a day. */
async function alertOnce(kind: "warn" | "full", used: number, cap: number) {
  const last = Number((await store.getMeta(`alert-${kind}`)) ?? 0);
  if (Date.now() - last < DAY) return;
  const subject =
    kind === "full"
      ? `האתר של סבתא רוזה: האחסון הגיע לתקרה (${gb(cap)}GB), העלאת קבצים נעצרה`
      : `האתר של סבתא רוזה: האחסון מתקרב לתקרה (${gb(used)}GB מתוך ${gb(cap)}GB)`;
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6">
    <p>${kind === "full" ? "האחסון של האתר הגיע לתקרה שהגדרנו. זיכרונות בטקסט עדיין מתקבלים, אבל קבצים חדשים (תמונות, סרטונים, הקלטות) נחסמים כדי שלא יהיה חיוב." : `האחסון של האתר מתקרב לתקרה. כשיגיע ל־${gb(cap)}GB, העלאת קבצים תיעצר אוטומטית.`}</p>
    <p><b>בשימוש כרגע:</b> ${gb(used)}GB מתוך ${gb(cap)}GB (החינם ב־Cloudflare הוא 10GB).</p>
    <p>אפשר לפנות מקום בדחיית זיכרונות מיותרים בדף הניהול (הקבצים שלהם נמחקים), או להחליט להגדיל את התקרה.</p>
  </div>`;
  if (await emailOwner(subject, html)) await store.setMeta(`alert-${kind}`, String(Date.now()));
}

/** Before storing files: may these bytes be added? */
export async function canStore(incoming: number) {
  if (incoming === 0) return true;
  const { cap } = await limits();
  const used = await storageUsed();
  if (used + incoming > cap) {
    await alertOnce("full", used, cap);
    return false;
  }
  return true;
}

/** After storing files: warn when the total has crossed the early-warning line. */
export async function afterStore() {
  const { cap, warn } = await limits();
  const used = await storageUsed();
  if (used >= cap) await alertOnce("full", used, cap);
  else if (used >= warn) await alertOnce("warn", used, cap);
}
