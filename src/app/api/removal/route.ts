import { NextResponse } from "next/server";
import { LIMITS } from "@/lib/limits";
import { rateLimited } from "@/server/auth";
import { store } from "@/server/store";

export const runtime = "nodejs";

/**
 * Anyone can ask for a photo or memory to be removed; nothing is deleted here.
 * The request waits for the site owner in the moderation page.
 */
export async function POST(req: Request) {
  if (rateLimited(req, 20, 10 * 60 * 1000, "removal")) return NextResponse.json({ error: "rate" }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { memoryId?: string; file?: string; reason?: string; by?: string };
  const m = b.memoryId ? await store.get(b.memoryId) : undefined;
  if (!m || m.status === "rejected") return NextResponse.json({ error: "not found" }, { status: 404 });
  if (b.file && !m.files.some((f) => f.name === b.file)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const request = {
    at: new Date().toISOString(),
    reason: typeof b.reason === "string" ? b.reason.trim().slice(0, 500) || undefined : undefined,
    by: typeof b.by === "string" ? b.by.trim().slice(0, LIMITS.name) || undefined : undefined,
  };
  await store.update(m.id, (cur) =>
    b.file ? { ...cur, files: cur.files.map((f) => (f.name === b.file ? { ...f, deleteRequest: request } : f)) } : { ...cur, deleteRequest: request }
  );
  return NextResponse.json({ ok: true });
}
