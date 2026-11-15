import "server-only";
import { family as seed, ROSA } from "@/content/family";
import { FamilyGraph, expandRequest, mergePeople, type RequestKind } from "@/lib/family";
import { familyStore, store, type StoredMemory, type StoredPerson } from "./store";

/*
  The owner's corrections to the family tree. The tree is built from the requests people sent
  (each adds a person, and sometimes an empty slot for a parent who is not in the tree yet), so a
  correction changes the request behind a person. Ids never change, so tags on photos stay put.
*/

const MAIN = /^fam-([0-9a-f-]{36})$/;
const PLACES: RequestKind[] = ["child", "grandchild", "great", "partner", "sibling"];

export async function treeState() {
  const approved = await familyStore.list("approved");
  const graph = new FamilyGraph(mergePeople(seed, approved.flatMap((p) => expandRequest(p, `fam-${p.id}`))));
  return { approved, graph };
}

/** the request that made this person (if it was a request), and the latest one that filled in their details */
function backing(id: string, approved: StoredPerson[]) {
  const m = id.match(MAIN);
  const main = m ? approved.find((r) => r.id === m[1] && !r.replaces) : undefined;
  const fillers = approved.filter((r) => r.replaces === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { main, filler: fillers.at(-1), fillers };
}

/** ids a request brings into the tree: the person, and any empty slots made for their parents */
const madeBy = (r: StoredPerson) => (r.replaces ? [] : [`fam-${r.id}`, `fam-${r.id}-p`, `fam-${r.id}-gp`]);

/** other requests that hang from any of these ids (children, partners, details filled in) */
function dependents(ids: string[], approved: StoredPerson[], except?: string) {
  return approved.filter((r) => r.id !== except && [r.parentId, r.grandparentId, r.partnerOf, r.replaces].some((x) => x && ids.includes(x)));
}

export type TreeInfo = { relation: string; parentId?: string; partnerId?: string; editable: boolean; movable: boolean; deletable: boolean; blockers: string[] };

/** what the owner may do with each person, for the admin list */
export async function treeInfo() {
  const { approved, graph } = await treeState();
  const info: Record<string, TreeInfo> = {};
  for (const p of graph.people) {
    if (p.id === ROSA) continue;
    const { main, filler } = backing(p.id, approved);
    const deps = main ? dependents(madeBy(main), approved, main.id) : [];
    const blockers = deps.filter((d) => !d.replaces || d.replaces !== p.id).map((d) => graph.byId.get(d.replaces ?? `fam-${d.id}`)?.name || d.name).filter(Boolean);
    info[p.id] = {
      relation: graph.relation(p.id),
      parentId: graph.primaryParent(p.id),
      partnerId: graph.partnerOf(p.id)?.id,
      editable: true,
      movable: !!main && PLACES.includes(main.kind as RequestKind),
      deletable: !!main || !!filler,
      blockers,
    };
  }
  return { graph, info };
}

type Details = { name?: string; nameAlt?: string; gender?: string; born?: string; birthplace?: string };
type Place = { kind?: string; parentId?: string; partnerOf?: string };

const clean = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001F\u007F<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n) : undefined);

function details(d: Details) {
  const out: Partial<StoredPerson> = {};
  const name = clean(d.name, 80);
  if (name !== undefined) out.name = name;
  const alt = clean(d.nameAlt, 80);
  if (alt !== undefined) out.nameAlt = alt || undefined;
  if (d.gender === "f" || d.gender === "m" || d.gender === "x") out.gender = d.gender;
  const born = clean(d.born, 20);
  if (born !== undefined) out.born = born || undefined;
  const place = clean(d.birthplace, 80);
  if (place !== undefined) out.birthplace = place || undefined;
  return out;
}

/** everyone below this person (so nobody becomes their own ancestor) */
function below(graph: FamilyGraph, id: string) {
  const out = new Set<string>();
  const walk = (x: string) =>
    graph.people.forEach((p) => {
      if (p.parents?.includes(x) && !out.has(p.id)) {
        out.add(p.id);
        walk(p.id);
      }
    });
  walk(id);
  return out;
}

