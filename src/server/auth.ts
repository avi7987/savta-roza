import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Moderators sign in with the ADMIN_TOKEN set in the server environment. It is never sent to the browser bundle. */
export function isAdmin(req: Request) {
  const expected = process.env.ADMIN_TOKEN;
  const given = req.headers.get("x-admin-token") ?? "";
  if (!expected || expected.length < 12) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const hits = new Map<string, number[]>();
/** A light per-visitor limit on submissions: at most `max` in `windowMs`. */
export function rateLimited(req: Request, max = 6, windowMs = 10 * 60 * 1000) {
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > max;
}
