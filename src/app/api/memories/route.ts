import { NextResponse } from "next/server";
import { LIMITS, detectLang, maxBytes } from "@/lib/limits";
import { rateLimited } from "@/server/auth";
import { sniff } from "@/server/sniff";
import { family as seed } from "@/content/family";
import { familyStore, store, type StoredMemory } from "@/server/store";
import { afterStore, canStore } from "@/server/quota";
import { analyzeMemory, later } from "@/server/analyze";
import { cleanDate, type PhotoDate } from "@/lib/photoDate";
import type { CategoryId } from "@/content/types";
import type { NewFile } from "@/server/store";
import { isPhash, isSha } from "@/lib/dedupe";
import { findDuplicates } from "@/server/dupes";

const CATEGORIES: CategoryId[] = ["family", "childhood", "celebrations", "travel", "moments", "grandchildren"];

/** what the family said about when the photos were taken */
function whenFromForm(raw: string): PhotoDate | undefined {
  try {
    const w = JSON.parse(raw) as { mode?: string; date?: string; year?: number; decade?: number };
    if (w.mode === "date") return cleanDate({ date: w.date }, "user");
    if (w.mode === "year") return cleanDate({ year: w.year }, "user");
    if (w.mode === "decade" && w.decade) return cleanDate({ from: w.decade, to: w.decade + 9 }, "user");
  } catch {}
  return undefined;
}

export const runtime = "nodejs";

const clean = (v: FormDataEntryValue | null, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max) : "";

/** A single year mentioned in the memory's own words ("בשנת 1975", "в 1975 году"), if exactly one is. */
function yearInText(text: string) {
  const years = Array.from(new Set((text.match(/(?<!\d)(18[89]\d|19\d\d|20[0-2]\d)(?!\d)/g) ?? []).map(Number)));
  return years.length === 1 ? years[0] : undefined;
}

/** Public shape of a memory: no moderation data, files via the guarded file route. */
const publicShape = (m: StoredMemory) => {
  const image = m.files.find((f) => f.kind === "image");
  const media = m.files.find((f) => f.kind !== "image");
  const url = (n: string) => `/api/files/memories/${m.id}/${n}`;
  return {
    id: m.id,
    author: m.author,
    relation: m.relation,
    title: m.title,
    body: m.body,
    lang: m.lang,
    createdAt: m.createdAt,
    photoSrc: image ? url(image.thumb ?? image.name) : undefined,
    photoFull: image ? url(image.name) : undefined,
    people: m.people,
    mediaKind: media?.kind,
    mediaSrc: media ? url(media.name) : undefined,
    removalRequested: !!m.deleteRequest,
  };
};

export async function GET() {
  // everything shared is public right away, until the owner removes it
  const visible = (await store.list()).filter((m) => m.status !== "rejected");
  return NextResponse.json({ memories: visible.map(publicShape) }, { headers: { "Cache-Control": "no-cache" } });
}

