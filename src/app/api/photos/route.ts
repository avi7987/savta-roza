import { NextResponse } from "next/server";
import { sortYear } from "@/lib/photoDate";
import { store } from "@/server/store";

export const runtime = "nodejs";

/** Every approved photo and video, newest first by when it was taken, for the gallery, timeline and family cards. */
export async function GET() {
  const memories = await store.list("approved");
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
        };
      })
  );
  photos.sort((a, b) => (b.year ?? -1) - (a.year ?? -1));
  return NextResponse.json({ photos }, { headers: { "Cache-Control": "public, max-age=60" } });
}
