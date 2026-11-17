import { NextResponse } from "next/server";
import { isAdmin } from "@/server/auth";
import { factStore, familyStore, store, textStore } from "@/server/store";
import { ownQuestions } from "@/server/quiz";

export const runtime = "nodejs";

/**
 * Everything the site holds, for the backup made in the admin page: every record as data, and the
 * list of files to copy (the browser fetches each one and writes it to the folder the owner chose).
 * Removed (rejected) memories are left out; their files are already deleted.
 */
export async function GET(req: Request) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const meta = async (k: string) => {
    try {
      return JSON.parse((await store.getMeta(k)) ?? "null");
    } catch {
      return null;
    }
  };
  const [memories, family, facts, texts, story, questions] = await Promise.all([
    store.list().then((l) => l.filter((m) => m.status !== "rejected")),
    familyStore.list().then((l) => l.filter((m) => m.status !== "rejected")),
    factStore.list(),
    textStore.list(),
    meta("story"),
    ownQuestions(),
  ]);
  return NextResponse.json(
    { generatedAt: new Date().toISOString(), memories, family, facts, texts, story: story ?? {}, questions },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** remember when the last backup was made, to show it (and remind) in the admin page */
export async function POST(req: Request) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const at = new Date().toISOString();
  await store.setMeta("backup-at", at);
  return NextResponse.json({ ok: true, at });
}
