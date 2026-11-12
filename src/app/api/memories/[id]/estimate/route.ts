import { NextResponse } from "next/server";
import { isAdmin } from "@/server/auth";
import { analyzeMemory } from "@/server/analyze";
import { sniff } from "@/server/sniff";
import { store } from "@/server/store";

export const runtime = "nodejs";

/**
 * Moderation: estimate the date of one photo now. The page may send a small preview
 * (made in the browser) for photos uploaded before previews existed; it is kept as the
 * photo's preview so the gallery loads it quickly too.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const form = await req.formData().catch(() => null);
  const name = typeof form?.get("file") === "string" ? (form!.get("file") as string) : "";
  const m = await store.get(id);
  const file = m?.files.find((f) => f.name === name);
  if (!m || !file) return NextResponse.json({ error: "not found" }, { status: 404 });

  const t = form?.get("thumb");
  if (!file.thumb && t && typeof t !== "string" && t.size > 0 && t.size < 1_000_000) {
    const bytes = new Uint8Array(await t.arrayBuffer());
    if (sniff(bytes)?.kind === "image") {
      const thumb = await store.putFile(id, bytes, "jpg");
      const w = Number(form?.get("width"));
      const h = Number(form?.get("height"));
      await store.update(id, (cur) => ({
        ...cur,
        files: cur.files.map((f) =>
          f.name === name ? { ...f, thumb, thumbSize: bytes.byteLength, width: f.width ?? (w > 0 ? Math.round(w) : undefined), height: f.height ?? (h > 0 ? Math.round(h) : undefined) } : f
        ),
      }));
    }
  }
  const updated = await analyzeMemory(id, { only: name, force: true });
  const after = updated?.files.find((f) => f.name === name);
  return NextResponse.json({ ok: !!after?.date && after.date.source === "ai", memory: updated });
}
