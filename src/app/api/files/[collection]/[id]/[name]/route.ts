import { isAdmin } from "@/server/auth";
import { familyStore, store } from "@/server/store";

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

const STORES = { memories: store, family: familyStore } as const;

/** Files of approved submissions are visible to visitors; pending ones only to moderators. */
export async function GET(req: Request, { params }: { params: Promise<{ collection: string; id: string; name: string }> }) {
  const { collection, id, name } = await params;
  const s = STORES[collection as keyof typeof STORES];
  if (!s) return new Response("Not found", { status: 404 });
  const record = await s.get(id);
  if (!record || !record.files.some((f) => f.name === name || f.thumb === name)) return new Response("Not found", { status: 404 });
  // memories are public as soon as they are shared (until the owner removes them); family requests need approval
  const visible = collection === "memories" ? record.status !== "rejected" : record.status === "approved";
  if (!visible && !(await isAdmin(req))) return new Response("Not found", { status: 404 });
  const data = await s.readFile(id, name);
  if (!data) return new Response("Not found", { status: 404 });
  const ext = name.split(".").pop() ?? "";
  return new Response(data as unknown as BodyInit, {
    headers: {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": visible ? "public, max-age=31536000, immutable" : "no-store",
    },
  });
}
