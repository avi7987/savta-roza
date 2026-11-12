import { NextResponse } from "next/server";
import { isAdmin } from "@/server/auth";
import { store } from "@/server/store";

export const runtime = "nodejs";

/** Optional words for each decade of the life story, written by the site owner. */
export type DecadeNotes = Record<string, { title?: string; text?: string; titleRu?: string; textRu?: string }>;

const read = async (): Promise<DecadeNotes> => {
  try {
    return JSON.parse((await store.getMeta("story")) ?? "{}");
  } catch {
    return {};
  }
};

export async function GET() {
  return NextResponse.json({ decades: await read() }, { headers: { "Cache-Control": "no-cache" } });
}

export async function PUT(req: Request) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { decade?: number; title?: string; text?: string; titleRu?: string; textRu?: string };
  const d = Number(b.decade);
  if (!Number.isInteger(d) || d < 1880 || d > 2100 || d % 10) return NextResponse.json({ error: "decade" }, { status: 422 });
  const s = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) || undefined : undefined);
  const all = await read();
  all[String(d)] = { title: s(b.title, 120), text: s(b.text, 2000), titleRu: s(b.titleRu, 120), textRu: s(b.textRu, 2000) };
  await store.setMeta("story", JSON.stringify(all));
  return NextResponse.json({ ok: true, decades: all });
}
