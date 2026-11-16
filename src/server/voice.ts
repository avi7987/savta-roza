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

/**
 * Everything known about how she talked, for the answers: what the owner wrote, and the words the
 * family shared as "her words" (newest first), within a sensible length.
 */
/** each thing she used to say, on its own (a line the owner wrote, or a line a family member shared) */
export async function voicePhrases() {
  const own = (await getVoice()).split(/\n+/).map((x) => x.trim()).filter(Boolean);
  const shared = (await store.list().catch(() => []))
    .filter((m) => m.type === "words" && m.status !== "rejected" && m.body.trim())
    .flatMap((m) => m.body.split(/\n+/).map((x) => x.trim()).filter(Boolean).map((x) => (m.title ? `${x} (${m.title})` : x)));
  return Array.from(new Set([...own, ...shared])).slice(0, 200);
}

/**
 * At most one of her expressions for one answer, and only in some answers, so her words feel like
 * her and not like a habit: a random pick, about two answers in five.
 */
export async function phraseForAnswer() {
  const all = await voicePhrases();
  if (!all.length || Math.random() > 0.4) return undefined;
  return all[Math.floor(Math.random() * all.length)];
}

export async function voiceForAnswers() {
  const own = await getVoice();
  const shared = (await store.list().catch(() => []))
    .filter((m) => m.type === "words" && m.status !== "rejected" && m.body.trim())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((m) => `${m.body.trim()}${m.title ? ` (${m.title})` : ""}`);
  return [own, ...shared].filter(Boolean).join("\n").slice(0, 3000);
}

export async function setVoice(text: string) {
  const clean = text.replace(/[\u0000-\u0008\u000B-\u001F\u007F<>]/g, "").trim().slice(0, VOICE_MAX);
  await store.setMeta(KEY, clean);
  return clean;
}
