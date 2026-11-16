import "server-only";
import { store } from "./store";

/**
 * How Rosa talked, as the family remembers it: words, pet names and sayings that were hers.
 * Written by the site's owner; the answers in her voice may use them, sparingly.
 */
const KEY = "rosa-voice";
export const VOICE_MAX = 2000;

export async function getVoice() {
  return (await store.getMeta(KEY).catch(() => undefined)) ?? "";
}

export async function setVoice(text: string) {
  const clean = text.replace(/[\u0000-\u0008\u000B-\u001F\u007F<>]/g, "").trim().slice(0, VOICE_MAX);
  await store.setMeta(KEY, clean);
  return clean;
}
