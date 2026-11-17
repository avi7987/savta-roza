import type { Memory } from "@/content/types";

/** the "worlds" the memories are grouped by, in the order the memories page shows them */
export const MEM_KINDS = ["words", "stories", "recipes", "photos", "media"] as const;
export type MemKind = (typeof MEM_KINDS)[number];

/** which world a memory belongs to, from what was chosen when it was shared (or, for older ones, what it holds) */
export function memKind(m: Pick<Memory, "type" | "mediaKind" | "photoSrc">): MemKind {
  if (m.type === "words") return "words";
  if (m.type === "recipe") return "recipes";
  if (m.mediaKind || m.type === "audio" || m.type === "video") return "media";
  if (m.type === "story" || m.type === "letter") return "stories";
  if (m.photoSrc) return "photos";
  return "stories";
}

/** shared with words, a recording or a video; photos alone (no words) live in the album */
export const isMemory = (m: Memory) => !!(m.body?.trim() || m.title?.trim() || m.mediaKind);

/** where "add one more" leads, already set to the right kind */
export const ADD_TYPE: Record<MemKind, string> = { words: "words", stories: "story", recipes: "recipe", photos: "photos", media: "audio" };
