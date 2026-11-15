import { FATHER, HUSBAND, MOTHER, ROSA } from "@/content/family";
import type { Gender, Person, Photo } from "@/content/types";

export type RelKey = "self" | "spouse" | "parent" | "sibling" | "child" | "grandchild" | "great" | "partner" | "childInLaw" | "other";

/** A person as the tree shows them: may be waiting for approval, or only saved in this browser. */
export type TreePerson = Person & { pending?: boolean };

/**
 * A family tree built from a flat list of people. Every relation is derived, never typed in.
 * Links can be written on either side (a child lists its parents, or a parent lists the child it
 * was added for; partners on either side), so the graph first gathers them into one picture.
 * Parents nobody has named yet but who are implied (a sibling was added, Rosa's own parents) exist
 * as "virtual" people: they hold siblings together and are never drawn as cards.
 */
export class FamilyGraph {
  readonly byId = new Map<string, TreePerson>();
  readonly people: TreePerson[];
  private parentsMap = new Map<string, string[]>();
  private childrenMap = new Map<string, string[]>();
  private partnersMap = new Map<string, string[]>();
  private depthCache = new Map<string, number | null>();

  constructor(input: TreePerson[]) {
    const people = input.map((p) => ({ ...p }));
    people.forEach((p) => this.byId.set(p.id, p));
    const add = (m: Map<string, string[]>, k: string, v: string) => {
      if (k === v) return;
      const l = m.get(k) ?? [];
      if (!l.includes(v)) l.push(v);
      m.set(k, l);
    };
    const virtual = (id: string) => {
      if (this.byId.has(id)) return;
      const v: TreePerson = { id, name: "", gender: "x", placeholder: true, virtual: true };
      people.push(v);
      this.byId.set(id, v);
    };

    for (const p of people) for (const x of p.parents ?? []) add(this.parentsMap, p.id, x);
    for (const p of people) for (const c of p.children ?? []) if (this.byId.has(c)) add(this.parentsMap, c, p.id);
    // brothers and sisters share parents; if those are unknown, an unnamed pair stands in
    for (const p of people) {
      const s = p.siblingOf;
      if (!s || !this.byId.has(s) || s === p.id) continue;
      if (!(this.parentsMap.get(s) ?? []).length) {
        virtual(`v-${s}`);
        add(this.parentsMap, s, `v-${s}`);
      }
      for (const x of this.parentsMap.get(s)!) add(this.parentsMap, p.id, x);
    }
    // parents named by id but not (yet) in the tree, e.g. Rosa's parents before anyone adds them
    for (const [, list] of this.parentsMap) list.forEach(virtual);
    for (const [child, list] of this.parentsMap) for (const x of list) add(this.childrenMap, x, child);
    for (const p of people) for (const x of [p.partnerId, ...(p.partners ?? [])]) if (x && this.byId.has(x)) {
      add(this.partnersMap, p.id, x);
      add(this.partnersMap, x, p.id);
    }
    this.people = people;
  }

  get rosa() {
    return this.byId.get(ROSA)!;
  }

  parentsOf(id: string) {
    return this.parentsMap.get(id) ?? [];
  }
  /** parents with a name (or an empty slot someone can fill), not the implied unnamed ones */
  realParentsOf(id: string) {
    return this.parentsOf(id).filter((x) => !this.byId.get(x)?.virtual);
  }
  childrenOf(id: string) {
    return this.childrenMap.get(id) ?? [];
  }
  partnersOf(id: string) {
    return this.partnersMap.get(id) ?? [];
  }
  siblingsOf(id: string) {
    const out = new Set<string>();
    for (const par of this.parentsOf(id)) for (const c of this.childrenOf(par)) if (c !== id) out.add(c);
    return [...out];
  }

  /** the first partner (most people have one) */
  partnerOf(id: string) {
    const x = this.partnersOf(id)[0];
    return x ? this.byId.get(x) : undefined;
  }

  /** generations below Rosa: 1 = child, 2 = grandchild… ; null for anyone not descended from her */
  depth(id: string, guard = new Set<string>()): number | null {
    if (this.depthCache.has(id)) return this.depthCache.get(id)!;
    if (id === ROSA || this.partnersOf(ROSA).includes(id)) return 0;
    if (guard.has(id)) return null;
    guard.add(id);
    let best: number | null = null;
    for (const parent of this.parentsOf(id)) {
      const d = this.depth(parent, guard);
      if (d !== null && (best === null || d + 1 < best)) best = d + 1;
    }
    this.depthCache.set(id, best);
    return best;
  }

