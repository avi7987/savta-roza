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
    async create(fields, uploads: NewFile[], status = "pending") {
      const id = crypto.randomUUID();
      const stored: StoredFile[] = [];
      for (const f of uploads) {
        // file names are generated here; nothing the visitor typed becomes a storage key
        const name = `${crypto.randomUUID()}.${f.ext}`;
        await files.put(key(id, name), f.data, { httpMetadata: { contentType: TYPES[f.ext] } });
        let thumb: string | undefined;
        if (f.thumb) {
          thumb = `${crypto.randomUUID()}.jpg`;
          await files.put(key(id, thumb), f.thumb, { httpMetadata: { contentType: "image/jpeg" } });
        }
        stored.push({ name, kind: f.kind, size: f.data.byteLength, thumb, thumbSize: f.thumb?.byteLength, width: f.width, height: f.height, date: f.date, category: f.category, sha: f.sha, phash: f.phash });
      }
      const record = { ...fields, id, status, createdAt: new Date().toISOString(), files: stored } as T;
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
    async update(id, change) {
      const cur = await this.get(id);
      if (!cur) return undefined;
      const next = change(cur);
      await db.prepare("UPDATE records SET status = ?1, data = ?2 WHERE collection = ?3 AND id = ?4").bind(next.status, JSON.stringify(next), collection, id).run();
      return next;
    },
    async putFile(id, data, ext) {
      const name = `${crypto.randomUUID()}.${ext}`;
      await files.put(key(id, name), data, { httpMetadata: { contentType: TYPES[ext] } });
      return name;
    },
    async removeFile(id, name) {
      const cur = await this.get(id);
      const f = cur?.files.find((x) => x.name === name);
      if (!cur || !f) return 0;
      await files.delete([key(id, f.name), ...(f.thumb ? [key(id, f.thumb)] : [])]);
      const next = { ...cur, files: cur.files.filter((x) => x.name !== name) };
      await db.prepare("UPDATE records SET data = ?1 WHERE collection = ?2 AND id = ?3").bind(JSON.stringify(next), collection, id).run();
      return f.size + (f.thumbSize ?? 0);
    },
    async removeFiles(id) {
      const cur = await this.get(id);
      if (!cur || !cur.files.length) return 0;
      await files.delete(cur.files.flatMap((f) => [key(id, f.name), ...(f.thumb ? [key(id, f.thumb)] : [])]));
      const freed = cur.files.reduce((s, f) => s + f.size + (f.thumbSize ?? 0), 0);
      const next = { ...cur, files: [] };
      await db.prepare("UPDATE records SET data = ?1 WHERE collection = ?2 AND id = ?3").bind(JSON.stringify(next), collection, id).run();
      return freed;
    },
    async usedBytes() {
      const row = await db
        .prepare("SELECT COALESCE(SUM(json_extract(f.value, '$.size') + COALESCE(json_extract(f.value, '$.thumbSize'), 0)), 0) AS used FROM records, json_each(records.data, '$.files') AS f WHERE records.collection = ?1")
        .bind(collection)
        .first<{ used: number }>();
      return Number(row?.used ?? 0);
    },
    async getMeta(k) {
      const row = await db.prepare("SELECT value FROM meta WHERE key = ?1").bind(k).first<{ value: string }>();
      return row?.value;
    },
    async setMeta(k, v) {
      await db.prepare("INSERT INTO meta (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(k, v).run();
    },
    async readFile(id, name) {
      if (!/^[0-9a-f-]{36}$/.test(id) || !SAFE.test(name)) return undefined;
      const obj = await files.get(key(id, name));
      return obj ? new Uint8Array(await obj.arrayBuffer()) : undefined;
    },
  };
}
