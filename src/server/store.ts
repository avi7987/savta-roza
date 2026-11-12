import "server-only";

/**
 * Where submissions live. In production (Cloudflare) records go to D1 and files to R2;
 * in development they go to the local data/ folder. Both sit behind the same interface,
 * so the API routes do not change.
 */

export type Status = "pending" | "approved" | "rejected";

export type StoredFile = { name: string; kind: "image" | "video" | "audio"; size: number };

export type Base = { id: string; status: Status; files: StoredFile[]; createdAt: string; reviewedAt?: string };

export type StoredMemory = Base & {
  author: string;
  relation?: string;
  title?: string;
  body: string;
  lang: "he" | "ru";
  /** family-tree ids of the people in the attached photos */
  people?: string[];
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

export type NewFile = { data: Uint8Array; ext: string; kind: StoredFile["kind"] };

export interface Store<T extends Base> {
  create(fields: Omit<T, keyof Base>, files: NewFile[]): Promise<T>;
  list(status?: Status): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  setStatus(id: string, status: Status): Promise<T | undefined>;
  readFile(id: string, name: string): Promise<Uint8Array | undefined>;
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
    create: async (f, files) => (await b()).create(f, files),
    list: async (s) => (await b()).list(s),
    get: async (id) => (await b()).get(id),
    setStatus: async (id, s) => (await b()).setStatus(id, s),
    readFile: async (id, name) => (await b()).readFile(id, name),
  };
}

/* minimal shapes of the Cloudflare bindings we use */
export type D1Like = {
  prepare(sql: string): { bind(...v: unknown[]): { run(): Promise<unknown>; first<R>(): Promise<R | null>; all<R>(): Promise<{ results: R[] }> } };
};
export type R2Like = {
  put(key: string, value: Uint8Array, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
};

export const store: Store<StoredMemory> = lazy<StoredMemory>("memories");
export const familyStore: Store<StoredPerson> = lazy<StoredPerson>("family");