export async function editPerson(id: string, d: Details, place?: Place): Promise<{ ok: true } | { error: string; names?: string[] }> {
  const { approved, graph } = await treeState();
  if (!graph.byId.has(id) || id === ROSA) return { error: "not found" };
  const fields = details(d);
  if (fields.name !== undefined && fields.name.length < 1) return { error: "name" };
  const { main, filler } = backing(id, approved);

  let move: Partial<StoredPerson> | undefined;
  if (place?.kind) {
    if (!main || !PLACES.includes(main.kind as RequestKind) || !PLACES.includes(place.kind as RequestKind)) return { error: "place" };
    const kind = place.kind as RequestKind;
    const target = kind === "partner" ? place.partnerOf : place.parentId;
    const depthOf = (x?: string) => (x ? graph.depth(x) : null);
    if (kind === "grandchild" && depthOf(target) !== 1) return { error: "parent" };
    if (kind === "great" && (depthOf(target) ?? 0) < 2) return { error: "parent" };
    if (kind === "partner" && (!target || !graph.byId.has(target) || target === id)) return { error: "partner" };
    if (target && (target === id || below(graph, id).has(target))) return { error: "cycle" };
    // empty parent slots this request made disappear when it moves; nobody else may hang from them
    const slots = madeBy(main).slice(1);
    const deps = dependents(slots, approved, main.id);
    if (deps.length) return { error: "slots", names: deps.map((r) => r.name) };
    move = {
      kind,
      parentId: kind === "grandchild" || kind === "great" ? target : undefined,
      partnerOf: kind === "partner" ? target : undefined,
      parentName: undefined,
      parentGender: undefined,
      grandparentId: undefined,
      grandparentName: undefined,
      grandparentGender: undefined,
    };
  }

  if (main) {
    await familyStore.update(main.id, (cur) => ({ ...cur, ...fields, ...(move ?? {}) }));
    // details filled in later by someone else would override the correction, so they take it too
    for (const f of approved.filter((r) => r.replaces === id)) await familyStore.update(f.id, (cur) => ({ ...cur, ...fields }));
  } else if (filler) {
    await familyStore.update(filler.id, (cur) => ({ ...cur, ...fields }));
  } else {
    // a person from the starting tree, or an empty slot: the correction is kept as a filled-in entry
    const p = graph.byId.get(id)!;
    await familyStore.create({ replaces: id, name: fields.name ?? p.name, nameAlt: fields.nameAlt ?? p.nameAlt, gender: (fields.gender ?? p.gender) as StoredPerson["gender"], born: fields.born ?? p.born, birthplace: fields.birthplace ?? p.birthplace }, [], "approved");
  }
  return { ok: true };
}

const mentions = (m: StoredMemory, id: string) => !!m.people?.includes(id) || m.files.some((f) => f.people?.includes(id) || f.notes?.some((n) => n.people?.includes(id)));

/** carry a change to a person through every memory and photo that tags them (into = null removes the tag) */
export async function retagAll(from: string, into: string | null) {
  const swap = (list?: string[]) => {
    if (!list?.includes(from)) return list;
    const next = Array.from(new Set(list.map((x) => (x === from ? into : x)).filter((x): x is string => !!x)));
    return next.length ? next : undefined;
  };
  let changed = 0;
  for (const m of await store.list()) {
    if (!mentions(m, from)) continue;
    await store.update(m.id, (cur) => ({
      ...cur,
      people: swap(cur.people),
      files: cur.files.map((f) => ({ ...f, people: swap(f.people), notes: f.notes?.map((n) => ({ ...n, people: swap(n.people) })) })),
    }));
    changed++;
  }
  return changed;
}

/**
 * Takes a person out of the tree. Refused while others hang from them (their children or partner),
 * who should be moved or removed first. Tags of the person are removed from photos.
 */
export async function deletePerson(id: string): Promise<{ ok: true; changed: number } | { error: string; names?: string[] }> {
  const { approved, graph } = await treeState();
  if (!graph.byId.has(id) || id === ROSA) return { error: "not found" };
  const { main, fillers } = backing(id, approved);
  if (main) {
    const made = madeBy(main);
    const deps = dependents(made, approved, main.id).filter((r) => r.replaces !== id);
    if (deps.length) return { error: "dependents", names: deps.map((r) => r.name || graph.byId.get(r.replaces ?? "")?.name || "").filter(Boolean) };
    for (const r of [main, ...approved.filter((r) => r.replaces && made.includes(r.replaces))]) {
      await familyStore.setStatus(r.id, "rejected");
      await familyStore.removeFiles(r.id);
    }
    let changed = 0;
    for (const x of made) changed += await retagAll(x, null);
    return { ok: true, changed };
  }
  if (fillers.length) {
    // details someone filled in for a slot or a starting person: the place stays, the details go
    for (const r of fillers) {
      await familyStore.setStatus(r.id, "rejected");
      await familyStore.removeFiles(r.id);
    }
    return { ok: true, changed: 0 };
  }
  return { error: "fixed" };
}

