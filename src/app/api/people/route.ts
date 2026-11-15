import { NextResponse } from "next/server";
import { peopleDirectory } from "@/server/people";

export const runtime = "nodejs";

/** the shared list of names that are not in the family tree (the tree has its own route) */
export async function GET() {
  const { listed } = await peopleDirectory();
  return NextResponse.json({ names: listed }, { headers: { "Cache-Control": "no-cache" } });
}
