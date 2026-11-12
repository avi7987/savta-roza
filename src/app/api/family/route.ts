import { NextResponse } from "next/server";
import { family as seed } from "@/content/family";
import { LIMITS, maxBytes } from "@/lib/limits";
import { rateLimited } from "@/server/auth";
import { sniff } from "@/server/sniff";
import { familyStore, type StoredPerson } from "@/server/store";

export const runtime = "nodejs";

const clean = (v: FormDataEntryValue | null, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max) : "";

const RELATIONS = ["child", "partner", "sibling", "parent"] as const;

/** Approved additions only, without moderation data. */
const publicShape = (p: StoredPerson) => {
  const photo = p.files.find((f) => f.kind === "image");
  return {
    id: p.replaces ?? `fam-${p.id}`,
    name: p.name,
    nameAlt: p.nameAlt,
    gender: p.gender,
    relationType: p.relationType,
    to: p.to,
    replaces: p.replaces,
    born: p.born,
    birthplace: p.birthplace,
    about: p.about,
    photoSrc: photo ? `/api/files/family/${p.id}/${photo.name}` : undefined,
  };
};

export async function GET() {
  const approved = await familyStore.list("approved");
  // oldest first, so a later update to the same person wins
  return NextResponse.json({ people: approved.reverse().map(publicShape) }, { headers: { "Cache-Control": "public, max-age=60" } });
}

export async function POST(req: Request) {
  if (rateLimited(req)) return NextResponse.json({ error: "rate" }, { status: 429 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "form" }, { status: 400 });
  }
  if (clean(form.get("website"), 200)) return NextResponse.json({ ok: true }, { status: 202 });

  const known = new Set(seed.map((p) => p.id));
  const approved = await familyStore.list("approved");
  approved.forEach((p) => known.add(p.replaces ?? `fam-${p.id}`));

  const name = clean(form.get("name"), LIMITS.name);
  const nameAlt = clean(form.get("nameAlt"), LIMITS.name) || undefined;
  const g = clean(form.get("gender"), 1);
  const gender = g === "f" || g === "m" ? g : "x";
  const replaces = clean(form.get("replaces"), 80) || undefined;
  const rel = clean(form.get("relationType"), 20) as (typeof RELATIONS)[number];
  const to = clean(form.get("to"), 80) || undefined;
  const consent = form.get("consent") === "yes";

  const errors: string[] = [];
  if (!name) errors.push("name");
  if (!consent) errors.push("consent");
  if (replaces ? !known.has(replaces) : !to || !known.has(to) || !RELATIONS.includes(rel)) errors.push("to");

  const files: { data: Uint8Array; ext: string; kind: "image" }[] = [];
  const photo = form.get("photo");
  if (photo && typeof photo !== "string" && photo.size > 0) {
    const data = new Uint8Array(await photo.arrayBuffer());
    const found = sniff(data);
    if (!found || found.kind !== "image") errors.push("type");
    else if (data.byteLength > maxBytes("image")) errors.push("size");
    else files.push({ data, ext: found.ext, kind: "image" });
  }

  if (errors.length) return NextResponse.json({ error: "invalid", fields: errors }, { status: 422 });

  const saved = await familyStore.create(
    {
      name,
      nameAlt,
      gender,
      relationType: replaces ? undefined : rel,
      to: replaces ? undefined : to,
      replaces,
      born: clean(form.get("born"), 20) || undefined,
      birthplace: clean(form.get("birthplace"), 80) || undefined,
      about: clean(form.get("about"), 600) || undefined,
    },
    files
  );
  return NextResponse.json({ ok: true, id: saved.id, status: saved.status }, { status: 201 });
}
