"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { ArrowRight, Printer } from "lucide-react";
import type { Memory } from "@/content/types";
import { decadeLabel, decadeOf, formatDate } from "@/lib/photoDate";
import type { PhotoDate } from "@/lib/photoDate";
import { isMemory, memKind } from "@/lib/memoryKinds";

/*
  The memory book, laid out for paper: a cover, her life decade by decade (the owner's words, the
  verified facts and a few photos), her words, recipes, stories and letters, photos with a story,
  and a closing page with a code to the site. Chosen and previewed here, then saved as a PDF with
  the browser's own "print". Nothing leaves the browser; it costs nothing.
*/

type Photo = { id: string; kind: string; full: string; src: string; year?: number; date?: PhotoDate; caption?: string; story?: string; contributor: string; ratio: number };
type Fact = { id: string; statement: string; year?: number; place?: string };
type Notes = Record<string, { title?: string; text?: string }>;
type Parts = { cover: boolean; story: boolean; words: boolean; recipes: boolean; stories: boolean; photos: boolean; end: boolean };

const PARTS: [keyof Parts, string][] = [
  ["cover", "כריכה"],
  ["story", "סיפור החיים לפי עשורים"],
  ["words", "המילים שלה"],
  ["recipes", "מתכונים"],
  ["stories", "סיפורים ומכתבים"],
  ["photos", "תמונות עם סיפור"],
  ["end", "עמוד סיום עם קוד לאתר"],
];

