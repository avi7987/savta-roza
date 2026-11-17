"use client";

import { useEffect, useRef, useState } from "react";
import { HardDriveDownload } from "lucide-react";
import { Card } from "./Card";

/*
  A full copy of the site in a folder the owner chooses (a portable disk, or a folder on the
  computer): every photo, video and recording, a readable text file for each memory, and all the
  data as JSON. Only what is new or changed is copied the next time. Runs in the browser (Chrome or
  Edge on a computer), so nothing passes through any other service.
*/

type File_ = { name: string; kind: string; size: number };
type Rec = { id: string; status: string; files: File_[]; createdAt: string; author?: string; relation?: string; title?: string; body?: string; type?: string; name?: string };
type Data = { generatedAt: string; memories: Rec[]; family: Rec[]; facts: unknown[]; texts: unknown[]; story: unknown; questions: string[] };
type Dir = FileSystemDirectoryHandle;
type Job = { dir: string[]; name: string; url: string; size: number };

/** the folder names, in Hebrew; and in plain letters for a disk or system that does not keep Hebrew names */
const HE = { root: "גיבוי סבתא רוזה", memories: "זיכרונות", family: "משפחה", data: "נתונים", readme: "קרא אותי.txt", memo: "זיכרון.txt" };
const EN = { root: "savta-roza-backup", memories: "memories", family: "family", data: "data", readme: "README.txt", memo: "memory.txt" };
type Names = typeof HE;
const ROOT = HE.root;

/** does this disk keep a Hebrew name as written? (checked once, on a small file that is then removed) */
async function hebrewOk(dir: Dir) {
  const probe = "בדיקה-שם.tmp";
  try {
    await write(dir, probe, "");
    let found = false;
    for await (const n of (dir as unknown as { keys(): AsyncIterable<string> }).keys()) if (n === probe) found = true;
    await dir.removeEntry(probe).catch(() => {});
    return found;
  } catch {
    return false;
  }
}
/** a name the file systems of Windows and macOS both accept */
const safe = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 70) || "ללא שם";
const day = (iso: string) => iso.slice(0, 10);
const MB = 1024 ** 2;
const size = (b: number) => (b >= 1024 * MB ? `${(b / 1024 / MB).toFixed(2)}GB` : `${Math.max(0, Math.round(b / MB))}MB`);

async function sub(root: Dir, path: string[]) {
  let d = root;
  for (const p of path) d = await d.getDirectoryHandle(p, { create: true });
  return d;
}
async function write(dir: Dir, name: string, data: Blob | string) {
  const h = await dir.getFileHandle(name, { create: true });
  const w = await h.createWritable();
  await w.write(data);
  await w.close();
}
/** already there, whole: then it is not copied again */
async function has(dir: Dir, name: string, bytes: number) {
  try {
    return (await (await dir.getFileHandle(name)).getFile()).size === bytes;
  } catch {
    return false;
  }
}

function memoText(m: Rec) {
  const lines = [m.title && `כותרת: ${m.title}`, `מאת: ${m.author ?? ""}${m.relation ? ` (${m.relation})` : ""}`, `נוסף לאתר: ${day(m.createdAt)}`, m.type && `סוג: ${m.type}`, m.files.length ? `קבצים: ${m.files.map((f) => f.name).join(", ")}` : ""].filter(Boolean);
  return `${lines.join("\n")}\n\n${m.body ?? ""}\n`;
}

const README = `גיבוי של האתר של סבתא רוזה

זיכרונות/  תיקייה לכל זיכרון: התמונות, הסרטונים וההקלטות שלו, וקובץ "זיכרון.txt" עם מה שנכתב.
משפחה/     התמונות של האנשים בעץ המשפחה.
נתונים/    כל המידע של האתר כקבצי JSON (זיכרונות, עץ המשפחה, עובדות, תמלולים, סיפור החיים, השאלות).
           מהם אפשר לבנות את האתר מחדש, אם יום אחד יהיה צורך.

כל גיבוי נוסף לאותה תיקייה מעתיק רק את מה שחדש או השתנה.
`;

