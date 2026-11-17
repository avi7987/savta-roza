import { NextResponse } from "next/server";
import { adminLocked, isAdmin } from "@/server/auth";
import { familyStore, store, type Status } from "@/server/store";

export const runtime = "nodejs";

/** Everything waiting for review (or another status), for moderators only. */
export async function GET(req: Request) {
  // signing in goes through here: say so when it is locked after wrong tries, rather than "wrong password"
  if (!(await isAdmin(req))) return adminLocked(req) ? NextResponse.json({ error: "locked" }, { status: 429 }) : NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const raw = q.get("status") ?? "pending";
  // "all" lets the moderation page count every tab with one request
  const status = raw === "all" ? undefined : (raw as Status);
  const items = q.get("kind") === "family" ? await familyStore.list(status) : await store.list(status);
  return NextResponse.json({ memories: items }, { headers: { "Cache-Control": "no-store" } });
}
