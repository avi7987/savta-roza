import { FATHER, HUSBAND, MOTHER, ROSA } from "@/content/family";
import type { Gender, Person, Photo } from "@/content/types";

export type RelKey = "self" | "spouse" | "parent" | "sibling" | "child" | "grandchild" | "great" | "partner" | "childInLaw" | "other";

/** A person as the tree shows them: may be waiting for approval, or only saved in this browser. */
export type TreePerson = Person & { pending?: boolean };

/** A family tree built from a flat list of people. Every relation is derived, never typed in. */
export class FamilyGraph {
  readonly byId = new Map<string, TreePerson>();
  private depthCache = new Map<string, number | null>();

  constructor(readonly people: TreePerson[]) {
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

  /** how many generation rings the tree currently needs */
  get generations() {
    return this.people.reduce((m, p) => Math.max(m, this.depth(p.id) ?? 0), 0);
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

  /** everyone on one generation ring (not their partners) */
  generation(n: number) {
    return this.people.filter((p) => this.depth(p.id) === n);
  }

  roots() {
    const parents = (this.rosa.parents ?? []).map((id) => this.byId.get(id)).filter(Boolean) as TreePerson[];
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
};

/**
 * Turn one request into the people it adds. Missing links are created as quiet slots,
 * so a grandchild added first immediately brings the parents' ring with it.
 */
export function expandRequest(req: FamilyRequest, baseId: string): TreePerson[] {
  const details = { name: req.name, nameAlt: req.nameAlt, gender: req.gender, born: req.born, birthplace: req.birthplace, about: req.about, photoSrc: req.photoSrc };
  if (req.replaces) return [{ id: req.replaces, ...details, placeholder: false }];

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

/* ---------- radial layout: Rosa in the middle, one ring per generation that exists ---------- */

type Pt = { x: number; y: number };
export type PlacedNode = { id: string; x: number; y: number; ring: number; angle: number };
export type Edge = { from: Pt; to: Pt; c1: Pt; c2: Pt; childId: string; parentId: string };

/** ring radii (share of the half-width), spread evenly over however many generations exist */
export function ringRadii(generations: number) {
  if (generations <= 0) return [0];
  const inner = generations === 1 ? 0.58 : 0.4;
  const outer = 0.93;
  return [0, ...Array.from({ length: generations }, (_, i) => (generations === 1 ? inner : inner + ((outer - inner) * i) / (generations - 1)))];
}

export function radialLayout(g: FamilyGraph, rtl: boolean) {
  const rings = ringRadii(g.generations);
  const nodes = new Map<string, PlacedNode>();
  const edges: Edge[] = [];
  const pol = (r: number, a: number) => ({ x: 0.5 + (r / 2) * Math.cos(a), y: 0.5 + (r / 2) * Math.sin(a) });

  const slots = (id: string) => 1 + (g.partnerOf(id) && g.depth(g.partnerOf(id)!.id) === null ? 1 : 0);
  const span = (id: string): number => Math.max(slots(id), g.kids(id).reduce((s, k) => s + span(k.id), 0));

  // centre: Rosa and her partner side by side (Rosa on the reading side); the drawing is
  // smaller while the tree is young, so they sit further apart then
  const off = [0.12, 0.095, 0.075, 0.07][Math.min(g.generations, 3)];
  nodes.set(ROSA, { id: ROSA, x: 0.5 + (rtl ? off : -off), y: 0.5, ring: 0, angle: 0 });
  if (g.rosa.partnerId && g.byId.has(g.rosa.partnerId)) nodes.set(g.rosa.partnerId, { id: g.rosa.partnerId, x: 0.5 + (rtl ? -off : off), y: 0.5, ring: 0, angle: 0 });

  const top = g.kids(ROSA);
  const total = top.reduce((s, k) => s + span(k.id), 0) || 1;
  // the family hangs downward from Rosa (her roots are above) and fans out as it grows,
  // closing into a full circle only when there are many branches; the top stays open for the roots
  const sweep = Math.min(Math.PI * 2 - 0.55, total * 1.05);
  const unit = sweep / total;
  const dir = rtl ? -1 : 1;
  const angleAt = (m: number) => Math.PI / 2 + dir * (m - sweep / 2);

  const place = (id: string, start: number, parentPt: Pt, parentR: number, parentA: number, parentId: string) => {
    const ring = g.depth(id) ?? 1;
    const r = rings[Math.min(ring, rings.length - 1)];
    const width = span(id) * unit;
    const mid = start + width / 2;
    const partner = g.partnerOf(id);
    const pairSep = partner && g.depth(partner.id) === null ? Math.min(unit * 0.5, 0.16 / r) : 0;
    const a = angleAt(mid - pairSep);
    const pt = pol(r, a);
    nodes.set(id, { id, ...pt, ring, angle: a });
    if (pairSep) {
      const pa = angleAt(mid + pairSep);
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
  // the arc each ring actually needs, a little wider than the people on it
  const pad = 0.22;
  const full = sweep + 2 * pad >= Math.PI * 2 - 0.3;
  const arc = full ? null : { from: angleAt(-pad), to: angleAt(sweep + pad) };

  // crop the drawing to what is there, so a young tree is not lost in an empty circle
  const pts: Pt[] = [...nodes.values()];
  rings.slice(1).forEach((r) => {
    for (let i = 0; i <= 24; i++) {
      const a = arc ? arc.from + ((arc.to - arc.from) * i) / 24 : (Math.PI * 2 * i) / 24;
      pts.push(pol(r, a));
    }
  });
  const m = 0.07;
  const minX = Math.max(0, Math.min(...pts.map((p) => p.x)) - m);
  const maxX = Math.min(1, Math.max(...pts.map((p) => p.x)) + m);
  const minY = Math.max(0, Math.min(...pts.map((p) => p.y)) - m);
  const maxY = Math.min(1, Math.max(...pts.map((p) => p.y)) + m * 1.4);
  const bounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

  return { nodes, edges, rings, arc, bounds };
}

/** an SVG path along a ring between two angles (or the whole ring) */
export function ringPath(r: number, arc: { from: number; to: number } | null) {
  const steps = 72;
  const pts = Array.from({ length: steps + 1 }, (_, i) => {
    const a = arc ? arc.from + ((arc.to - arc.from) * i) / steps : (Math.PI * 2 * i) / steps;
    return `${(50 + r * 50 * Math.cos(a)).toFixed(2)} ${(50 + r * 50 * Math.sin(a)).toFixed(2)}`;
  });
  return `M ${pts.join(" L ")}${arc ? "" : " Z"}`;
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