  /** the generation ring a person sits on: their own, or their partner's */
  ring(id: string): number | null {
    const d = this.depth(id);
    if (d !== null) return d;
    for (const x of this.partnersOf(id)) {
      const pd = this.depth(x);
      if (pd !== null) return pd;
    }
    return null;
  }

  /** how many generations below Rosa the tree currently has */
  get generations() {
    return this.people.reduce((m, p) => Math.max(m, this.depth(p.id) ?? 0), 0);
  }

  relation(id: string): RelKey {
    if (id === ROSA) return "self";
    if (this.partnersOf(ROSA).includes(id)) return "spouse";
    if (this.parentsOf(ROSA).includes(id)) return "parent";
    if (this.siblingsOf(ROSA).includes(id)) return "sibling";
    const d = this.depth(id);
    if (d === 1) return "child";
    if (d === 2) return "grandchild";
    if (d !== null && d >= 3) return "great";
    for (const x of this.partnersOf(id)) {
      const pd = this.depth(x);
      if (pd === 1) return "childInLaw";
      if (pd !== null && pd >= 2) return "partner";
    }
    return "other";
  }

  /** the parent through which someone hangs in the tree */
  primaryParent(id: string): string | undefined {
    return this.parentsOf(id).find((x) => this.depth(x) !== null);
  }

  /** which of Rosa's children this person's branch grows from */
  branchRoot(id: string): Person | undefined {
    let cur: string | undefined = this.depth(id) === null ? this.partnersOf(id).find((x) => this.depth(x) !== null) : id;
    while (cur && (this.depth(cur) ?? 0) > 1) cur = this.primaryParent(cur);
    return cur && this.depth(cur) === 1 ? this.byId.get(cur) : undefined;
  }

  /** descendants hanging directly under this person (Rosa and her partner count as one) */
  kids(id: string) {
    const parents = id === ROSA ? [ROSA, ...this.partnersOf(ROSA)] : [id];
    return this.people.filter((p) => {
      const pp = this.primaryParent(p.id);
      return pp && parents.includes(pp) && p.id !== ROSA;
    });
  }

  /** everyone on one generation ring (not their partners) */
  generation(n: number) {
    return this.people.filter((p) => !p.virtual && this.depth(p.id) === n);
  }

  roots() {
    const parents = this.parentsOf(ROSA).map((id) => this.byId.get(id)).filter((p): p is TreePerson => !!p && !p.virtual);
    const siblings = this.siblingsOf(ROSA).map((id) => this.byId.get(id)!).filter((p) => !p.virtual);
    return { parents, siblings };
  }

  /**
   * The row each person is drawn on: Rosa's generation is 0, her parents -1, her children 1.
   * Partners share a row, so in-laws and their own parents find their place too.
   */
  levels() {
    const level = new Map<string, number>();
    const visit = (start: string, at: number) => {
      const queue: [string, number][] = [[start, at]];
      while (queue.length) {
        const [id, l] = queue.shift()!;
        if (level.has(id)) continue;
        level.set(id, l);
        for (const x of this.partnersOf(id)) queue.push([x, l]);
        for (const x of this.childrenOf(id)) queue.push([x, l + 1]);
        for (const x of this.parentsOf(id)) queue.push([x, l - 1]);
      }
    };
    visit(ROSA, 0);
    // anyone not linked to Rosa at all still gets a row
    for (const p of this.people) if (!level.has(p.id)) visit(p.id, 0);
    return level;
  }
}

export const genderOf = (p?: Person): Gender => p?.gender ?? "x";

export function photosOf(photos: Photo[], id: string) {
  return photos.filter((p) => p.people?.includes(id));
}

export function photosTogether(photos: Photo[], id: string) {
  return photos.filter((p) => p.people?.includes(id) && p.people.includes(ROSA));
}

/* ---------- requests: "add a grandchild through a parent who isn't in the tree yet" ---------- */

export type RequestKind = "child" | "grandchild" | "great" | "partner" | "sibling" | "parent";

