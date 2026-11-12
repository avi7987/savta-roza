import type { Base, D1Like, NewFile, R2Like, Status, Store, StoredFile } from "./store";

const SAFE = /^[a-z0-9-]+\.[a-z0-9]{2,4}$/;
const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg" };

type Row = { data: string };

/**
 * Cloudflare storage: one D1 table holds every record as JSON (indexed by collection and
 * status), and the files sit in R2 under collection/id/generated-name.
 */
export function cloudStore<T extends Base>(collection: string, db: D1Like, files: R2Like): Store<T> {
  const key = (id: string, name: string) => `${collection}/${id}/${name}`;
  const parse = (r: Row | null) => (r ? (JSON.parse(r.data) as T) : undefined);

  return {
    async create(fields, uploads: NewFile[]) {
      const id = crypto.randomUUID();
      const stored: StoredFile[] = [];
      for (const f of uploads) {
        // file names are generated here; nothing the visitor typed becomes a storage key
        const name = `${crypto.randomUUID()}.${f.ext}`;
        await files.put(key(id, name), f.data, { httpMetadata: { contentType: TYPES[f.ext] } });
        stored.push({ name, kind: f.kind, size: f.data.byteLength });
      }
      const record = { ...fields, id, status: "pending", createdAt: new Date().toISOString(), files: stored } as T;
      await db
        .prepare("INSERT INTO records (collection, id, status, created_at, data) VALUES (?1, ?2, ?3, ?4, ?5)")
        .bind(collection, id, record.status, record.createdAt, JSON.stringify(record))
        .run();
      return record;
    },
    async list(status?: Status) {
      const q = status
        ? db.prepare("SELECT data FROM records WHERE collection = ?1 AND status = ?2 ORDER BY created_at DESC").bind(collection, status)
        : db.prepare("SELECT data FROM records WHERE collection = ?1 ORDER BY created_at DESC").bind(collection);
      const { results } = await q.all<Row>();
      return results.map((r) => JSON.parse(r.data) as T);
    },
    async get(id) {
      return parse(await db.prepare("SELECT data FROM records WHERE collection = ?1 AND id = ?2").bind(collection, id).first<Row>());
    },
    async setStatus(id, status) {
      const cur = await this.get(id);
      if (!cur) return undefined;
      const next = { ...cur, status, reviewedAt: new Date().toISOString() };
      await db.prepare("UPDATE records SET status = ?1, data = ?2 WHERE collection = ?3 AND id = ?4").bind(status, JSON.stringify(next), collection, id).run();
      return next;
    },
    async readFile(id, name) {
      if (!/^[0-9a-f-]{36}$/.test(id) || !SAFE.test(name)) return undefined;
      const obj = await files.get(key(id, name));
      return obj ? new Uint8Array(await obj.arrayBuffer()) : undefined;
    },
  };
}
