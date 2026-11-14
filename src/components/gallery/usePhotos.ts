"use client";

import { useEffect, useState } from "react";
import type { CategoryId, Photo } from "@/content/types";
import type { PhotoDate } from "@/lib/photoDate";
import { STATIC } from "../Transition";

type ApiPhoto = {
  id: string;
  kind: "image" | "video" | "audio";
  story?: string;
  lang?: "he" | "ru";
  notes?: Photo["notes"];
  src: string;
  full: string;
  poster?: string;
  ratio: number;
  date?: PhotoDate;
  year?: number;
  category?: CategoryId;
  people: string[];
  contributor: string;
  caption?: string;
  memoryId: string;
  file: string;
  removalRequested?: boolean;
};

const ALT = { he: "תמונה מהאלבום המשפחתי", ru: "Фотография из семейного альбома" };
const VIDEO_ALT = { he: "סרטון מהאלבום המשפחתי", ru: "Видео из семейного альбома" };
const AUDIO_ALT = { he: "הקלטה מהאלבום המשפחתי", ru: "Запись из семейного альбома" };

let cache: Photo[] | null = null;
let pending: Promise<Photo[]> | null = null;
const listeners = new Set<(p: Photo[]) => void>();

/** after a change (a date was added, a removal asked for), fetch again and update every view */
export function refreshPhotos() {
  cache = null;
  pending = null;
  load().then((p) => listeners.forEach((fn) => fn(p)));
}

function load(): Promise<Photo[]> {
  if (cache) return Promise.resolve(cache);
  if (STATIC) return Promise.resolve([]);
  pending ??= fetch("/api/photos")
    .then((r) => (r.ok ? r.json() : { photos: [] }))
    .then((d: { photos: ApiPhoto[] }) =>
      (cache = (d.photos ?? []).map((p) => ({
        id: p.id,
        src: p.src,
        full: p.full,
        kind: p.kind,
        ratio: p.ratio > 0.2 && p.ratio < 5 ? p.ratio : 4 / 3,
        alt: p.kind === "video" ? VIDEO_ALT : p.kind === "audio" ? AUDIO_ALT : ALT,
        story: p.story,
        storyLang: p.lang,
        notes: p.notes,
        caption: p.caption ? { he: p.caption, ru: p.caption } : undefined,
        when: p.date,
        year: p.year,
        category: p.category,
        people: p.people,
        contributor: p.contributor,
        memoryId: p.memoryId,
        file: p.file,
        removalRequested: p.removalRequested,
      })))
    )
    .catch(() => (cache = []));
  return pending;
}

/** The family's real, approved photos and videos (shared by the gallery, timeline and tree). */
export function usePhotos() {
  const [photos, setPhotos] = useState<Photo[]>(cache ?? []);
  const [loaded, setLoaded] = useState(!!cache);
  useEffect(() => {
    let alive = true;
    const fn = (p: Photo[]) => alive && setPhotos(p);
    listeners.add(fn);
    load().then((p) => {
      if (alive) {
        setPhotos(p);
        setLoaded(true);
      }
    });
    return () => {
      alive = false;
      listeners.delete(fn);
    };
  }, []);
  return { photos, loaded };
}
