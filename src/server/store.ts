import "server-only";

/**
 * Where submissions live. In production (Cloudflare) records go to D1 and files to R2;
 * in development they go to the local data/ folder. Both sit behind the same interface,
 * so the API routes do not change.
 */

export type Status = "pending" | "approved" | "rejected";

import type { PhotoDate } from "@/lib/photoDate";
import type { CategoryId } from "@/content/types";

export type StoredFile = {
  name: string;
  kind: "image" | "video" | "audio";
  size: number;
  /** a small JPEG preview stored next to the original */
  thumb?: string;
  thumbSize?: number;
  width?: number;
  height?: number;
  /** when it was taken, and how we know */
  date?: PhotoDate;
  category?: CategoryId;
  /** fingerprints for recognising the same photo twice (see lib/dedupe) */
  sha?: string;
  phash?: string;
  /** someone asked the owner to remove this file */
  deleteRequest?: DeleteRequest;
  /** last time the date estimate was tried (so it is retried later, not on every visit) */
  aiTriedAt?: string;
};

export type DeleteRequest = { at: string; reason?: string; by?: string };

export type Base = { id: string; status: Status; files: StoredFile[]; createdAt: string; reviewedAt?: string };

export type StoredMemory = Base & {
  author: string;
  relation?: string;
  title?: string;
  body: string;
  lang: "he" | "ru";
  /** family-tree ids of the people in the attached photos */
  people?: string[];
  /** someone asked the owner to remove this whole memory */
  deleteRequest?: DeleteRequest;
};

/** A family-tree request as submitted (see FamilyRequest in lib/family). */
export type StoredPerson = Base & {
  kind?: "child" | "grandchild" | "great" | "partner" | "sibling" | "parent";
  replaces?: string;
  name: string;
  nameAlt?: string;
  gender: "f" | "m" | "x";
  born?: string;
  birthplace?: string;
  about?: string;
  parentId?: string;
  parentName?: string;
  parentGender?: "f" | "m" | "x";
  grandparentId?: string;
  grandparentName?: string;
  grandparentGender?: "f" | "m" | "x";
  partnerOf?: string;
};

export type NewFile = {
  data: Uint8Array;
  ext: string;
  kind: StoredFile["kind"];
  thumb?: Uint8Array;
  width?: number;
  height?: number;
  date?: PhotoDate;
  category?: CategoryId;
  sha?: string;
  phash?: string;
};

export interface Store<T extends Base> {
  create(fields: Omit<T, keyof Base>, files: NewFile[], status?: Status): Promise<T>;
  /** delete one file of a record (and its preview); returns the bytes freed */
  removeFile(id: string, name: string): Promise<number>;
  list(status?: Status): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  setStatus(id: string, status: Status): Promise<T | undefined>;
  /** change a record (e.g. a photo's date after it was estimated) */
  update(id: string, change: (cur: T) => T): Promise<T | undefined>;
  /** store one more file for a record (e.g. a preview made later); returns its generated name */
  putFile(id: string, data: Uint8Array, ext: string): Promise<string>;
  readFile(id: string, name: string): Promise<Uint8Array | undefined>;
  /** delete a record's files (e.g. after it was rejected); returns the bytes freed */
  removeFiles(id: string): Promise<number>;
  /** total bytes of files this collection keeps */
  usedBytes(): Promise<number>;
  /** small key/value notes (e.g. when an alert was last sent) */
  getMeta(key: string): Promise<string | undefined>;
  setMeta(key: string, value: string): Promise<void>;
}


async function backend<T extends Base>(collection: string): Promise<Store<T>> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const e = env as unknown as { DB?: D1Like; FILES?: R2Like };
    if (e.DB && e.FILES) {
      const { cloudStore } = await import("./cloudStore");
      return cloudStore<T>(collection, e.DB, e.FILES);
    }
  } catch {
    /* not running on Cloudflare */
  }
  const { fileStore } = await import("./fileStore");
  return fileStore<T>(collection);
}

/** A store whose backend is chosen on first use. */
function lazy<T extends Base>(collection: string): Store<T> {
  let p: Promise<Store<T>> | null = null;
  const b = () => (p ??= backend<T>(collection));
  return {
    create: async (f, files, s) => (await b()).create(f, files, s),
    removeFile: async (id, n) => (await b()).removeFile(id, n),
    list: async (s) => (await b()).list(s),
    get: async (id) => (await b()).get(id),
    setStatus: async (id, s) => (await b()).setStatus(id, s),
    update: async (id, c) => (await b()).update(id, c),
    putFile: async (id, d, e) => (await b()).putFile(id, d, e),
    readFile: async (id, name) => (await b()).readFile(id, name),
    removeFiles: async (id) => (await b()).removeFiles(id),
    usedBytes: async () => (await b()).usedBytes(),
    getMeta: async (k) => (await b()).getMeta(k),
    setMeta: async (k, v) => (await b()).setMeta(k, v),
  };
}

/* minimal shapes of the Cloudflare bindings we use */
export type D1Like = {
  prepare(sql: string): { bind(...v: unknown[]): { run(): Promise<unknown>; first<R>(): Promise<R | null>; all<R>(): Promise<{ results: R[] }> } };
};
export type R2Like = {
  put(key: string, value: Uint8Array, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(keys: string | string[]): Promise<void>;
};

export const store: Store<StoredMemory> = lazy<StoredMemory>("memories");
export const familyStore: Store<StoredPerson> = lazy<StoredPerson>("family");

/** bytes used by every uploaded file, across memories and the family tree */
export async function storageUsed() {
  const [a, b] = await Promise.all([store.usedBytes(), familyStore.usedBytes()]);
  return a + b;
}
