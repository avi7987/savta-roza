import { NextResponse } from "next/server";
import { isAdmin } from "@/server/auth";
import { store, type Status } from "@/server/store";

export const runtime = "nodejs";

/** Everything waiting for review (or another status), for moderators only. */
export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const status = (new URL(req.url).searchParams.get("status") ?? "pending") as Status;
  return NextResponse.json({ memories: await store.list(status) }, { headers: { "Cache-Control": "no-store" } });
}
