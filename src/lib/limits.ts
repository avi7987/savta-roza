/** Upload rules shared by the form (for friendly messages) and the server (which enforces them). */
export const LIMITS = {
  maxFiles: 10,
  /** what is stored, after the browser made photos and videos smaller */
  imageMB: 25,
  videoMB: 95,
  audioMB: 30,
  name: 80,
  relation: 60,
  title: 120,
  body: 6000,
} as const;

export const ACCEPT = {
  image: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
  video: ["video/mp4", "video/quicktime", "video/webm"],
  audio: ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm"],
} as const;

export type MediaKind = keyof typeof ACCEPT;

export function kindOf(mime: string): MediaKind | null {
  for (const k of Object.keys(ACCEPT) as MediaKind[]) if ((ACCEPT[k] as readonly string[]).includes(mime)) return k;
  return null;
}

/** what may be picked: bigger, because the browser makes it smaller before sending */
export const PICK_MB = { image: 60, video: 2000, audio: 30 } as const;
/** Cloudflare's free plan takes at most 100MB in one request */
export const SEND_MB = 95;

export function maxBytes(kind: MediaKind) {
  const mb = kind === "image" ? LIMITS.imageMB : kind === "video" ? LIMITS.videoMB : LIMITS.audioMB;
  return mb * 1024 * 1024;
}

export const acceptAttr = [...ACCEPT.image, ...ACCEPT.video, ...ACCEPT.audio].join(",");

/** Which script a text is mostly written in, so the site can offer a translation. */
export function detectLang(text: string): "he" | "ru" {
  const he = (text.match(/[֐-׿]/g) ?? []).length;
  const ru = (text.match(/[Ѐ-ӿ]/g) ?? []).length;
  return ru > he ? "ru" : "he";
}
