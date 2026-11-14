import { NextResponse } from "next/server";
import { LIMITS } from "@/lib/limits";
import { cleanDate, formatDate } from "@/lib/photoDate";
import { rateLimited } from "@/server/auth";
import { familyStore, store, type FileNote } from "@/server/store";
import { FamilyGraph, expandRequest, mergePeople } from "@/lib/family";
import { family as seed } from "@/content/family";

export const runtime = "nodejs";

const text = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) || undefined : undefined);

/**
 * "Tell us more about this photo": who is in it, when, where, what happened.
 * Every answer is kept as its own attributed note. A date only fills in a photo that has none
 * (or only a machine estimate); tagged people must already be in the family tree.
 */
export async function POST(req: Request) {
  if (rateLimited(req, 30, 10 * 60 * 1000, "info")) return NextResponse.json({ error: "rate" }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const memoryId = text(b.memoryId, 80);
  const file = text(b.file, 120);
  const m = memoryId ? await store.get(memoryId) : undefined;
  const f = m?.files.find((x) => x.name === file);
  if (!m || m.status === "rejected" || !f) return NextResponse.json({ error: "not found" }, { status: 404 });

  // people must be real entries of the tree, as visitors see it
  const approved = (await familyStore.list()).filter((p) => p.status === "approved");
  const graph = new FamilyGraph(mergePeople(seed, approved.flatMap((p) => expandRequest(p, `fam-${p.id}`))));
  const people = Array.isArray(b.people) ? Array.from(new Set(b.people.filter((id): id is string => typeof id === "string" && graph.byId.has(id)))).slice(0, 30) : [];

  const year = Number(b.year);
  const decade = Number(b.decade);
  const date = Number.isInteger(year) && year > 0 ? cleanDate({ year }, "user") : Number.isInteger(decade) && decade > 0 ? cleanDate({ from: decade, to: decade + 9 }, "user") : undefined;
  const canDate = !f.date || f.date.source === "ai";

  const note: FileNote = {
    at: new Date().toISOString(),
    by: text(b.by, LIMITS.name),
    people: people.length ? people : undefined,
    who: text(b.who, 300),
    when: date ? formatDate(date, "he") : text(b.when, 80),
    place: text(b.place, 160),
    what: text(b.what, 2000),
  };
  if (!note.people && !note.who && !note.when && !note.place && !note.what) return NextResponse.json({ error: "empty" }, { status: 422 });

  const updated = await store.update(m.id, (cur) => ({
    ...cur,
    files: cur.files.map((x) =>
      x.name !== f.name
        ? x
        : {
            ...x,
            date: date && canDate ? date : x.date,
            people: people.length ? Array.from(new Set([...(x.people ?? []), ...people])) : x.people,
            notes: [...(x.notes ?? []), note].slice(-30),
          }
    ),
  }));
  return NextResponse.json({ ok: true, dated: !!(date && canDate), file: updated?.files.find((x) => x.name === f.name) });
}
