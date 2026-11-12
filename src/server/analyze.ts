import "server-only";
import { ROSA } from "@/content/family";
import { store, type StoredMemory } from "./store";
import { chooseDate, estimatePhoto } from "./vision";

/** Run something after the response has been sent (Cloudflare), or right away (development). */
export async function later(task: Promise<unknown>) {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { ctx } = await getCloudflareContext({ async: true });
    if (ctx?.waitUntil) {
      ctx.waitUntil(task.catch((e) => console.warn("[later]", e)));
      return;
    }
  } catch {}
  await task.catch((e) => console.warn("[later]", e));
}

/**
 * Estimate dates (and categories) for a memory's photos and videos that the family did not date.
 * Uses each file's small preview; `only` limits it to one file (the moderation page's button).
 */
export async function analyzeMemory(id: string, opts: { only?: string; force?: boolean } = {}) {
  const m = await store.get(id);
  if (!m) return undefined;
  const results = new Map<string, Awaited<ReturnType<typeof estimatePhoto>>>();
  for (const f of m.files) {
    if (opts.only && f.name !== opts.only) continue;
    if (f.kind === "audio") continue;
    if (!opts.force && f.date?.source === "user") continue;
    const src = f.thumb ?? (f.kind === "image" && f.size < 2_000_000 ? f.name : undefined);
    if (!src) continue;
    const bytes = await store.readFile(id, src);
    if (!bytes) continue;
    results.set(f.name, await estimatePhoto(bytes, { rosaInPhoto: m.people?.includes(ROSA) }));
  }
  const tried = new Date().toISOString();
  if (!results.size) return m;
  return store.update(id, (cur: StoredMemory) => ({
    ...cur,
    files: cur.files.map((f) => {
      if (!results.has(f.name)) return f;
      const est = results.get(f.name)!;
      if (!est) return { ...f, aiTriedAt: tried };
      const user = opts.force ? undefined : f.date?.source === "user" ? f.date : undefined;
      const exif = f.date?.source === "exif" ? f.date : undefined;
      return { ...f, aiTriedAt: tried, date: chooseDate(user, exif, est) ?? f.date, category: f.category ?? est?.category };
    }),
  }));
}
