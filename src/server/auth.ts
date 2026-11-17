import "server-only";
import { timingSafeEqual } from "node:crypto";
import { setting } from "./notify";

/*
  The admin password. The owner chooses it in the admin page (kept only as a salted, slow hash, never
  as itself). The ADMIN_TOKEN set in Cloudflare's settings always works too: a way back in if the
  chosen one is forgotten. Many wrong tries from one place lock it out for a while.
*/
const PASS = "admin-pass";
export const MIN_PASSWORD = 6;
const ITER = 20000;

const enc = (s: string) => new TextEncoder().encode(s);
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
async function derive(pw: string, salt: string, iter: number) {
  const key = await crypto.subtle.importKey("raw", enc(pw), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc(salt), iterations: iter }, key, 256));
}
const same = (x: string, y: string) => {
  const a = Buffer.from(x);
  const b = Buffer.from(y);
  return a.length === b.length && timingSafeEqual(a, b);
};

const ipOf = (req: Request) => req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
const misses = new Map<string, number[]>();
const LOCK_WINDOW = 15 * 60 * 1000;
const LOCK_AFTER = 10; // wrong tries
const locked = (ip: string) => (misses.get(ip) ?? []).filter((t) => Date.now() - t < LOCK_WINDOW).length >= LOCK_AFTER;
// one try on the admin page sends a few requests at once: they count as one
const miss = (ip: string) => {
  const list = (misses.get(ip) ?? []).filter((t) => Date.now() - t < LOCK_WINDOW);
  if (!list.length || Date.now() - list[list.length - 1] > 3000) list.push(Date.now());
  misses.set(ip, list);
};

// the slow hash is worked out once per password for a while, not on every request of the admin page
const good = new Map<string, number>();

export async function isAdmin(req: Request) {
  const given = req.headers.get("x-admin-token") ?? "";
  if (!given) return false;
  const ip = ipOf(req);
  if (locked(ip)) return false;
  const saved = await readPassword();
  if (saved) {
    const key = `${saved.hash}:${given}`;
    if ((good.get(key) ?? 0) > Date.now()) return true;
    if (same(await derive(given, saved.salt, saved.iter), saved.hash)) {
      good.set(key, Date.now() + 30 * 60 * 1000);
      return true;
    }
  }
  // on Cloudflare this is a Worker secret; in development it comes from the environment
  const expected = await setting("ADMIN_TOKEN");
  if (expected && expected.length >= 12 && same(given, expected)) return true;
  miss(ip);
  return false;
}

/** too many wrong tries from here just now */
export const adminLocked = (req: Request) => locked(ipOf(req));

async function readPassword(): Promise<{ salt: string; hash: string; iter: number } | undefined> {
  try {
    const { store } = await import("./store");
    const v = JSON.parse((await store.getMeta(PASS)) ?? "null");
    return v && typeof v.hash === "string" && typeof v.salt === "string" ? { salt: v.salt, hash: v.hash, iter: Number(v.iter) || ITER } : undefined;
  } catch {
    return undefined;
  }
}

/** the owner's own password, from the admin page */
export async function setAdminPassword(pw: string) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const { store } = await import("./store");
  await store.setMeta(PASS, JSON.stringify({ salt, hash: await derive(pw, salt, ITER), iter: ITER }));
  good.clear();
}

const hits = new Map<string, number[]>();
/** A light per-visitor limit on submissions: at most `max` in `windowMs`. */
export function rateLimited(req: Request, max = 6, windowMs = 10 * 60 * 1000, bucket = "submit") {
  const ip = ipOf(req);
  const now = Date.now();
  const key = `${bucket}:${ip}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}
