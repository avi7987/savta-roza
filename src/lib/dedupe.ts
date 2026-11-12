/**
 * Recognising the same photo twice.
 *  sha   – fingerprint of the exact file: identical bytes, identical photo
 *  phash – fingerprint of what the picture looks like (a 64-bit difference hash):
 *          survives resizing, re-saving and WhatsApp compression
 */

export const isSha = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
export const isPhash = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{16}$/.test(v);

/** how many of the 64 bits differ */
export function hamming(a: string, b: string) {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x) {
    n += Number(x & BigInt(1));
    x >>= BigInt(1);
  }
  return n;
}

/** close enough to be the same picture (allows for compression, small crops and colour shifts) */
export const SIMILAR = 6;

export type Fingerprint = { sha?: string; phash?: string };
export type Match = "exact" | "similar";

export function compare(a: Fingerprint, b: Fingerprint): Match | null {
  if (a.sha && b.sha && a.sha === b.sha) return "exact";
  if (a.phash && b.phash && hamming(a.phash, b.phash) <= SIMILAR) return "similar";
  return null;
}
