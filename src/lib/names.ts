/*
  Matching people's names the way a family writes them: in Hebrew or Russian, with or without
  vowel marks, nicknames, small typos. Used by the people search box (to offer every likely match)
  and by the server (so the same person is not added twice under a slightly different spelling).
*/

/** lower case, no vowel marks or accents, one kind of quote, single spaces */
export function normalizeName(s: string) {
  return s
    .normalize("NFD")
    .replace(/[֑-ׇ]/g, "") // Hebrew vowel and cantillation marks
    .replace(/[̀-ͯ]/g, "") // Latin/Cyrillic accents
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[ךםןףץ]/g, (c) => ({ ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" })[c]!)
    .replace(/[׳'"״`’.\-_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// a rough Latin "sound skeleton" of Hebrew and Cyrillic (consonants only, since vowels are
// written so differently), so רוזה, Роза and Rosa meet
const HE: Record<string, string> = { א: "", ב: "b", ג: "g", ד: "d", ה: "", ו: "", ז: "z", ח: "h", ט: "t", י: "", כ: "k", ל: "l", מ: "m", נ: "n", ס: "s", ע: "", פ: "p", צ: "ts", ק: "k", ר: "r", ש: "sh", ת: "t" };
const RU: Record<string, string> = { а: "", б: "b", в: "v", г: "g", д: "d", е: "", ж: "zh", з: "z", и: "", й: "", к: "k", л: "l", м: "m", н: "n", о: "", п: "p", р: "r", с: "s", т: "t", у: "", ф: "p", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "", ь: "", э: "", ю: "", я: "" };
const LATIN_VOWELS = /[aeiouy]/g;

export function nameSkeleton(s: string) {
  return normalizeName(s)
    .split("")
    .map((c) => HE[c] ?? RU[c] ?? c)
    .join("")
    .replace(LATIN_VOWELS, "")
    .replace(/w/g, "v")
    .replace(/f/g, "p")
    .replace(/c/g, "k")
    .replace(/(.)\1+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function distance(a: string, b: string) {
  if (a === b) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

const closeness = (a: string, b: string) => (a && b ? 1 - distance(a, b) / Math.max(a.length, b.length) : 0);

/**
 * How well what was typed matches one of a person's names, 0..1.
 * 1 exact · 0.9 start of the name · 0.85 start of a word in it · 0.8 inside it ·
 * up to 0.75 sounds alike or a small typo.
 */
export function nameScore(query: string, names: string[]) {
  const q = normalizeName(query);
  if (!q) return 0;
  const qs = nameSkeleton(query);
  let best = 0;
  for (const raw of names) {
    const n = normalizeName(raw);
    if (!n) continue;
    if (n === q) return 1;
    if (n.startsWith(q)) best = Math.max(best, 0.9);
    else if (n.split(" ").some((w) => w.startsWith(q))) best = Math.max(best, 0.85);
    else if (q.length >= 2 && n.includes(q)) best = Math.max(best, 0.8);
    const ns = nameSkeleton(raw);
    if (qs.length >= 2 && ns) {
      if (qs === ns) best = Math.max(best, 0.75);
      // compare with the whole name, with each word, and with the name cut to the typed length
      const pieces = [ns, ...ns.split(" "), ...(qs.length >= 3 ? [ns.slice(0, qs.length)] : [])];
      for (const p of pieces) {
        const c = closeness(qs, p);
        if (c >= 0.6) best = Math.max(best, 0.45 + 0.3 * c);
      }
      for (const w of n.split(" ")) {
        const c = closeness(q, w);
        if (c >= 0.6) best = Math.max(best, 0.45 + 0.3 * c);
      }
    }
  }
  return best;
}

/** two written names that are surely the same person (used to avoid adding a duplicate) */
export function sameName(a: string, b: string) {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return false;
  return x === y || (x.replace(/ /g, "") === y.replace(/ /g, ""));
}
