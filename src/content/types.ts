/**
 * Content models. Everything a family member might add lives here, separate from the UI.
 * `placeholder: true` marks structure waiting for real family content; the UI labels it as such
 * and never presents it as history.
 */
import type { PhotoDate } from "@/lib/photoDate";

export type Lang = "he" | "ru";
export type Localized = Record<Lang, string>;

export type Confidence = "exact" | "witness" | "estimate";

export type CategoryId = "family" | "childhood" | "celebrations" | "travel" | "moments" | "grandchildren";

export type Photo = {
  id: string;
  /** optimized display image (WebP/AVIF), relative to /public */
  src?: string;
  /** original resolution for the lightbox */
  full?: string;
  alt: Localized;
  caption?: Localized;
  /** display date, e.g. "1962" or "שנות ה־60"; omit when unknown */
  date?: Localized;
  /** sortable year when known */
  year?: number;
  category?: CategoryId;
  /** width / height of the original, so nothing is cropped and layout never shifts */
  ratio: number;
  /** editorial size in the gallery */
  size?: "feature" | "wide" | "tall" | "standard";
  contributor?: string;
  /** ids of the people in the photograph (see `family`) */
  people?: string[];
  /** uploaded media: video or photo, when it was taken and how we know */
  kind?: "image" | "video";
  when?: PhotoDate;
  memoryId?: string;
  /** stored file name within the memory (for dating and removal requests) */
  file?: string;
  removalRequested?: boolean;
  placeholder?: boolean;
};

export type Gender = "f" | "m" | "x";

/**
 * One person in the family tree. Relations to Rosa are worked out from `parents`
 * and `partnerId`, so nobody has to type "granddaughter" by hand.
 */
export type Person = {
  id: string;
  name: string;
  /** the same name in the other script, e.g. Cyrillic for a Hebrew name */
  nameAlt?: string;
  gender?: Gender;
  parents?: string[];
  partnerId?: string;
  /** optional full details, shown only when the person chose to add them */
  born?: string;
  birthplace?: string;
  died?: string;
  about?: string;
  photoSrc?: string;
  placeholder?: boolean;
};

export type StoryBlock =
  | { kind: "chapter"; id: string; number: number; kicker: Localized; title: Localized; body: Localized[]; photoIds: string[]; side: "start" | "end"; placeholder?: boolean }
  | { kind: "quote"; id: string; text: Localized; attribution?: Localized; placeholder?: boolean }
  | { kind: "photo"; id: string; photoId: string; placeholder?: boolean };

export type Milestone = {
  id: string;
  /** display year or range; omit when unknown */
  year?: Localized;
  title: Localized;
  summary: Localized;
  details?: Localized[];
  photoIds: string[];
  confidence?: Confidence;
  source?: Localized;
  placeholder?: boolean;
};

export type Memory = {
  id: string;
  author: string;
  relation?: string;
  title?: string;
  body: string;
  /** the language the memory was written in; the other language is shown as a translation */
  lang: Lang;
  translation?: string;
  photoId?: string;
  photoSrc?: string;
  mediaKind?: "video" | "audio";
  mediaSrc?: string;
  removalRequested?: boolean;
  createdAt: string;
  placeholder?: boolean;
};

export type Note = {
  id: string;
  kind: "quote" | "letter" | "note";
  text: Localized;
  from?: Localized;
  date?: Localized;
  placeholder?: boolean;
};

export type MediaItem = {
  id: string;
  kind: "video" | "audio";
  title: Localized;
  description: Localized;
  src?: string;
  posterId?: string;
  duration?: string;
  date?: Localized;
  /** automatic transcript lines, with timestamps in seconds */
  transcript?: { at: number; text: Localized }[];
  /** facts the transcript analysis proposed for the timeline (awaiting family approval) */
  findings?: { kind: "year" | "place" | "people"; label: Localized }[];
  placeholder?: boolean;
};

export type Profile = {
  name: Localized;
  kicker: Localized;
  dedication: Localized;
  intro: Localized;
  /** shown only when the family provides them */
  years?: Localized;
  /** Rosa's birth year, when known: lets photo estimates use her apparent age */
  birthYear?: number;
  portraitId: string;
  secondaryPortraitId?: string;
  closing: Localized;
};
