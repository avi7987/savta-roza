import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Base, Store, StoredFile } from "./store";


const ROOT = path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), "data"));
const SAFE = /^[a-z0-9-]+\.[a-z0-9]{2,4}$/;

let queue: Promise<unknown> = Promise.resolve();
/** serialize writes so two submissions never overwrite each other */
const locked = <R>(fn: () => Promise<R>): Promise<R> => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
};

/** Local-disk storage for development and self-hosting. */
export function fileStore<T extends Base>(collection: string): Store<T> {
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
          let thumb: string | undefined;
          if (f.thumb) {
            thumb = `${randomUUID()}.jpg`;
            await writeFile(path.join(dir, thumb), f.thumb);
          }
          stored.push({ name, kind: f.kind, size: f.data.byteLength, thumb, thumbSize: f.thumb?.byteLength, width: f.width, height: f.height, date: f.date, category: f.category, sha: f.sha, phash: f.phash });
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
    update: (id, change) =>
      locked(async () => {
        const all = await read();
        const i = all.findIndex((x) => x.id === id);
        if (i < 0) return undefined;
        all[i] = change(all[i]);
        await write(all);
        return all[i];
      }),
    putFile: async (id, data, ext) => {
      const name = `${randomUUID()}.${ext}`;
      const dir = path.join(uploads, id);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, name), data);
      return name;
    },
    removeFiles: (id) =>
      locked(async () => {
        const all = await read();
        const m = all.find((x) => x.id === id);
        if (!m || !m.files.length) return 0;
        const freed = m.files.reduce((s, f) => s + f.size + (f.thumbSize ?? 0), 0);
        await rm(path.join(uploads, id), { recursive: true, force: true });
        m.files = [];
        await write(all);
        return freed;
      }),
    usedBytes: async () => (await read()).reduce((s, m) => s + m.files.reduce((t, f) => t + f.size + (f.thumbSize ?? 0), 0), 0),
    getMeta: async (key) => {
      try {
        return (JSON.parse(await readFile(path.join(ROOT, "meta.json"), "utf8")) as Record<string, string>)[key];
      } catch {
        return undefined;
      }
    },
    setMeta: (key, value) =>
      locked(async () => {
        const file = path.join(ROOT, "meta.json");
        let meta: Record<string, string> = {};
        try {
          meta = JSON.parse(await readFile(file, "utf8"));
        } catch {}
        meta[key] = value;
        await mkdir(ROOT, { recursive: true });
        await writeFile(file, JSON.stringify(meta, null, 2));
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

