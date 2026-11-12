import { ROSA } from "@/content/family";
import type { Gender, Person, Photo } from "@/content/types";

export type RelKey = "self" | "spouse" | "parent" | "sibling" | "child" | "grandchild" | "great" | "partner" | "childInLaw" | "other";

/** A family tree built from a flat list of people. Every relation is derived, never typed in. */
export class FamilyGraph {
  readonly byId = new Map<string, Person>();
  private depthCache = new Map<string, number | null>();

  constructor(readonly people: Person[]) {
    people.forEach((p) => this.byId.set(p.id, p));
  }

  get rosa() {
    return this.byId.get(ROSA)!;
  }

  partnerOf(id: string) {
    const p = this.byId.get(id);
    const direct = p?.partnerId ? this.byId.get(p.partnerId) : undefined;
    return direct ?? this.people.find((x) => x.partnerId === id);
  }

  /** generations below Rosa: 1 = child, 2 = grandchild… ; null for anyone not descended from her */
  depth(id: string, guard = new Set<string>()): number | null {
    if (this.depthCache.has(id)) return this.depthCache.get(id)!;
    if (id === ROSA || id === this.rosa.partnerId) return 0;
    if (guard.has(id)) return null;
    guard.add(id);
    const p = this.byId.get(id);
    let best: number | null = null;
    for (const parent of p?.parents ?? []) {
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
    const partner = this.partnerOf(id);
    return partner ? this.depth(partner.id) : null;
  }

  relation(id: string): RelKey {
    if (id === ROSA) return "self";
    if (this.rosa.partnerId === id) return "spouse";
    if (this.rosa.parents?.includes(id)) return "parent";
    const p = this.byId.get(id);
    if (p?.parents?.some((x) => this.rosa.parents?.includes(x))) return "sibling";
    const d = this.depth(id);
    if (d === 1) return "child";
    if (d === 2) return "grandchild";
    if (d !== null && d >= 3) return "great";
    const partner = this.partnerOf(id);
    if (partner) {
      const pd = this.depth(partner.id);
      if (pd === 1) return "childInLaw";
      if (pd !== null && pd >= 2) return "partner";
    }
    return "other";
  }

  /** the parent through which someone hangs in the tree */
  primaryParent(id: string): string | undefined {
    const p = this.byId.get(id);
    return p?.parents?.find((x) => this.depth(x) !== null);
  }

  /** which of Rosa's children this person's branch grows from */
  branchRoot(id: string): Person | undefined {
    let cur = this.depth(id) === null ? this.partnerOf(id)?.id : id;
    while (cur && (this.depth(cur) ?? 0) > 1) cur = this.primaryParent(cur);
    return cur && this.depth(cur) === 1 ? this.byId.get(cur) : undefined;
  }

  /** descendants hanging directly under this person (Rosa and her partner count as one) */
  kids(id: string) {
    const parents = id === ROSA ? [ROSA, this.rosa.partnerId] : [id];
    return this.people.filter((p) => {
      const pp = this.primaryParent(p.id);
      return pp && parents.includes(pp) && p.id !== ROSA;
    });
  }

  roots() {
    const parents = (this.rosa.parents ?? []).map((id) => this.byId.get(id)).filter(Boolean) as Person[];
    const siblings = this.people.filter((p) => p.id !== ROSA && this.relation(p.id) === "sibling");
    return { parents, siblings };
  }
}

export const genderOf = (p?: Person): Gender => p?.gender ?? "x";

export function photosOf(photos: Photo[], id: string) {
  return photos.filter((p) => p.people?.includes(id));
}

export function photosTogether(photos: Photo[], id: string) {
  return photos.filter((p) => p.people?.includes(id) && p.people.includes(ROSA));
}

/* ---------- radial layout: Rosa in the middle, a ring per generation ---------- */

export type PlacedNode = { id: string; x: number; y: number; ring: number; angle: number };
type Pt = { x: number; y: number };
export type Edge = { from: Pt; to: Pt; c1: Pt; c2: Pt; childId: string; parentId: string };

/** ring radii as a share of the half-width */
export const RINGS = [0, 0.4, 0.68, 0.93];

export function radialLayout(g: FamilyGraph, rtl: boolean) {
  const nodes = new Map<string, PlacedNode>();
  const edges: Edge[] = [];
  const pol = (r: number, a: number) => ({ x: 0.5 + (r / 2) * Math.cos(a), y: 0.5 + (r / 2) * Math.sin(a) });

  const slots = (id: string) => 1 + (g.partnerOf(id) && g.depth(g.partnerOf(id)!.id) === null ? 1 : 0);
  const span = (id: string): number => Math.max(slots(id), g.kids(id).reduce((s, k) => s + span(k.id), 0));

  // centre: Rosa and her partner side by side (Rosa on the reading side)
  const off = 0.07;
  nodes.set(ROSA, { id: ROSA, x: 0.5 + (rtl ? off : -off), y: 0.5, ring: 0, angle: 0 });
  if (g.rosa.partnerId) nodes.set(g.rosa.partnerId, { id: g.rosa.partnerId, x: 0.5 + (rtl ? -off : off), y: 0.5, ring: 0, angle: 0 });

  const top = g.kids(ROSA);
  const total = top.reduce((s, k) => s + span(k.id), 0) || 1;
  // leave an opening at the top, where the roots row joins Rosa
  const GAP = 0.55;
  const unit = (Math.PI * 2 - GAP) / total;
  const dir = rtl ? -1 : 1;

  const place = (id: string, start: number, parentPt: Pt, parentR: number, parentA: number, parentId: string) => {
    const ring = g.depth(id) ?? 1;
    const r = RINGS[Math.min(ring, RINGS.length - 1)];
    const width = span(id) * unit;
    const mid = start + width / 2;
    const partner = g.partnerOf(id);
    const pairSep = partner && g.depth(partner.id) === null ? Math.min(unit * 0.5, 0.16 / r) : 0;
    const a = -Math.PI / 2 + dir * (GAP / 2 + mid - pairSep);
    const pt = pol(r, a);
    nodes.set(id, { id, ...pt, ring, angle: a });
    if (pairSep) {
      const pa = -Math.PI / 2 + dir * (GAP / 2 + mid + pairSep);
      nodes.set(partner!.id, { id: partner!.id, ...pol(r, pa), ring, angle: pa });
    }
    // a stem leaves the parent outward, then turns into the child's own direction
    const bend = parentR + (r - parentR) * 0.55;
    const c1 = parentR === 0 ? pol(r * 0.25, a) : pol(bend, parentA);
    const c2 = pol(bend, a);
    edges.push({ from: parentPt, to: pt, c1, c2, childId: id, parentId });
    let s = start;
    for (const k of g.kids(id)) {
      place(k.id, s, pt, r, a, id);
      s += span(k.id) * unit;
    }
  };

  let s = 0;
  for (const k of top) {
    place(k.id, s, { x: 0.5, y: 0.5 }, 0, 0, ROSA);
    s += span(k.id) * unit;
  }
  return { nodes, edges };
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
