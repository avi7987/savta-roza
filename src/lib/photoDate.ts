import type { Lang } from "@/content/types";

/**
 * When a photo or video was taken, and how we know it.
 *  user  – the person who uploaded it (or a moderator) said so
 *  exif  – read from the file itself (camera/phone date)
 *  ai    – estimated from the picture (clothes, colours, print style, Rosa's age)
 */
export type DateSource = "user" | "exif" | "ai";

export type PhotoDate = {
  source: DateSource;
  /** exact day, YYYY-MM-DD */
  date?: string;
  year?: number;
  /** a range when only roughly known */
  from?: number;
  to?: number;
  /** a short note on why (for estimates) */
  clues?: string;
};

export const MIN_YEAR = 1880;
export const thisYear = () => new Date().getFullYear();

export const validYear = (y: unknown) => {
  const n = Math.round(Number(y));
  return Number.isFinite(n) && n >= MIN_YEAR && n <= thisYear() ? n : undefined;
};

export const validDate = (d: unknown) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && validYear(d.slice(0, 4)) ? d : undefined);

/** Clean a date that came from a form, a file or a model: keep only sane values. */
export function cleanDate(d: Partial<PhotoDate> | undefined, source: DateSource): PhotoDate | undefined {
  if (!d) return undefined;
  const date = validDate(d.date);
  let year = validYear(d.year) ?? (date ? Number(date.slice(0, 4)) : undefined);
  let from = validYear(d.from);
  let to = validYear(d.to);
  if (from && to && from > to) [from, to] = [to, from];
  if (from && to && to - from > 40) return undefined;
  if (!year && from && to && from === to) year = from;
  if (!date && !year && !(from && to)) return undefined;
  const clues = typeof d.clues === "string" ? d.clues.replace(/\s+/g, " ").trim().slice(0, 180) : undefined;
  return { source, date, year: date || year ? year : undefined, from: year ? undefined : from, to: year ? undefined : to, clues: clues || undefined };
}

/** A single year to sort and group by. */
export function sortYear(d?: PhotoDate) {
  if (!d) return undefined;
  if (d.year) return d.year;
  if (d.from && d.to) return Math.round((d.from + d.to) / 2);
  return undefined;
}

export const decadeOf = (y: number) => Math.floor(y / 10) * 10;

export const isEstimate = (d?: PhotoDate) => !!d && (d.source === "ai" || (!d.year && !d.date));

const MONTHS = {
  he: ["בינואר", "בפברואר", "במרץ", "באפריל", "במאי", "ביוני", "ביולי", "באוגוסט", "בספטמבר", "באוקטובר", "בנובמבר", "בדצמבר"],
  ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
};

export function decadeLabel(decade: number, lang: Lang) {
  const yy = String(decade).slice(2);
  if (lang === "ru") return `${decade}-е`;
  return decade >= 2000 ? `שנות ה־${decade}` : `שנות ה־${yy}`;
}

/** "14 ביולי 1998", "1998", "בערך 1965", "שנות ה־60 בערך", or "" when unknown. */
export function formatDate(d: PhotoDate | undefined, lang: Lang) {
  if (!d) return "";
  const approx = d.source === "ai";
  const about = lang === "he" ? "בערך" : "примерно";
  if (d.date) {
    const [y, m, day] = d.date.split("-").map(Number);
    return lang === "he" ? `${day} ${MONTHS.he[m - 1]} ${y}` : `${day} ${MONTHS.ru[m - 1]} ${y}`;
  }
  if (d.year) return approx ? `${about} ${d.year}` : String(d.year);
  if (d.from && d.to) {
    if (decadeOf(d.from) === decadeOf(d.to) || d.to - d.from <= 10) return `${decadeLabel(decadeOf(Math.round((d.from + d.to) / 2)), lang)}${approx ? ` (${about})` : ""}`;
    return `${d.from}–${d.to}${approx ? ` (${about})` : ""}`;
  }
  return "";
}

export function sourceLabel(d: PhotoDate | undefined, lang: Lang) {
  if (!d) return lang === "he" ? "תאריך לא ידוע" : "дата неизвестна";
  const he = { user: "לפי המשפחה", exif: "לפי הקובץ", ai: "הערכה לפי התמונה" };
  const ru = { user: "со слов семьи", exif: "по данным файла", ai: "оценка по снимку" };
  return (lang === "he" ? he : ru)[d.source];
}
