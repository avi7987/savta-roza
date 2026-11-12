import { NextResponse } from "next/server";
import { sortYear } from "@/lib/photoDate";
import { analyzeMemory, later } from "@/server/analyze";
import { store } from "@/server/store";

export const runtime = "nodejs";

const DAY = 24 * 60 * 60 * 1000;

/** Every photo and video on the site, newest first by when it was taken, for the story, gallery and family cards. */
export async function GET() {
  const memories = (await store.list()).filter((m) => m.status !== "rejected");
  const photos = memories.flatMap((m) =>
    m.files
      .filter((f) => f.kind !== "audio")
      .map((f) => {
        const url = (n: string) => `/api/files/memories/${m.id}/${n}`;
        return {
          id: `${m.id}.${f.name}`,
          kind: f.kind,
          src: url(f.thumb ?? f.name),
          full: url(f.name),
          poster: f.kind === "video" && f.thumb ? url(f.thumb) : undefined,
          ratio: f.width && f.height ? f.width / f.height : 4 / 3,
          date: f.date,
          year: sortYear(f.date),
          category: f.category,
          people: m.people ?? [],
          contributor: m.author,
          caption: m.title,
          memoryId: m.id,
          file: f.name,
          removalRequested: !!(f.deleteRequest || m.deleteRequest),
        };
      })
  );
  photos.sort((a, b) => (b.year ?? -1) - (a.year ?? -1));

  // photos still without a date get another try at an estimate, at most once a day each, a couple at a time
  const retry = memories
    .filter((m) => m.files.some((f) => f.kind !== "audio" && !f.date && f.thumb && (!f.aiTriedAt || Date.now() - Date.parse(f.aiTriedAt) > DAY)))
    .slice(0, 2);
  if (retry.length) await later(Promise.all(retry.map((m) => analyzeMemory(m.id))));

  return NextResponse.json({ photos }, { headers: { "Cache-Control": "no-cache" } });
}
