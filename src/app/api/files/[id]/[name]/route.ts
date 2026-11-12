import { isAdmin } from "@/server/auth";
import { store } from "@/server/store";

export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
};

/** Files of approved memories are public to visitors; pending ones only to moderators. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; name: string }> }) {
  const { id, name } = await params;
  const memory = await store.get(id);
  if (!memory || !memory.files.some((f) => f.name === name)) return new Response("Not found", { status: 404 });
  if (memory.status !== "approved" && !isAdmin(req)) return new Response("Not found", { status: 404 });
  const data = await store.readFile(id, name);
  if (!data) return new Response("Not found", { status: 404 });
  const ext = name.split(".").pop() ?? "";
  return new Response(data as unknown as BodyInit, {
    headers: {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": memory.status === "approved" ? "public, max-age=86400" : "no-store",
    },
  });
}
