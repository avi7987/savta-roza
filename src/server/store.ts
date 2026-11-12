import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Where memories live. This file-based store is for development and self-hosting.
 * The production deployment swaps in a Cloudflare adapter (D1 for records, R2 for files)
 * behind the same interface, so the API routes do not change.
 */

export type Status = "pending" | "approved" | "rejected";

export type StoredFile = { name: string; kind: "image" | "video" | "audio"; size: number };

export type StoredMemory = {
  id: string;
  status: Status;
  author: string;
  relation?: string;
  title?: string;
  body: string;
  lang: "he" | "ru";
  files: StoredFile[];
  createdAt: string;
  reviewedAt?: string;
};

export interface MemoryStore {
  create(m: Omit<StoredMemory, "id" | "status" | "createdAt" | "files">, files: { data: Uint8Array; ext: string; kind: StoredFile["kind"] }[]): Promise<StoredMemory>;
  list(status?: Status): Promise<StoredMemory[]>;
  get(id: string): Promise<StoredMemory | undefined>;
  setStatus(id: string, status: Status): Promise<StoredMemory | undefined>;
  readFile(id: string, name: string): Promise<Uint8Array | undefined>;
}

const ROOT = path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), "data"));
const INDEX = path.join(ROOT, "memories.json");
const SAFE = /^[a-z0-9-]+\.[a-z0-9]{2,4}$/;

let queue: Promise<unknown> = Promise.resolve();
/** serialize writes so two submissions never overwrite each other */
const locked = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
};

async function readIndex(): Promise<StoredMemory[]> {
  try {
    return JSON.parse(await readFile(INDEX, "utf8"));
  } catch {
    return [];
  }
}

async function writeIndex(all: StoredMemory[]) {
  await mkdir(ROOT, { recursive: true });
  const tmp = `${INDEX}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(all, null, 2));
  await rename(tmp, INDEX);
}

export const fileStore: MemoryStore = {
  create: (m, files) =>
    locked(async () => {
      const id = randomUUID();
      const dir = path.join(ROOT, "uploads", id);
      await mkdir(dir, { recursive: true });
      const stored: StoredFile[] = [];
      for (const f of files) {
        // file names are generated here; nothing the visitor typed reaches the file system
        const name = `${randomUUID()}.${f.ext}`;
        await writeFile(path.join(dir, name), f.data);
        stored.push({ name, kind: f.kind, size: f.data.byteLength });
      }
      const record: StoredMemory = { ...m, id, status: "pending", createdAt: new Date().toISOString(), files: stored };
      const all = await readIndex();
      all.push(record);
      await writeIndex(all);
      return record;
    }),
  list: async (status) => (await readIndex()).filter((m) => !status || m.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  get: async (id) => (await readIndex()).find((m) => m.id === id),
  setStatus: (id, status) =>
    locked(async () => {
      const all = await readIndex();
      const m = all.find((x) => x.id === id);
      if (!m) return undefined;
      m.status = status;
      m.reviewedAt = new Date().toISOString();
      await writeIndex(all);
      return m;
    }),
  readFile: async (id, name) => {
    if (!/^[0-9a-f-]{36}$/.test(id) || !SAFE.test(name)) return undefined;
    try {
      return new Uint8Array(await readFile(path.join(ROOT, "uploads", id, name)));
    } catch {
      return undefined;
    }
  },
};

export const store: MemoryStore = fileStore;
