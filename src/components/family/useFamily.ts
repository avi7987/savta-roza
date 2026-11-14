"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { family as seed } from "@/content/family";
import { FamilyGraph, expandRequest, mergePeople, type FamilyRequest, type TreePerson } from "@/lib/family";
import { useLang } from "@/lib/i18n";
import { STATIC } from "../Transition";
import { usePhotos } from "../gallery/usePhotos";

const LOCAL_KEY = "roza-family-local";
type LocalEntry = { id: string; req: FamilyRequest; at: string };

const readLocal = (): LocalEntry[] => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]");
  } catch {
    return [];
  }
};

/*
  The tree a visitor sees = the seed + approved additions from the server
  + what this visitor added themselves (shown as "waiting for approval"; in the
  preview build these are only kept in this browser).
*/
export function useFamily() {
  const { lang, t } = useLang();
  const [approved, setApproved] = useState<TreePerson[]>([]);
  const [local, setLocal] = useState<LocalEntry[]>([]);
  const { photos: real } = usePhotos();

  useEffect(() => {
    setLocal(readLocal());
    const sync = (e: StorageEvent) => e.key === LOCAL_KEY && setLocal(readLocal());
    window.addEventListener("storage", sync);
    if (!STATIC) {
      fetch("/api/family")
        .then((r) => (r.ok ? r.json() : { people: [] }))
        .then((d) => setApproved(d.people ?? []))
        .catch(() => {});
    }
    return () => window.removeEventListener("storage", sync);
  }, []);

  /** keep a request this visitor sent, so they see it in the tree straight away */
  const addLocal = useCallback((id: string, req: FamilyRequest) => {
    const next = [...readLocal(), { id, req, at: new Date().toISOString() }];
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    } catch {}
    setLocal(next);
  }, []);

  const graph = useMemo(() => {
    const approvedIds = new Set(approved.map((p) => p.id));
    const mine = local
      .filter((e) => !approvedIds.has(e.id))
      .flatMap((e) => expandRequest(e.req, e.id).map((p) => ({ ...p, pending: true })));
    return new FamilyGraph(mergePeople(mergePeople(seed, approved), mine));
  }, [approved, local]);

  const photos = useMemo(() => real.filter((p) => p.kind !== "audio"), [real]);

  const relLabel = useCallback(
    (id: string) => {
      const p = graph.byId.get(id);
      return t.family.rel[graph.relation(id)][p?.gender ?? "x"];
    },
    [graph, t]
  );

  const nameOf = useCallback(
    (id: string) => {
      const p = graph.byId.get(id);
      if (!p) return "";
      if (p.placeholder || !p.name) return relLabel(id);
      return lang === "ru" && p.nameAlt ? p.nameAlt : p.name;
    },
    [graph, lang, relLabel]
  );

  /** names for pickers: empty slots share a relation word, so number them */
  const optionLabel = useCallback(
    (ids: string[]) => {
      const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
      const counts = new Map<string, number>();
      ids.forEach((id) => counts.set(nameOf(id), (counts.get(nameOf(id)) ?? 0) + 1));
      const seen = new Map<string, number>();
      return new Map(
        ids.map((id) => {
          const base = nameOf(id);
          const n = (seen.get(base) ?? 0) + 1;
          seen.set(base, n);
          return [id, (counts.get(base) ?? 0) > 1 ? `${cap(base)} ${n}` : cap(base)];
        })
      );
    },
    [nameOf]
  );

  return { graph, photos, relLabel, nameOf, optionLabel, addLocal };
}