export default function BookPage() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [mem, setMem] = useState<Memory[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [notes, setNotes] = useState<Notes>({});
  const [parts, setParts] = useState<Parts>({ cover: true, story: true, words: true, recipes: true, stories: true, photos: true, end: true });
  const [perDecade, setPerDecade] = useState(4);
  const [qr, setQr] = useState("");
  const [loaded, setLoaded] = useState(false);
  const site = typeof window === "undefined" ? "" : location.origin.replace("//redesign-", "//");

  const [pw, setPw] = useState("");
  const [wrong, setWrong] = useState(false);
  // the owner only: signed in on the admin page in this tab, or here with the same password
  const check = async (tk: string) => {
    const r = await fetch("/api/admin/storage", { headers: { "x-admin-token": tk } }).catch(() => null);
    if (r?.ok)
      try {
        sessionStorage.setItem("roza-admin", tk);
      } catch {}
    return !!r?.ok;
  };
  useEffect(() => {
    let tk = "";
    try {
      tk = sessionStorage.getItem("roza-admin") ?? "";
    } catch {}
    if (!tk) return setOk(false);
    check(tk).then(setOk);
  }, []);

  useEffect(() => {
    if (!ok) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const get = (u: string): Promise<any> => fetch(u).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    Promise.all([get("/api/memories"), get("/api/photos"), get("/api/facts"), get("/api/story")]).then(([m, p, f, s]) => {
      setMem(((m.memories ?? []) as Memory[]).filter(isMemory));
      setPhotos(((p.photos ?? []) as Photo[]).filter((x) => x.kind === "image"));
      setFacts(f.facts ?? []);
      setNotes(s.decades ?? {});
      setLoaded(true);
    });
    QRCode.toDataURL(site, { width: 600, margin: 1, color: { dark: "#5e2338", light: "#ffffff" } }).then(setQr).catch(() => {});
  }, [ok, site]);

  const decades = useMemo(() => {
    const ds = new Set<number>();
    photos.forEach((p) => p.year && ds.add(decadeOf(p.year)));
    facts.forEach((f) => f.year && ds.add(decadeOf(f.year)));
    Object.entries(notes).forEach(([k, n]) => (n.title || n.text) && ds.add(Number(k)));
    return [...ds].sort((a, b) => a - b).map((d) => ({
      d,
      note: notes[String(d)],
      facts: facts.filter((f) => f.year && decadeOf(f.year) === d).sort((a, b) => (a.year ?? 0) - (b.year ?? 0)),
      // the photos the family wrote something about come first
      photos: photos
        .filter((p) => p.year && decadeOf(p.year) === d)
        .sort((a, b) => Number(!!(b.caption || b.story)) - Number(!!(a.caption || a.story)) || (a.year ?? 0) - (b.year ?? 0))
        .slice(0, perDecade),
    }));
  }, [photos, facts, notes, perDecade]);
  const by = (k: string) => mem.filter((m) => memKind(m) === k);
  const today = new Date().toLocaleDateString("he-IL", { month: "long", year: "numeric" });

  if (ok === null) return <main className="p-10 text-ink-soft">טוען…</main>;
  if (!ok)
    return (
      <main className="mx-auto max-w-sm p-10">
        <form
          className="flex flex-col gap-3 rounded-lg bg-white p-6 shadow-[var(--shadow-paper)]"
          onSubmit={async (e) => {
            e.preventDefault();
            const good = await check(pw.trim());
            setWrong(!good);
            if (good) setOk(true);
          }}
        >
          <h1 className="font-display text-2xl text-burgundy">ספר הזיכרונות</h1>
          <label htmlFor="bk" className="text-ink-soft">
            סיסמת ניהול
          </label>
          <input id="bk" type="password" autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} className="rounded-md border border-charcoal/20 bg-white px-4 py-3" />
          <button type="submit" disabled={!pw} className="min-h-12 rounded-full bg-rose text-white hover:bg-burgundy disabled:opacity-50">
            כניסה
          </button>
          {wrong && <p role="alert" className="text-burgundy">הסיסמה לא נכונה.</p>}
          <a href="/admin" className="text-center text-[0.92rem] text-ink-soft underline">
            חזרה לדף הניהול
          </a>
        </form>
      </main>
    );

  return (
    <div className="book-root min-h-screen bg-[#ece6e1] print:bg-white">
      <style>{`
        @page { size: A4; margin: 16mm 15mm 18mm; }
        @media print {
          .no-print { display: none !important; }
          .sheet { box-shadow: none !important; margin: 0 !important; width: auto !important; min-height: 0 !important; padding: 0 !important; }
          html, body { background: #fff !important; }
          body::before { display: none !important; }
        }
        .sheet { break-after: page; }
        .sheet:last-child { break-after: auto; }
        .keep { break-inside: avoid; }
      `}</style>

      {/* the choices, on screen only */}
      <aside className="no-print sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3">
          <a href="/admin" className="inline-flex min-h-10 items-center gap-1.5 text-ink-soft hover:text-burgundy">
            <ArrowRight className="h-4 w-4" aria-hidden />
            לדף הניהול
          </a>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {PARTS.map(([k, label]) => (
              <label key={k} className="inline-flex min-h-9 items-center gap-1.5 text-[0.92rem]">
                <input type="checkbox" checked={parts[k]} onChange={(e) => setParts((p) => ({ ...p, [k]: e.target.checked }))} className="accent-[#b5566f]" />
                {label}
              </label>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 text-[0.92rem]">
            תמונות לכל עשור
            <select value={perDecade} onChange={(e) => setPerDecade(Number(e.target.value))} className="min-h-9 rounded-md border border-charcoal/20 bg-white px-2">
              {[0, 2, 4, 6, 9].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => window.print()} disabled={!loaded} className="ms-auto inline-flex min-h-11 items-center gap-2 rounded-full bg-rose px-6 text-white hover:bg-burgundy disabled:opacity-50">
            <Printer className="h-4 w-4" aria-hidden />
            {loaded ? "לשמור כ־PDF" : "אוספים את התוכן…"}
          </button>
        </div>
        <p className="mx-auto max-w-5xl px-5 pb-3 text-[0.85rem] text-ink-soft">
          בחלון ההדפסה בחרו &quot;שמירה כ־PDF&quot; (Save as PDF), גודל A4, וסמנו &quot;גרפיקת רקע&quot; (Background graphics). הכי טוב ב־Chrome במחשב.
        </p>
      </aside>

      <div className="mx-auto flex max-w-[210mm] flex-col items-center gap-8 py-8 print:block print:py-0">
        {parts.cover && (
          <Sheet>
            <div className="flex min-h-[250mm] flex-col items-center justify-center gap-6 text-center print:min-h-[255mm]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/rosa-portrait.webp" alt="" className="w-[95mm] max-w-full" />
              <h1 className="font-display text-[44pt] font-medium leading-none text-burgundy">סבתא רוזה</h1>
              <p className="text-[15pt] text-ink-soft">ספר הזיכרונות של המשפחה</p>
              <p className="mt-10 text-[10pt] text-ink-soft">{today}</p>
            </div>
          </Sheet>
        )}

        {parts.story && decades.length > 0 && (
          <Sheet>
            <Title>סיפור החיים</Title>
            {decades.map(({ d, note, facts: fs, photos: ps }) => (
              <section key={d} className="mt-8 first-of-type:mt-4">
                <div className="keep flex items-end gap-4 border-b border-dashed border-[#d9c3c9] pb-2">
                  <span className="font-display text-[30pt] leading-[0.8] text-[#a87482]">{d}</span>
                  <h3 className="font-display text-[15pt] text-burgundy">{note?.title || decadeLabel(d, "he")}</h3>
                </div>
                {note?.text && <p className="keep mt-3 whitespace-pre-line text-[11pt] leading-[1.75]">{note.text}</p>}
                {fs.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1 text-[10.5pt] leading-relaxed">
                    {fs.map((f) => (
                      <li key={f.id} className="keep">
                        {f.year && <b className="text-burgundy">{f.year} · </b>}
                        {f.statement}
                      </li>
                    ))}
                  </ul>
                )}
                {ps.length > 0 && (
                  <div className={`mt-4 grid gap-3 ${ps.length === 1 ? "grid-cols-1" : ps.length === 2 || ps.length === 4 ? "grid-cols-2" : "grid-cols-3"}`}>
                    {ps.map((p) => (
                      <figure key={p.id} className="keep">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.full} alt="" className="max-h-[70mm] w-full rounded-[3mm] object-cover" />
                        <figcaption className="mt-1 text-[8.5pt] leading-snug text-ink-soft">
                          {[p.caption || p.story?.slice(0, 90), p.date && formatDate(p.date, "he")].filter(Boolean).join(" · ")}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </Sheet>
        )}

        {parts.words && by("words").length > 0 && (
          <Sheet>
            <Title>המילים שלה</Title>
            <div className="mt-6 columns-2 gap-6">
              {by("words").map((m) => (
                <blockquote key={m.id} className="keep mb-5 rounded-[3mm] bg-[#fbf0f2] p-4">
                  <p className="whitespace-pre-line font-display text-[15pt] leading-snug text-burgundy">“{m.body.trim()}”</p>
                  {m.title && <p className="mt-2 text-[9.5pt] text-charcoal/80">{m.title}</p>}
                  <p className="mt-2 font-hand text-[12pt] text-[#a24a64]">{m.author}</p>
                </blockquote>
              ))}
            </div>
          </Sheet>
        )}

        {parts.recipes && by("recipes").length > 0 && (
          <Sheet>
            <Title>מתכונים</Title>
            {by("recipes").map((m) => (
              <Entry key={m.id} m={m} />
            ))}
          </Sheet>
        )}

        {parts.stories && by("stories").length > 0 && (
          <Sheet>
            <Title>סיפורים ומכתבים</Title>
            {by("stories").map((m) => (
              <Entry key={m.id} m={m} />
            ))}
          </Sheet>
        )}

        {parts.photos && by("photos").length > 0 && (
          <Sheet>
            <Title>תמונות עם סיפור</Title>
            <div className="mt-6 grid grid-cols-2 gap-5">
              {by("photos").map((m) => (
                <figure key={m.id} className="keep">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {m.photoSrc && <img src={(m as Memory & { photoFull?: string }).photoFull ?? m.photoSrc} alt="" className="max-h-[85mm] w-full rounded-[3mm] object-cover" />}
                  <figcaption className="mt-2 text-[10pt] leading-relaxed">
                    {m.title && <b className="block font-display text-[12pt] font-normal text-burgundy">{m.title}</b>}
                    {m.body && <span className="whitespace-pre-line">{m.body}</span>}
                    <span className="mt-1 block font-hand text-[11pt] text-[#a24a64]">{m.author}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </Sheet>
        )}

        {parts.end && (
          <Sheet>
            <div className="flex min-h-[230mm] flex-col items-center justify-center gap-4 text-center">
              <p className="font-display text-[22pt] font-medium text-burgundy">הספר הזה נאסף על ידי כל המשפחה</p>
              <p className="max-w-[120mm] text-[11pt] leading-relaxed text-ink-soft">והוא ממשיך לגדול. עוד תמונות, סיפורים והקלטות שלה נמצאים באתר, וכל אחד יכול להוסיף.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {qr && <img src={qr} alt="" className="mt-4 h-[45mm] w-[45mm]" />}
              <p dir="ltr" className="text-[9pt] text-ink-soft">
                {site.replace(/^https?:\/\//, "")}
              </p>
            </div>
          </Sheet>
        )}
      </div>
    </div>
  );
}

/** one A4 sheet on screen; on paper, the content simply flows from page to page */
function Sheet({ children }: { children: React.ReactNode }) {
  return <article className="sheet w-[210mm] max-w-full bg-white px-[15mm] py-[16mm] shadow-[0_10px_30px_-12px_rgba(70,35,45,0.35)] print:px-0 print:py-0">{children}</article>;
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <div className="keep flex flex-col items-center gap-2 pb-2 text-center">
      <span aria-hidden className="text-[16pt] text-rose">❦</span>
      <h2 className="font-display text-[26pt] font-medium text-burgundy">{children}</h2>
    </div>
  );
}

/** a recipe, a story or a letter: its title, its words, who wrote it, and its photo if there is one */
function Entry({ m }: { m: Memory }) {
  const full = (m as Memory & { photoFull?: string }).photoFull ?? m.photoSrc;
  return (
    <section className="mt-8 border-t border-line pt-6 first-of-type:border-0">
      {m.title && <h3 className="keep font-display text-[16pt] text-burgundy">{m.title}</h3>}
      {full && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={full} alt="" className="keep mt-3 max-h-[95mm] max-w-full rounded-[3mm]" />
      )}
      {m.body && <p className="mt-3 whitespace-pre-line text-[11pt] leading-[1.8]">{m.body}</p>}
      <p className="mt-3 font-hand text-[12pt] text-[#a24a64]">
        {m.author}
        {m.relation && <span className="font-sans text-[9pt] text-ink-soft"> · {m.relation}</span>}
      </p>
    </section>
  );
}
