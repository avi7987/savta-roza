import { NextResponse } from "next/server";
import { LIMITS } from "@/lib/limits";
import { cleanDate, formatDate } from "@/lib/photoDate";
import { rateLimited } from "@/server/auth";
import { store, type FileNote } from "@/server/store";
import { resolvePeople } from "@/server/people";
import { enqueueIndex } from "@/server/knowledge";

export const runtime = "nodejs";

const text = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) || undefined : undefined);

/**
 * The sorting screen: the same answer for many photos at once (a decade or a year, who is in them).
 * As with one photo, each gets its own attributed note, and a date only fills in a photo that has
 * none (or only a machine estimate).
 */
export async function POST(req: Request) {
  if (rateLimited(req, 40, 10 * 60 * 1000, "bulk-info")) return NextResponse.json({ error: "rate" }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const items = (Array.isArray(b.items) ? b.items : [])
    .map((x) => ({ memoryId: text((x as Record<string, unknown>)?.memoryId, 80), file: text((x as Record<string, unknown>)?.file, 120) }))
    .filter((x): x is { memoryId: string; file: string } => !!x.memoryId && !!x.file)
    .slice(0, 300);
  if (!items.length) return NextResponse.json({ error: "items" }, { status: 422 });

  const by = text(b.by, LIMITS.name);
  const people = (await resolvePeople(b.people, b.newPeople, by)).slice(0, 30);
  const year = Number(b.year);
  const decade = Number(b.decade);
  const date = Number.isInteger(year) && year > 1850 ? cleanDate({ year }, "user") : Number.isInteger(decade) && decade > 1850 ? cleanDate({ from: decade, to: decade + 9 }, "user") : undefined;
  if (!people.length && !date) return NextResponse.json({ error: "empty" }, { status: 422 });

  // one change per memory, with all its chosen files
  const byMemory = new Map<string, Set<string>>();
  for (const it of items) byMemory.set(it.memoryId, (byMemory.get(it.memoryId) ?? new Set()).add(it.file));
  let changed = 0;
  let dated = 0;
  for (const [memoryId, files] of byMemory) {
    const m = await store.get(memoryId);
    if (!m || m.status === "rejected") continue;
    if (people.length) await enqueueIndex(memoryId);
    await store.update(memoryId, (cur) => ({
      ...cur,
      files: cur.files.map((f) => {
        if (!files.has(f.name)) return f;
        const canDate = !!date && (!f.date || f.date.source === "ai");
        const note: FileNote = { at: new Date().toISOString(), by, people: people.length ? people : undefined, when: canDate ? formatDate(date, "he") : undefined };
        changed++;
        if (canDate) dated++;
        return {
          ...f,
          date: canDate ? date : f.date,
          people: people.length ? Array.from(new Set([...(f.people ?? []), ...people])) : f.people,
          notes: [...(f.notes ?? []), note].slice(-30),
        };
      }),
    }));
  }
  return NextResponse.json({ ok: true, changed, dated });
}
