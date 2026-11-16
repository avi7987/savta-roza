import { NextResponse } from "next/server";
import { isAdmin } from "@/server/auth";
import { getVoice, setVoice } from "@/server/voice";

export const runtime = "nodejs";

const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "Cache-Control": "no-store" } });

/** the words and sayings that were Rosa's, for answers in her voice */
export async function GET(req: Request) {
  if (!(await isAdmin(req))) return json({ error: "unauthorized" }, 401);
  return json({ voice: await getVoice() });
}

export async function POST(req: Request) {
  if (!(await isAdmin(req))) return json({ error: "unauthorized" }, 401);
  const b = (await req.json().catch(() => ({}))) as { voice?: unknown };
  if (typeof b.voice !== "string") return json({ error: "voice" }, 422);
  return json({ voice: await setVoice(b.voice) });
}
