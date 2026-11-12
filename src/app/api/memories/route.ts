import { NextResponse } from "next/server";
import { LIMITS, detectLang, maxBytes } from "@/lib/limits";
import { rateLimited } from "@/server/auth";
import { sniff } from "@/server/sniff";
import { family as seed } from "@/content/family";
import { familyStore, store, type StoredMemory } from "@/server/store";
import { afterStore, canStore } from "@/server/quota";

export const runtime = "nodejs";

const clean = (v: FormDataEntryValue | null, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max) : "";

/** Public shape of an approved memory: no moderation data, files via the guarded file route. */
const publicShape = (m: StoredMemory) => {
  const image = m.files.find((f) => f.kind === "image");
  const media = m.files.find((f) => f.kind !== "image");
  return {
    id: m.id,
    author: m.author,
    relation: m.relation,
    title: m.title,
    body: m.body,
    lang: m.lang,
    createdAt: m.createdAt,
    photoSrc: image ? `/api/files/memories/${m.id}/${image.name}` : undefined,
    people: m.people,
    mediaKind: media?.kind,
  };
};

export async function GET() {
  const approved = await store.list("approved");
  return NextResponse.json({ memories: approved.map(publicShape) }, { headers: { "Cache-Control": "public, max-age=60" } });
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

  const files: { data: Uint8Array; ext: string; kind: "image" | "video" | "audio" }[] = [];
  for (const f of uploads.slice(0, LIMITS.maxFiles)) {
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
    files.push({ data, ext: found.ext, kind: found.kind });
  }

  if (errors.length) return NextResponse.json({ error: "invalid", fields: Array.from(new Set(errors)) }, { status: 422 });
  // storage stays inside the free tier: past the cap, files are refused (text still is welcome)
  if (!(await canStore(files.reduce((s, f) => s + f.data.byteLength, 0)))) return NextResponse.json({ error: "full" }, { status: 507 });

  const saved = await store.create({ author, relation, title, body, people: people.length ? people : undefined, lang: detectLang(`${title ?? ""} ${body}`) }, files);
  if (files.length) await afterStore();
  // new memories wait for a moderator; nothing is published automatically
  return NextResponse.json({ ok: true, id: saved.id, status: saved.status }, { status: 201 });
}
