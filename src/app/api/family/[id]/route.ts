import { NextResponse } from "next/server";
import { isAdmin } from "@/server/auth";
import { familyStore } from "@/server/store";

export const runtime = "nodejs";

/** Moderation: approve or reject a family-tree request. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const { status } = (await req.json().catch(() => ({}))) as { status?: string };
  if (status !== "approved" && status !== "rejected" && status !== "pending") return NextResponse.json({ error: "status" }, { status: 400 });
  const updated = await familyStore.setStatus(id, status);
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  // approving someone also approves the pending requests they hang from (e.g. a new parent)
  if (status === "approved") {
    const seen = new Set([id]);
    const queue = [updated];
    while (queue.length) {
      const cur = queue.pop()!;
      for (const ref of [cur.parentId, cur.grandparentId, cur.partnerOf, cur.replaces]) {
        const m = ref?.match(/^fam-([0-9a-f-]{36})/);
        if (!m || seen.has(m[1])) continue;
        seen.add(m[1]);
        const dep = await familyStore.get(m[1]);
        if (dep && dep.status === "pending") {
          const done = await familyStore.setStatus(dep.id, "approved");
          if (done) queue.push(done);
        }
      }
    }
  }
  return NextResponse.json({ ok: true, person: updated });
}
