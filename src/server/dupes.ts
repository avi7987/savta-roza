import "server-only";
import { compare, type Fingerprint, type Match } from "@/lib/dedupe";
import { store } from "./store";

export type DupeHit = { match: Match; status: "approved" | "pending"; memoryId: string; file: string };

/** For each fingerprint, the closest photo already on the site (approved or waiting), if any. */
export async function findDuplicates(prints: Fingerprint[], opts: { exclude?: string } = {}): Promise<(DupeHit | null)[]> {
  const existing = (await store.list()).filter((m) => m.status !== "rejected" && m.id !== opts.exclude);
  return prints.map((fp) => {
    let best: DupeHit | null = null;
    for (const m of existing)
      for (const f of m.files) {
        const match = compare(fp, f);
        if (!match) continue;
        const hit: DupeHit = { match, status: m.status as DupeHit["status"], memoryId: m.id, file: f.name };
        if (match === "exact") return hit;
        best ??= hit;
      }
    return best;
  });
}