export async function POST(req: Request) {
  if (rateLimited(req)) return NextResponse.json({ error: "rate" }, { status: 429 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "form" }, { status: 400 });
  }

  // a field people never see; bots fill it in
  if (clean(form.get("website"), 200)) return NextResponse.json({ ok: true }, { status: 202 });

  const author = clean(form.get("name"), LIMITS.name);
  const relation = clean(form.get("relation"), LIMITS.relation) || undefined;
  const title = clean(form.get("title"), LIMITS.title) || undefined;
  const body = clean(form.get("memory"), LIMITS.body);
  // only ids that exist in the tree can be tagged
  const known = new Set(seed.map((p) => p.id));
  (await familyStore.list("approved")).forEach((p) => known.add(p.replaces ?? `fam-${p.id}`));
  const people = Array.from(new Set(form.getAll("people").filter((v): v is string => typeof v === "string" && known.has(v)))).slice(0, 40);
  const uploads = form.getAll("files").filter((f): f is File => typeof f !== "string" && f.size > 0);

  const errors: string[] = [];
  if (!author) errors.push("name");
  if (!body && uploads.length === 0) errors.push("memory");
  if (uploads.length > LIMITS.maxFiles) errors.push("count");

  const userDate = whenFromForm(clean(form.get("when"), 200));
  const cat = clean(form.get("category"), 20) as CategoryId;
  const category = CATEGORIES.includes(cat) ? cat : undefined;
  let meta: { date?: string; nameDate?: string; width?: number; height?: number; sha?: string; phash?: string }[] = [];
  try {
    meta = JSON.parse(clean(form.get("filesMeta"), 4000) || "[]");
  } catch {}

  const files: NewFile[] = [];
  for (const [i, f] of uploads.slice(0, LIMITS.maxFiles).entries()) {
    const data = new Uint8Array(await f.arrayBuffer());
    const found = sniff(data);
    if (!found) {
      errors.push("type");
      continue;
    }
    if (data.byteLength > maxBytes(found.kind)) {
      errors.push("size");
      continue;
    }
    // the small preview made in the browser: must itself be a real, small image
    const t = form.get(`thumb-${i}`);
    let thumb: Uint8Array | undefined;
    if (t && typeof t !== "string" && t.size > 0 && t.size < 1_000_000) {
      const bytes = new Uint8Array(await t.arrayBuffer());
      if (sniff(bytes)?.kind === "image") thumb = bytes;
    }
    const m = meta[i] ?? {};
    const dim = (n: unknown) => (Number.isFinite(Number(n)) && Number(n) > 0 && Number(n) < 20000 ? Math.round(Number(n)) : undefined);
    // the file's own date, else the date in its name (e.g. IMG-20120514-WA0001), else a year the memory mentions
    const textYear = yearInText(`${title ?? ""} ${body}`);
    const exif = cleanDate({ date: m.date }, "exif") ?? cleanDate({ date: m.nameDate }, "exif") ?? (textYear ? cleanDate({ year: textYear }, "user") : undefined);
    files.push({ data, ext: found.ext, kind: found.kind, thumb, sha: isSha(m.sha) ? m.sha : undefined, phash: isPhash(m.phash) ? m.phash : undefined, width: dim(m.width), height: dim(m.height), date: found.kind === "audio" ? userDate : (userDate ?? exif), category: found.kind === "audio" ? undefined : category });
  }

  if (errors.length) return NextResponse.json({ error: "invalid", fields: Array.from(new Set(errors)) }, { status: 422 });

  // the same photo is never stored twice: drop exact copies of anything already on the site, or repeated in this upload
  const hits = await findDuplicates(files);
  const seen = new Set<string>();
  const skipped = files.filter((f, i) => {
    const dup = hits[i]?.match === "exact" || (!!f.sha && seen.has(f.sha));
    if (f.sha) seen.add(f.sha);
    return dup;
  }).length;
  const seen2 = new Set<string>();
  const fresh = files.filter((f, i) => {
    const dup = hits[i]?.match === "exact" || (!!f.sha && seen2.has(f.sha));
    if (f.sha) seen2.add(f.sha);
    return !dup;
  });
  files.splice(0, files.length, ...fresh);
  if (skipped && !files.length && !body) return NextResponse.json({ error: "duplicate", skipped }, { status: 409 });
  // storage stays inside the free tier: past the cap, files are refused (text still is welcome)
  if (!(await canStore(files.reduce((s, f) => s + f.data.byteLength, 0)))) return NextResponse.json({ error: "full" }, { status: 507 });

  // shared memories appear on the site straight away; only the owner can remove them
  const saved = await store.create({ author, relation, title, body, people: people.length ? people : undefined, lang: detectLang(`${title ?? ""} ${body}`) }, files, "approved");
  if (files.length) await afterStore();
  // estimate dates for undated photos (and check "dated" scans) after answering the visitor
  if (files.some((f) => f.kind !== "audio" && f.date?.source !== "user")) await later(analyzeMemory(saved.id));
  // new memories wait for a moderator; nothing is published automatically
  return NextResponse.json({ ok: true, id: saved.id, status: saved.status, skipped }, { status: 201 });
}
