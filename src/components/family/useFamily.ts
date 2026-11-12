"use client";

import { useEffect, useMemo, useState } from "react";
import { family as seed } from "@/content/family";
import { photos as seedPhotos } from "@/content";
import type { Person, Photo } from "@/content/types";
import { FamilyGraph } from "@/lib/family";
import { useLang } from "@/lib/i18n";
import { STATIC } from "../Transition";

type Addition = Person & { relationType?: "child" | "partner" | "sibling" | "parent"; to?: string; replaces?: string };

/** Fold approved additions into the tree: fill an empty slot, or hang a new person in the right place. */
function merge(base: Person[], additions: Addition[]) {
  const people = base.map((p) => ({ ...p }));
  const byId = new Map(people.map((p) => [p.id, p]));
  for (const a of additions) {
    if (a.replaces && byId.has(a.replaces)) {
      Object.assign(byId.get(a.replaces)!, { ...a, id: a.replaces, placeholder: false });
      continue;
    }
    const target = a.to ? byId.get(a.to) : undefined;
    const p: Person = { ...a, placeholder: false };
    if (target) {
      if (a.relationType === "child") p.parents = [target.id, ...(target.partnerId ? [target.partnerId] : [])];
      if (a.relationType === "partner") {
        p.partnerId = target.id;
        if (!target.partnerId) target.partnerId = p.id;
      }
      if (a.relationType === "sibling") p.parents = target.parents;
      if (a.relationType === "parent") target.parents = [...(target.parents ?? []), p.id];
    }
    people.push(p);
    byId.set(p.id, p);
  }
  return people;
}

/** Tagged photos uploaded with approved memories join the album photos. */
type ApprovedMemory = { id: string; photoSrc?: string; people?: string[]; author: string };

export function useFamily() {
  const { lang, t } = useLang();
  const [additions, setAdditions] = useState<Addition[]>([]);
  const [memoryPhotos, setMemoryPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    if (STATIC) return;
    fetch("/api/family")
      .then((r) => (r.ok ? r.json() : { people: [] }))
      .then((d) => setAdditions(d.people ?? []))
      .catch(() => {});
    fetch("/api/memories")
      .then((r) => (r.ok ? r.json() : { memories: [] }))
      .then((d: { memories: ApprovedMemory[] }) =>
        setMemoryPhotos(
          (d.memories ?? [])
            .filter((m) => m.photoSrc && m.people?.length)
            .map((m) => ({ id: `mem-${m.id}`, src: m.photoSrc, full: m.photoSrc, ratio: 4 / 3, people: m.people, contributor: m.author, alt: { he: "תמונה מזיכרון", ru: "Фото из воспоминания" } }))
        )
      )
      .catch(() => {});
  }, []);

  const graph = useMemo(() => new FamilyGraph(merge(seed, additions)), [additions]);
  const photos = useMemo(() => [...seedPhotos, ...memoryPhotos], [memoryPhotos]);

  const relLabel = (id: string) => {
    const p = graph.byId.get(id);
    return t.family.rel[graph.relation(id)][p?.gender ?? "x"];
  };

  const nameOf = (id: string) => {
    const p = graph.byId.get(id);
    if (!p) return "";
    if (p.placeholder || !p.name) return relLabel(id);
    return lang === "ru" && p.nameAlt ? p.nameAlt : p.name;
  };

  return { graph, photos, relLabel, nameOf };
}
