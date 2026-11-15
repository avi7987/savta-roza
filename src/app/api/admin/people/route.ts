import { NextResponse } from "next/server";
import { isAdmin } from "@/server/auth";
import { NAME_PREFIX, peopleDirectory } from "@/server/people";
import { namesStore, store, type StoredMemory } from "@/server/store";
import { sameName } from "@/lib/names";

export const runtime = "nodejs";

const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "Cache-Control": "no-store" } });
const cleanName = (v: unknown) => (typeof v === "string" ? v.replace(/[\u0000-\u001F\u007F<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 60) : "");

/** every place a person can be tagged in one memory: the memory, each file, and each note on a file */
function retag(m: StoredMemory, from: string, into: string | null): StoredMemory {
  const swap = (list?: string[]) => {
    if (!list?.includes(from)) return list;
    const next = Array.from(new Set(list.map((x) => (x === from ? into : x)).filter((x): x is string => !!x)));
    return next.length ? next : undefined;
  };
  return {
    ...m,
    people: swap(m.people),
    files: m.files.map((f) => ({ ...f, people: swap(f.people), notes: f.notes?.map((n) => ({ ...n, people: swap(n.people) })) })),
  };
}

const mentions = (m: StoredMemory, id: string) => !!m.people?.includes(id) || m.files.some((f) => f.people?.includes(id) || f.notes?.some((n) => n.people?.includes(id)));

/** carry a change to a person through every memory and photo that tags them */
async function retagAll(from: string, into: string | null) {
  let changed = 0;
  for (const m of await store.list()) {
    if (!mentions(m, from)) continue;
    await store.update(m.id, (cur) => retag(cur, from, into));
    changed++;
  }
  return changed;
}

/** Everyone who can be tagged, with how often and where they are tagged. Owner only. */
export async function GET(req: Request) {
  if (!(await isAdmin(req))) return json({ error: "unauthorized" }, 401);
  const dir = await peopleDirectory();
  const memories = (await store.list()).filter((m) => m.status !== "rejected");
  const uses = new Map<string, { photos: number; memories: number; thumbs: string[] }>();
  const bump = (id: string) => uses.get(id) ?? (uses.set(id, { photos: 0, memories: 0, thumbs: [] }), uses.get(id)!);
  for (const m of memories) {
    const inMemory = new Set<string>(m.people ?? []);
    for (const f of m.files) {
      const ids = new Set([...(f.people ?? []), ...(f.notes ?? []).flatMap((n) => n.people ?? [])]);
      ids.forEach((id) => {
        const u = bump(id);
        u.photos++;
        if (u.thumbs.length < 4 && f.kind !== "audio") u.thumbs.push(`/api/files/memories/${m.id}/${f.thumb ?? f.name}`);
        inMemory.add(id);
      });
    }
    inMemory.forEach((id) => bump(id).memories++);
  }
  const people = [
    ...dir.graph.people.filter((p) => !p.placeholder && p.name).map((p) => ({ id: p.id, name: p.name, nameAlt: p.nameAlt, inTree: true, photo: p.photoSrc })),
    ...dir.listed.map((n) => ({ id: n.id, name: n.name, inTree: false })),
  ].map((p) => ({ ...p, ...(uses.get(p.id) ?? { photos: 0, memories: 0, thumbs: [] }) }));
  return json({ people });
}

/**
 * Owner's changes to the shared list of names. A rename shows everywhere at once (tags point to the
 * person, not the spelling); a merge moves every tag to the other person; a delete removes the tags.
 */
export async function POST(req: Request) {
  if (!(await isAdmin(req))) return json({ error: "unauthorized" }, 401);
  const b = (await req.json().catch(() => ({}))) as { action?: string; id?: string; into?: string; name?: string };
  const dir = await peopleDirectory();
  const id = typeof b.id === "string" ? b.id : "";
  const listed = dir.listed.find((n) => n.id === id);
  if (!listed) return json({ error: "only names from the shared list can be changed here" }, 400);
  const recordId = id.slice(NAME_PREFIX.length);

  if (b.action === "rename") {
    const name = cleanName(b.name);
    if (name.length < 2) return json({ error: "name" }, 422);
    const other = [...dir.listed.filter((n) => n.id !== id).map((n) => ({ id: n.id, names: [n.name] })), ...dir.graph.people.filter((p) => !p.placeholder).map((p) => ({ id: p.id, names: [p.name, p.nameAlt ?? ""] }))].find((o) =>
      o.names.some((x) => x && sameName(x, name))
    );
    if (other) return json({ error: "exists", other: other.id }, 409);
    await namesStore.update(recordId, (cur) => ({ ...cur, name }));
    return json({ ok: true });
  }

  if (b.action === "merge") {
    const into = typeof b.into === "string" ? b.into : "";
    if (!into || into === id || !dir.ids.has(into)) return json({ error: "into" }, 422);
    const changed = await retagAll(id, into);
    await namesStore.setStatus(recordId, "rejected");
    return json({ ok: true, changed });
  }

  if (b.action === "delete") {
    const changed = await retagAll(id, null);
    await namesStore.setStatus(recordId, "rejected");
    return json({ ok: true, changed });
  }

  return json({ error: "action" }, 400);
}