export type FamilyRequest = {
  kind?: RequestKind;
  /** fill in or update an existing person instead of adding a new one */
  replaces?: string;
  name: string;
  nameAlt?: string;
  gender: Gender;
  born?: string;
  birthplace?: string;
  about?: string;
  photoSrc?: string;
  /** grandchild / great-grandchild: the parent, if already in the tree… */
  parentId?: string;
  /** …or a new parent created with the request (name optional) */
  parentName?: string;
  parentGender?: Gender;
  /** great-grandchild whose parent is new: that parent's parent (one of Rosa's children) */
  grandparentId?: string;
  grandparentName?: string;
  grandparentGender?: Gender;
  partnerOf?: string;
  /** the newer, general way to place someone: their relation to any person already in the tree */
  rel?: LinkRel;
  of?: string;
  /** for a child: the other parent (one of the partners of `of`), if known */
  with?: string;
  died?: string;
};

export type LinkRel = "child" | "partner" | "parent" | "sibling";
export const LINK_RELS: LinkRel[] = ["child", "partner", "parent", "sibling"];

/**
 * Turn one request into the people it adds. Missing links are created as quiet slots,
 * so a grandchild added first immediately brings the parents' ring with it.
 */
export function expandRequest(req: FamilyRequest, baseId: string): TreePerson[] {
  const details = { name: req.name, nameAlt: req.nameAlt, gender: req.gender, born: req.born, died: req.died, birthplace: req.birthplace, about: req.about, photoSrc: req.photoSrc };
  if (req.replaces) return [{ id: req.replaces, ...details, placeholder: false }];

  if (req.rel && req.of) {
    switch (req.rel) {
      case "child":
        return [{ id: baseId, ...details, parents: [req.of, ...(req.with && req.with !== req.of ? [req.with] : [])] }];
      case "partner":
        return [{ id: baseId, ...details, partners: [req.of] }];
      case "parent":
        return [{ id: baseId, ...details, children: [req.of] }];
      case "sibling":
        return [{ id: baseId, ...details, siblingOf: req.of }];
    }
  }

  const out: TreePerson[] = [];
  const slot = (id: string, name: string | undefined, gender: Gender | undefined, parents: string[]): string => {
    out.push({ id, name: name ?? "", gender: gender ?? "x", parents, placeholder: !name });
    return id;
  };
  const children = [ROSA, HUSBAND];

  switch (req.kind) {
    case "child":
      out.push({ id: baseId, ...details, parents: children });
      break;
    case "grandchild": {
      const parent = req.parentId ?? slot(`${baseId}-p`, req.parentName, req.parentGender, children);
      out.push({ id: baseId, ...details, parents: [parent] });
      break;
    }
    case "great": {
      let parent = req.parentId;
      if (!parent) {
        const grand = req.grandparentId ?? slot(`${baseId}-gp`, req.grandparentName, req.grandparentGender, children);
        parent = slot(`${baseId}-p`, req.parentName, req.parentGender, [grand]);
      }
      out.push({ id: baseId, ...details, parents: [parent] });
      break;
    }
    case "partner":
      out.push({ id: baseId, ...details, partnerId: req.partnerOf });
      break;
    case "sibling":
      out.push({ id: baseId, ...details, parents: [MOTHER, FATHER] });
      break;
    case "parent":
      out.push({ id: req.gender === "m" ? FATHER : MOTHER, ...details, partnerId: req.gender === "m" ? MOTHER : FATHER });
      break;
  }
  return out;
}

/** Merge additions into the tree: a known id is updated in place, a new id is added. */
export function mergePeople(base: TreePerson[], additions: TreePerson[]) {
  const people = base.map((p) => ({ ...p }));
  const byId = new Map(people.map((p) => [p.id, p]));
  for (const a of additions) {
    const existing = byId.get(a.id);
    if (existing) {
      const clean = Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined && v !== ""));
      Object.assign(existing, clean, { placeholder: a.placeholder ?? false });
    } else {
      const p = { ...a };
      people.push(p);
      byId.set(p.id, p);
    }
  }
  return people;
}

/** the chain of people from someone up to Rosa, for highlighting */
export function pathToRosa(g: FamilyGraph, id: string) {
  const path = new Set<string>([id]);
  let cur: string | undefined = g.depth(id) === null ? g.partnerOf(id)?.id : id;
  if (cur) path.add(cur);
  while (cur && cur !== ROSA) {
    cur = g.primaryParent(cur);
    if (cur) path.add(cur);
    if (cur === g.rosa.partnerId) {
      path.add(ROSA);
      break;
    }
  }
  path.add(ROSA);
  return path;
}
