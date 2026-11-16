import "server-only";
import { MODELS, aiAvailable, runAi } from "./ai";
import { peopleDirectory } from "./people";
import { factStore, store, textStore, vectorStore, type StoredFact, type StoredVector } from "./store";

/*
  Search by meaning. Pieces of the archive (what people wrote, what they told about photos, letters
  and recordings that were read, verified facts) are turned into vectors with a multilingual model,
  so "the holidays at grandma's" can find "Seder night at Rosa's" in Hebrew or Russian.
  The vectors live with the rest of the data; a family archive is small enough to compare them all
  on each search, without a separate (paid) vector database.
*/

const CHUNK = 400;

const toB64 = (v: number[]) => {
  const f = new Float32Array(v);
  const b = new Uint8Array(f.buffer);
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (s: string) => {
  const bin = atob(s);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return new Float32Array(b.buffer);
};

/** split long text at sentence ends, about CHUNK characters each */
function chunks(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= CHUNK) return clean ? [clean] : [];
  const out: string[] = [];
  let cur = "";
  for (const part of clean.split(/(?<=[.!?…])\s+/)) {
    if ((cur + " " + part).length > CHUNK && cur) {
      out.push(cur);
      cur = part;
    } else cur = cur ? `${cur} ${part}` : part;
  }
  if (cur) out.push(cur);
  return out.flatMap((c) => (c.length > CHUNK * 1.5 ? c.match(new RegExp(`.{1,${CHUNK}}`, "g")) ?? [] : [c]));
}

async function embed(texts: string[]): Promise<number[][] | null> {
  if (!texts.length) return [];
  const res = await runAi<{ data?: number[][] }>("embed", MODELS.embed, { text: texts });
  return res?.data && res.data.length === texts.length ? res.data : null;
}

async function bump() {
  await store.setMeta("vectors-version", String(Date.now()));
}

type Piece = { kind: StoredVector["kind"]; memoryId?: string; file?: string; factId?: string; text: string };

async function replace(match: (v: StoredVector) => boolean, pieces: Piece[]) {
  const vecs = await embed(pieces.map((p) => p.text));
  if (!vecs) return false;
  for (const old of (await vectorStore.list("approved")).filter(match)) await vectorStore.setStatus(old.id, "rejected");
  for (const [i, p] of pieces.entries()) await vectorStore.create({ ...p, vec: toB64(vecs[i]) }, [], "approved");
  await bump();
  return true;
}

/** (re)index everything that belongs to one memory */
export async function indexMemory(memoryId: string): Promise<boolean> {
  const m = await store.get(memoryId);
  if (!m || m.status === "rejected") {
    await replace((v) => v.memoryId === memoryId && v.kind !== "fact", []);
    return true;
  }
  const pieces: Piece[] = [];
  // the people tagged in it are part of what it says ("who was there?")
  const { nameOf } = await peopleDirectory();
  const tagged = Array.from(new Set([...(m.people ?? []), ...m.files.flatMap((f) => f.people ?? [])])).map(nameOf).filter(Boolean);
  const head = [m.title, m.body, tagged.length ? `People in this memory: ${tagged.join(", ")}` : ""].filter(Boolean).join(". ");
  for (const c of chunks(head)) pieces.push({ kind: "memory", memoryId, text: c });
  for (const f of m.files)
    for (const n of f.notes ?? []) {
      const t = [n.what, n.place, n.when, n.who].filter(Boolean).join(". ");
      for (const c of chunks(t)) pieces.push({ kind: "note", memoryId, file: f.name, text: c });
    }
  for (const t of (await textStore.list("approved")).filter((x) => x.memoryId === memoryId)) for (const c of chunks(t.text)) pieces.push({ kind: t.source, memoryId, file: t.file, text: c });
  return replace((v) => v.memoryId === memoryId && v.kind !== "fact", pieces.slice(0, 40));
}

/** a verified fact joins the search; any other status leaves it */
export async function indexFact(f: StoredFact) {
  if (f.status !== "approved") return replace((v) => v.factId === f.id, []);
  return replace((v) => v.factId === f.id, [{ kind: "fact", factId: f.id, memoryId: f.sources.find((s) => s.memoryId)?.memoryId || undefined, text: [f.statement, f.statementRu].filter(Boolean).join(" / ") }]);
}

/* ---------- searching ---------- */

let cache: { version: string; rows: (StoredVector & { v: Float32Array })[] } | null = null;

async function all() {
  const version = (await store.getMeta("vectors-version")) ?? "0";
  if (cache?.version !== version) cache = { version, rows: (await vectorStore.list("approved")).map((r) => ({ ...r, v: fromB64(r.vec) })) };
  return cache.rows;
}

const cosine = (a: Float32Array, b: Float32Array) => {
  let d = 0, x = 0, y = 0;
  for (let i = 0; i < a.length; i++) {
    d += a[i] * b[i];
    x += a[i] * a[i];
    y += b[i] * b[i];
  }
  return d / (Math.sqrt(x * y) || 1);
};

export type Hit = { kind: StoredVector["kind"]; memoryId?: string; file?: string; factId?: string; text: string; score: number };

/** the pieces closest in meaning to the question; null when the meaning search is not available */
export async function nearest(query: string, k = 8, min = 0.42): Promise<Hit[] | null> {
  const rows = await all();
  // nothing indexed yet: say "no answer" only if meaning search works at all
  if (!rows.length) return (await aiAvailable()) ? [] : null;
  const q = await embed([query.slice(0, 500)]);
  if (!q) return null;
  const qv = new Float32Array(q[0]);
  return rows
    .map((r) => ({ kind: r.kind, memoryId: r.memoryId, file: r.file, factId: r.factId, text: r.text, score: cosine(qv, r.v) + (r.kind === "fact" ? 0.04 : 0) }))
    .filter((h) => h.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/** how much of the archive is searchable by meaning */
export async function indexState() {
  const rows = await vectorStore.list("approved");
  const facts = await factStore.list("approved");
  return { pieces: rows.length, memories: new Set(rows.filter((r) => r.memoryId).map((r) => r.memoryId)).size, facts: rows.filter((r) => r.kind === "fact").length, verifiedFacts: facts.length };
}
