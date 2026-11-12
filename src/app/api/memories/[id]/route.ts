import { NextResponse } from "next/server";
import { isAdmin } from "@/server/auth";
import { store } from "@/server/store";

export const runtime = "nodejs";

/** Moderation: approve or reject a memory. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const { status } = (await req.json().catch(() => ({}))) as { status?: string };
  if (status !== "approved" && status !== "rejected" && status !== "pending") return NextResponse.json({ error: "status" }, { status: 400 });
  const updated = await store.setStatus(id, status);
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, memory: updated });
}
