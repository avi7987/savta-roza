import { NextResponse } from "next/server";
import { MIN_PASSWORD, isAdmin, setAdminPassword } from "@/server/auth";

export const runtime = "nodejs";

/** the owner chooses their own admin password (signed in with the current one) */
export async function POST(req: Request) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { password?: unknown };
  const pw = typeof b.password === "string" ? b.password : "";
  if (pw.length < MIN_PASSWORD || pw.length > 200 || pw.trim() !== pw) return NextResponse.json({ error: "weak" }, { status: 422 });
  await setAdminPassword(pw);
  return NextResponse.json({ ok: true });
}
