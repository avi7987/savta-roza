import { NextResponse } from "next/server";
import { family as seed } from "@/content/family";
import type { Gender } from "@/content/types";
import { FamilyGraph, expandRequest, mergePeople, type FamilyRequest, type RequestKind, type TreePerson } from "@/lib/family";
import { LIMITS, maxBytes } from "@/lib/limits";
import { rateLimited } from "@/server/auth";
import { sniff } from "@/server/sniff";
import { familyStore, type StoredPerson } from "@/server/store";

export const runtime = "nodejs";

const clean = (v: FormDataEntryValue | null, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max) : "";
const gender = (v: string): Gender => (v === "f" || v === "m" ? v : "x");
const KINDS: RequestKind[] = ["child", "grandchild", "great", "partner", "sibling", "parent"];

/** the public id of an approved request's main person */
const baseId = (p: StoredPerson) => `fam-${p.id}`;

const toRequest = (p: StoredPerson): FamilyRequest => {
  const photo = p.files.find((f) => f.kind === "image");
  return { ...p, photoSrc: photo ? `/api/files/family/${p.id}/${photo.name}` : undefined };
};

/** The tree built from requests with the given statuses: seed plus requests, oldest first. */
async function treeOf(include: StoredPerson["status"][]) {
  const all = (await familyStore.list()).filter((p) => include.includes(p.status)).reverse();
  const people: TreePerson[] = all.flatMap((p) => expandRequest(toRequest(p), baseId(p)));
  return { people, graph: new FamilyGraph(mergePeople(seed, people)) };
}
const approvedTree = () => treeOf(["approved"]);

export async function GET() {
  const { people } = await approvedTree();
  return NextResponse.json({ people }, { headers: { "Cache-Control": "public, max-age=60" } });
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

  // requests may build on others still waiting for approval; approving one approves what it rests on
  const { graph } = await treeOf(["approved", "pending"]);
  const exists = (id?: string) => !!id && graph.byId.has(id);
  const at = (id: string | undefined, depth: number) => exists(id) && graph.depth(id!) === depth;

  const f = (k: string, max = 80) => clean(form.get(k), max) || undefined;
  const kind = f("kind", 20) as RequestKind | undefined;
  const replaces = f("replaces");
  const r: Omit<StoredPerson, "id" | "status" | "files" | "createdAt"> = {
    kind: replaces ? undefined : kind,
    replaces,
    name: clean(form.get("name"), LIMITS.name),
    nameAlt: f("nameAlt", LIMITS.name),
    gender: gender(clean(form.get("gender"), 1)),
    born: f("born", 20),
    birthplace: f("birthplace"),
    about: f("about", 600),
    parentId: f("parentId"),
    parentName: f("parentName", LIMITS.name),
    parentGender: gender(clean(form.get("parentGender"), 1)),
    grandparentId: f("grandparentId"),
    grandparentName: f("grandparentName", LIMITS.name),
    grandparentGender: gender(clean(form.get("grandparentGender"), 1)),
    partnerOf: f("partnerOf"),
  };

  const errors: string[] = [];
  if (!r.name) errors.push("name");
  if (form.get("consent") !== "yes") errors.push("consent");
  // every id a request points to must already be in the tree, at the right generation
  if (replaces) {
    if (!exists(replaces)) errors.push("to");
  } else if (!kind || !KINDS.includes(kind)) errors.push("kind");
  else if (kind === "grandchild" && r.parentId && !at(r.parentId, 1)) errors.push("to");
  else if (kind === "great" && r.parentId && !at(r.parentId, 2)) errors.push("to");
  else if (kind === "great" && !r.parentId && r.grandparentId && !at(r.grandparentId, 1)) errors.push("to");
  else if (kind === "partner" && (!exists(r.partnerOf) || graph.partnerOf(r.partnerOf!))) errors.push("to");

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

  const saved = await familyStore.create(r, files);
  return NextResponse.json({ ok: true, id: baseId(saved), status: saved.status }, { status: 201 });
}
