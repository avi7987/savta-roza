import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Where submissions live. This file-based store is for development and self-hosting.
 * The production deployment swaps in a Cloudflare adapter (D1 for records, R2 for files)
 * behind the same interface, so the API routes do not change.
 */

export type Status = "pending" | "approved" | "rejected";

export type StoredFile = { name: string; kind: "image" | "video" | "audio"; size: number };

type Base = { id: string; status: Status; files: StoredFile[]; createdAt: string; reviewedAt?: string };

export type StoredMemory = Base & {
  author: string;
  relation?: string;
  title?: string;
  body: string;
  lang: "he" | "ru";
  /** family-tree ids of the people in the attached photos */
  people?: string[];
};

export type StoredPerson = Base & {
  name: string;
  nameAlt?: string;
  gender: "f" | "m" | "x";
  relationType?: "child" | "partner" | "sibling" | "parent";
  to?: string;
  /** an existing slot in the tree this request fills in or updates */
  replaces?: string;
  born?: string;
  birthplace?: string;
  about?: string;
};

export type NewFile = { data: Uint8Array; ext: string; kind: StoredFile["kind"] };

export interface Store<T extends Base> {
  create(fields: Omit<T, keyof Base>, files: NewFile[]): Promise<T>;
  list(status?: Status): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  setStatus(id: string, status: Status): Promise<T | undefined>;
  readFile(id: string, name: string): Promise<Uint8Array | undefined>;
}

const ROOT = path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), "data"));
const SAFE = /^[a-z0-9-]+\.[a-z0-9]{2,4}$/;

let queue: Promise<unknown> = Promise.resolve();
/** serialize writes so two submissions never overwrite each other */
const locked = <R>(fn: () => Promise<R>): Promise<R> => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
};

function fileStore<T extends Base>(collection: string): Store<T> {
  const index = path.join(ROOT, `${collection}.json`);
  const uploads = path.join(ROOT, "uploads", collection);

  const read = async (): Promise<T[]> => {
    try {
      return JSON.parse(await readFile(index, "utf8"));
    } catch {
      return [];
    }
  };
  const write = async (all: T[]) => {
    await mkdir(ROOT, { recursive: true });
    const tmp = `${index}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(all, null, 2));
    await rename(tmp, index);
  };

  return {
    create: (fields, files) =>
      locked(async () => {
        const id = randomUUID();
        const dir = path.join(uploads, id);
        const stored: StoredFile[] = [];
        if (files.length) await mkdir(dir, { recursive: true });
        for (const f of files) {
          // file names are generated here; nothing the visitor typed reaches the file system
          const name = `${randomUUID()}.${f.ext}`;
          await writeFile(path.join(dir, name), f.data);
          stored.push({ name, kind: f.kind, size: f.data.byteLength });
        }
        const record = { ...fields, id, status: "pending", createdAt: new Date().toISOString(), files: stored } as T;
        const all = await read();
        all.push(record);
        await write(all);
        return record;
      }),
    list: async (status) => (await read()).filter((m) => !status || m.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    get: async (id) => (await read()).find((m) => m.id === id),
    setStatus: (id, status) =>
      locked(async () => {
        const all = await read();
        const m = all.find((x) => x.id === id);
        if (!m) return undefined;
        m.status = status;
        m.reviewedAt = new Date().toISOString();
        await write(all);
        return m;
      }),
    readFile: async (id, name) => {
      if (!/^[0-9a-f-]{36}$/.test(id) || !SAFE.test(name)) return undefined;
      try {
        return new Uint8Array(await readFile(path.join(uploads, id, name)));
      } catch {
        return undefined;
      }
    },
  };
}

export const store: Store<StoredMemory> = fileStore<StoredMemory>("memories");
export const familyStore: Store<StoredPerson> = fileStore<StoredPerson>("family");
