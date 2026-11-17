import { NextResponse } from "next/server";
import { quizCards, quizOn } from "@/server/quiz";

export const runtime = "nodejs";

/** the questions grandma may ask on this visit (the browser skips what this visitor already answered) */
export async function GET(req: Request) {
  const want = new URL(req.url).searchParams.get("q")?.slice(0, 200) || undefined;
  const on = await quizOn();
  return NextResponse.json({ on, cards: on ? await quizCards(want) : [] }, { headers: { "Cache-Control": "no-store" } });
}