export default function BackupPanel({ token }: { token: string }) {
  const [supported, setSupported] = useState(true);
  const [last, setLast] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "preparing" | "copying" | "done" | "failed" | "stopped">("idle");
  const [p, setP] = useState({ done: 0, total: 0, copied: 0, bytes: 0, skipped: 0, failed: 0 });
  const stop = useRef(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "showDirectoryPicker" in window);
    fetch("/api/admin/storage", { headers: { "x-admin-token": token } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setLast(d?.lastBackup ?? null))
      .catch(() => {});
  }, [token]);

  const run = async () => {
    let root: Dir;
    let names: Names = HE;
    try {
      const pick = (window as unknown as { showDirectoryPicker: (o: object) => Promise<Dir> }).showDirectoryPicker;
      const chosen = await pick({ id: "savta-roza-backup", mode: "readwrite", startIn: "documents" });
      names = (await hebrewOk(chosen)) ? HE : EN;
      root = await chosen.getDirectoryHandle(names.root, { create: true });
    } catch {
      return; // they closed the window
    }
    stop.current = false;
    setState("preparing");
    try {
      const r = await fetch("/api/admin/backup", { headers: { "x-admin-token": token } });
      if (!r.ok) throw new Error();
      const d = (await r.json()) as Data;

      // the data, and a note on what is where
      const data = await sub(root, [names.data]);
      await write(root, names.readme, README);
      for (const [n, v] of Object.entries({ memories: d.memories, family: d.family, facts: d.facts, texts: d.texts, story: d.story, questions: d.questions })) await write(data, `${n}.json`, JSON.stringify(v, null, 2));
      await write(data, "info.json", JSON.stringify({ generatedAt: d.generatedAt }, null, 2));

      // one folder per memory, named so it can be found by eye: date, who, what
      const jobs: Job[] = [];
      for (const m of d.memories) {
        // the id goes first in the name's end part, so a long title never cuts it off
        const label = names === HE ? `${m.author ?? ""} · ${m.title || m.body?.slice(0, 30) || m.type || ""}` : m.type || "memory";
        const folder = [names.memories, safe(`${day(m.createdAt)} · ${m.id.slice(0, 6)} · ${label}`).replace(/ · /g, names === HE ? " · " : "_")];
        await write(await sub(root, folder), names.memo, memoText(m));
        for (const f of m.files) jobs.push({ dir: folder, name: f.name, url: `/api/files/memories/${m.id}/${f.name}`, size: f.size });
      }
      for (const m of d.family) for (const f of m.files) jobs.push({ dir: [names.family, names === HE ? safe(`${m.name ?? ""} · ${m.id.slice(-6)}`) : m.id.slice(-12)], name: f.name, url: `/api/files/family/${m.id}/${f.name}`, size: f.size });

      setState("copying");
      const prog = { done: 0, total: jobs.length, copied: 0, bytes: 0, skipped: 0, failed: 0 };
      setP({ ...prog });
      let next = 0;
      const worker = async () => {
        while (next < jobs.length && !stop.current) {
          const j = jobs[next++];
          try {
            const dir = await sub(root, j.dir);
            if (await has(dir, j.name, j.size)) prog.skipped++;
            else {
              const res = await fetch(j.url, { headers: { "x-admin-token": token } });
              if (!res.ok) throw new Error();
              await write(dir, j.name, await res.blob());
              prog.copied++;
              prog.bytes += j.size;
            }
          } catch {
            prog.failed++;
          }
          prog.done++;
          setP({ ...prog });
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      if (stop.current) return setState("stopped");
      if (!prog.failed) {
        const s = await fetch("/api/admin/backup", { method: "POST", headers: { "x-admin-token": token } }).then((x) => x.json()).catch(() => null);
        if (s?.at) setLast(s.at);
      }
      setState("done");
    } catch (e) {
      console.error("backup failed", e);
      setState("failed");
    }
  };

  const ago = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null;
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  return (
    <Card icon={<HardDriveDownload className="h-5 w-5" strokeWidth={1.6} aria-hidden />} title="גיבוי" lead="עותק מלא של כל מה שבאתר, לתיקייה שתבחרו: דיסק נייד או תיקייה במחשב.">
      <p className="text-[0.95rem] text-charcoal">
        {last ? (
          <>
            גיבוי אחרון: <b>{new Date(last).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })}</b>
            {ago !== null && ago > 0 && ` (לפני ${ago === 1 ? "יום" : `${ago} ימים`})`}
            {ago !== null && ago >= 60 && <span className="text-burgundy"> · כדאי לגבות שוב</span>}
          </>
        ) : (
          <span className="text-burgundy">עוד לא נעשה גיבוי.</span>
        )}
      </p>

      {!supported ? (
        <p className="mt-3 rounded-md bg-blush/25 p-3 text-[0.92rem] leading-relaxed">
          הגיבוי עובד בדפדפן <b>Chrome</b> או <b>Edge</b> במחשב (לא בטלפון, ולא ב־Safari או Firefox). פתחו את דף הניהול שם.
        </p>
      ) : state === "preparing" || state === "copying" ? (
        <div className="mt-4" role="status">
          <div className="h-3 overflow-hidden rounded-full bg-mount ring-1 ring-line">
            <div className="h-full bg-rose transition-[width] duration-300" style={{ width: `${state === "preparing" ? 3 : pct}%` }} />
          </div>
          <p className="mt-2 text-[0.92rem] text-ink-soft">
            {state === "preparing" ? "אוספים את המידע…" : `${p.done} מתוך ${p.total} קבצים · הועתקו ${p.copied} (${size(p.bytes)})${p.skipped ? ` · ${p.skipped} כבר היו בגיבוי` : ""}`}
          </p>
          <button type="button" onClick={() => (stop.current = true)} className="mt-2 min-h-10 text-ink-soft underline underline-offset-4 hover:text-burgundy">
            לעצור
          </button>
        </div>
      ) : (
        <>
          <button type="button" onClick={run} className="mt-4 min-h-12 rounded-full bg-rose px-7 text-white hover:bg-burgundy">
            {last ? "לגבות עכשיו" : "לבחור תיקייה ולגבות"}
          </button>
          {state === "done" && (
            <p role="status" className="mt-2 text-burgundy">
              ✓ הגיבוי הושלם: הועתקו {p.copied} קבצים חדשים ({size(p.bytes)}){p.skipped ? `, ${p.skipped} כבר היו שם` : ""}.
              {p.failed > 0 && ` ${p.failed} קבצים לא הועתקו, נסו שוב.`}
            </p>
          )}
          {state === "stopped" && <p className="mt-2 text-ink-soft">הגיבוי נעצר. בפעם הבאה הוא ימשיך מאיפה שעצר.</p>}
          {state === "failed" && <p className="mt-2 text-burgundy">הגיבוי לא הצליח. בדקו שהדיסק מחובר ושיש בו מקום, ונסו שוב.</p>}
          <p className="mt-3 text-[0.88rem] leading-relaxed text-ink-soft">
            הדפדפן ישאל לאיזו תיקייה לשמור, ויבקש אישור לכתוב בה. בתוכה תיווצר התיקייה &quot;{ROOT}&quot;. בפעם הבאה בחרו את אותה תיקייה, ויועתק רק מה שחדש.
          </p>
        </>
      )}
    </Card>
  );
}
