import { NextResponse } from "next/server";
import { later } from "@/server/analyze";
import { checkKnown, openQuestions, ownQuestions, quizCards, quizOn } from "@/server/quiz";

export const runtime = "nodejs";

/** the questions grandma may ask on this visit (the browser skips what this visitor already answered) */
export async function GET(req: Request) {
  const want = new URL(req.url).searchParams.get("q")?.slice(0, 200) || undefined;
  const on = await quizOn();
  const cards = on ? await quizCards(want) : [];
  // in the background: which questions the verified facts already answer (a few at a time, kept until the facts change)
  if (on) await later(checkKnown([...(await openQuestions()).map((x) => x.q), ...(await ownQuestions())]).catch(() => {}));
  return NextResponse.json({ on, cards }, { headers: { "Cache-Control": "no-store" } });
}
