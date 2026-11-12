import { NextResponse } from "next/server";
import type { CategoryId } from "@/content/types";
import { cleanDate } from "@/lib/photoDate";
import { isAdmin } from "@/server/auth";
import { store } from "@/server/store";

export const runtime = "nodejs";

const CATEGORIES: CategoryId[] = ["family", "childhood", "celebrations", "travel", "moments", "grandchildren"];

/**
 * Moderation: approve or reject a memory, and/or correct its photos' dates and categories.
 * Body: { status?, files?: [{ name, date?: {date?, year?, from?, to?} | null, category? }] }
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    status?: string;
    files?: { name: string; date?: { date?: string; year?: number; from?: number; to?: number } | null; category?: string }[];
  };
  const { status } = body;
  if (status !== undefined && status !== "approved" && status !== "rejected" && status !== "pending") return NextResponse.json({ error: "status" }, { status: 400 });

  let updated = await store.get(id);
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (Array.isArray(body.files) && body.files.length) {
    const edits = new Map(body.files.map((f) => [f.name, f]));
    updated = await store.update(id, (cur) => ({
      ...cur,
      files: cur.files.map((f) => {
        const e = edits.get(f.name);
        if (!e) return f;
        const date = e.date === null ? undefined : e.date ? cleanDate(e.date, "user") ?? f.date : f.date;
        const category = e.category === "" ? undefined : CATEGORIES.includes(e.category as CategoryId) ? (e.category as CategoryId) : f.category;
        return { ...f, date, category };
      }),
    }));
  }
  if (status) {
    updated = await store.setStatus(id, status);
    // a rejected memory does not keep taking storage
    if (status === "rejected") await store.removeFiles(id);
  }
  return NextResponse.json({ ok: true, memory: updated });
}
