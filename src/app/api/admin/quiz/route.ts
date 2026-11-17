import { NextResponse } from "next/server";
import { isAdmin } from "@/server/auth";
import { dropOpen, openQuestions, ownQuestions, quizOn, setOwnQuestions, setQuizOn } from "@/server/quiz";

export const runtime = "nodejs";

const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "Cache-Control": "no-store" } });
const state = async () => ({ on: await quizOn(), questions: (await ownQuestions()).join("\n"), open: await openQuestions() });

/** "Grandma asks": on or off, the owner's own questions, and the questions she could not answer */
export async function GET(req: Request) {
  if (!(await isAdmin(req))) return json({ error: "unauthorized" }, 401);
  return json(await state());
}

export async function POST(req: Request) {
  if (!(await isAdmin(req))) return json({ error: "unauthorized" }, 401);
  const b = (await req.json().catch(() => ({}))) as { on?: unknown; questions?: unknown; drop?: unknown };
  if (typeof b.on === "boolean") await setQuizOn(b.on);
  if (typeof b.questions === "string") await setOwnQuestions(b.questions);
  if (typeof b.drop === "string") await dropOpen(b.drop);
  return json(await state());
}
