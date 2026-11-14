import { NextResponse } from "next/server";
import { family as seed } from "@/content/family";
import { FamilyGraph, expandRequest, mergePeople } from "@/lib/family";
import { decadeOf, formatDate, sortYear } from "@/lib/photoDate";
import { familyStore, store } from "@/server/store";

export const runtime = "nodejs";

/** lower-case, no Hebrew vowel marks, ё → е, so "Роза" finds "роза" and "סבתא" finds "סָבְתָא" */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[֑-ׇ̀-ͯ]/g, "")
    .replace(/ё/g, "е");

/**
 * Plain word search across the whole archive: titles, stories, what the family told about photos,
 * names of the people tagged, places and years. Every word must appear somewhere in the item.
 * (Meaning-based search comes later, on top of this.)
 */
export async function GET(req: Request) {
  const q = norm(new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  const words = q.split(/\s+/).filter((w) => w.length > 1 || /\d/.test(w));
  if (!words.length) return NextResponse.json({ results: [] });

  const approved = (await familyStore.list()).filter((p) => p.status === "approved");
  const graph = new FamilyGraph(mergePeople(seed, approved.flatMap((p) => expandRequest(p, `fam-${p.id}`))));
  const nameOf = (id: string) => {
    const p = graph.byId.get(id);
    return p ? [p.name, p.nameAlt].filter(Boolean).join(" ") : "";
  };

  const results: { type: "photo" | "memory"; id: string; ids?: string[]; count?: number; memoryId: string; file?: string; kind?: string; title?: string; text?: string; author: string; year?: number; src?: string; score: number }[] = [];
  for (const m of await store.list()) {
    if (m.status === "rejected") continue;
    const base = [m.title, m.body, m.author, m.relation, ...(m.people ?? []).map(nameOf)].filter(Boolean).join(" \n ");
    const visual = m.files.filter((f) => f.kind !== "audio");
    const audio = m.files.filter((f) => f.kind === "audio");
    const words2 = (hay: string) => {
      const h = norm(hay);
      return words.every((w) => h.includes(w)) ? words.reduce((n, w) => n + h.split(w).length - 1, 0) : 0;
    };
    // one result per upload: its first matching photo, with the others behind it
    const hits: { f: (typeof visual)[number]; y?: number; score: number }[] = [];
    for (const f of visual) {
      const y = sortYear(f.date);
      const hay = [
        base,
        ...(f.people ?? []).map(nameOf),
        ...(f.notes ?? []).flatMap((n) => [n.who, n.when, n.place, n.what, n.by, ...(n.people ?? []).map(nameOf)]),
        y ? `${y} ${decadeOf(y)} ${formatDate(f.date, "he")} ${formatDate(f.date, "ru")}` : "",
      ]
        .filter(Boolean)
        .join(" \n ");
      const score = words2(hay);
      if (score) hits.push({ f, y, score });
    }
    if (hits.length) {
      const top = [...hits].sort((a, b) => b.score - a.score)[0];
      const url = (n: string) => `/api/files/memories/${m.id}/${n}`;
      results.push({
        type: "photo",
        id: `${m.id}.${top.f.name}`,
        ids: [top, ...hits.filter((h) => h !== top)].map((h) => `${m.id}.${h.f.name}`),
        count: hits.length,
        memoryId: m.id,
        file: top.f.name,
        kind: top.f.kind,
        title: m.title,
        text: (top.f.notes?.at(-1)?.what ?? m.body)?.slice(0, 220),
        author: m.author,
        year: top.y,
        src: url(top.f.thumb ?? top.f.name),
        score: top.score,
      });
    }
    // words and recordings without matching photos stand on their own
    if (!hits.length && (m.body?.trim() || audio.length)) {
      const score = words2(base);
      if (score) results.push({ type: "memory", id: m.id, memoryId: m.id, title: m.title, text: m.body?.slice(0, 280), author: m.author, kind: audio.length ? "audio" : undefined, score });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return NextResponse.json({ results: results.slice(0, 40) }, { headers: { "Cache-Control": "no-cache" } });
}
