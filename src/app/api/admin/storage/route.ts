import { NextResponse } from "next/server";
import { isAdmin } from "@/server/auth";
import { storageReport } from "@/server/quota";

export const runtime = "nodejs";

/** how much room is used and left for photos, videos and recordings */
export async function GET(req: Request) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await storageReport(), { headers: { "Cache-Control": "no-store" } });
}
