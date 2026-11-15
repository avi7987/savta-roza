import { ROSA } from "@/content/family";
import type { FamilyGraph } from "./family";

/*
  Where every card goes, worked out from the relationships alone (nothing is placed by hand).

  Each generation is one row. A person and their partners form a unit; children hang below the
  couple they belong to (a child of a second marriage hangs below that marriage). Units are laid
  out from the top of Rosa's family downwards, each taking the width its descendants need, so
  nothing overlaps and lines do not cross. People outside that line (an in-law's parents, say) are
  placed next to their relatives in the nearest free space, without moving anyone else.

  Same data in, same picture out: brothers and sisters are ordered by birth year, then by the order
  they were added, so a new person slides into place and the rest of the tree stays where it was.
*/

export type LayoutOptions = { cardW: number; cardH: number; gap: number; coupleGap: number; rowGap: number; collapsed?: Set<string>; rtl?: boolean };
export type PlacedCard = { id: string; x: number; y: number; level: number; hidden: number };
export type Junction = { id: string; x: number; y: number };
export type Connector = { id: string; d: string; kind: "couple" | "child"; people: string[] };
export type FamilyLayout = { cards: PlacedCard[]; junctions: Junction[]; connectors: Connector[]; width: number; height: number; rows: { level: number; y: number }[] };

const yearOf = (s?: string) => {
  const m = s?.match(/(1[89]\d\d|20\d\d)/);
  return m ? Number(m[1]) : Infinity;
};

export function layoutFamily(g: FamilyGraph, o: LayoutOptions): FamilyLayout {
  const { cardW: W, cardH: H, gap: GX, coupleGap: CG, rowGap: RG } = o;
  const collapsed = o.collapsed ?? new Set<string>();
  const order = new Map(g.people.map((p, i) => [p.id, i]));
  const levels = g.levels();
  // the top row is the oldest generation that has a card (unnamed parents above it take no room)
  const minLevel = Math.min(...g.people.filter((p) => !p.virtual).map((p) => levels.get(p.id) ?? 0));
  const rowY = (id: string) => ((levels.get(id) ?? 0) - minLevel) * (H + RG);
  const isVirtual = (id: string) => !!g.byId.get(id)?.virtual;
  const byAge = (a: string, b: string) => yearOf(g.byId.get(a)?.born) - yearOf(g.byId.get(b)?.born) || order.get(a)! - order.get(b)!;

  const x = new Map<string, number>(); // left edge of each placed card (virtual people included)
  const placed = (id: string) => x.has(id);

  /* ---------- the units, top-down ---------- */

  type Unit = { members: string[]; groups: { anchor: string[]; kids: string[] }[] };
  /** people who stand together without being recorded as partners (Rosa's two parents) */
  const extraPartners = new Map<string, string[]>();

  const descendantsOf = (id: string, seen = new Set<string>()) => {
    for (const c of g.childrenOf(id)) {
      if (seen.has(c)) continue;
      seen.add(c);
      descendantsOf(c, seen);
    }
    return seen;
  };

  /** who stands together (the person and their partners) and which children hang below whom */
  const unitOf = (main: string, taken: Set<string>): Unit => {
    const partners = [...g.partnersOf(main), ...(extraPartners.get(main) ?? [])]
      .filter((p, i, all) => all.indexOf(p) === i && !taken.has(p))
      .sort((a, b) => order.get(a)! - order.get(b)!);
    const members = partners.length === 2 ? [partners[0], main, partners[1]] : [main, ...partners];
    const groups: Unit["groups"] = [];
    const claimed = new Set<string>();
    const kids = (filter: (c: string) => boolean) =>
      g
        .childrenOf(main)
        .concat(...partners.map((p) => g.childrenOf(p)))
        .filter((c, i, all) => all.indexOf(c) === i && !claimed.has(c) && !taken.has(c) && filter(c))
        .sort(byAge);
    if (!collapsed.has(main)) {
      // children of the main person with each partner, in the order the cards stand
      for (const p of members) {
        if (p === main) continue;
        const list = kids((c) => g.parentsOf(c).includes(main) && g.parentsOf(c).includes(p));
        list.forEach((c) => claimed.add(c));
        if (list.length) groups.push({ anchor: [main, p], kids: list });
      }
      // a partner's children from another relationship, below that partner
      for (const p of members) {
        if (p === main) continue;
        const list = kids((c) => g.parentsOf(c).includes(p) && !g.parentsOf(c).includes(main));
        list.forEach((c) => claimed.add(c));
        if (list.length) groups.push({ anchor: [p], kids: list });
      }
      // children with no other known parent: with the only partner if there is exactly one (the
      // older records list just one parent), otherwise below the person alone
      const alone = kids((c) => g.parentsOf(c).includes(main));
      alone.forEach((c) => claimed.add(c));
      if (alone.length) groups.push({ anchor: partners.length === 1 ? [main, partners[0]] : [main], kids: alone });
      // keep groups in the order of their anchors, left to right
      const pos = (a: string[]) => Math.min(...a.map((m) => members.indexOf(m))) + (a.length > 1 ? 0.5 : 0);
      groups.sort((a, b) => pos(a.anchor) - pos(b.anchor));
    }
    return { members, groups };
  };

  const widthOfMembers = (n: number) => n * W + (n - 1) * CG;

  /** lays out a unit and everything below it inside [left, …); returns the width used */
  const place = (main: string, left: number, taken: Set<string>): number => {
    const unit = unitOf(main, taken);
    unit.members.forEach((m) => taken.add(m));
    unit.groups.forEach((gr) => gr.kids.forEach((k) => taken.add(k)));

    // measure the children first (each child is the main person of their own unit)
    const flat = unit.groups.flatMap((gr) => gr.kids);
    const dryTaken = new Set(taken);
    const childWidths = flat.map((k) => measure(k, dryTaken));

    const kidsW = childWidths.reduce((s, w) => s + w, 0) + Math.max(0, flat.length - 1) * GX;
    const membersW = widthOfMembers(unit.members.length);
    const total = Math.max(membersW, kidsW);
    // the couple stands centred over their children
    const mLeft = left + (total - membersW) / 2;
    unit.members.forEach((m, i) => x.set(m, mLeft + i * (W + CG)));
    let cl = left + (total - kidsW) / 2;
    flat.forEach((k, i) => {
      place(k, cl, taken);
      cl += childWidths[i] + GX;
    });
    return total;
  };

  /** width a unit would need, without placing anything */
  const measure = (main: string, taken: Set<string>): number => {
    const unit = unitOf(main, taken);
    unit.members.forEach((m) => taken.add(m));
    unit.groups.forEach((gr) => gr.kids.forEach((k) => taken.add(k)));
    const flat = unit.groups.flatMap((gr) => gr.kids);
    const kidsW = flat.reduce((s, k) => s + measure(k, taken), 0) + Math.max(0, flat.length - 1) * GX;
    return Math.max(widthOfMembers(unit.members.length), kidsW);
  };

  // the top of Rosa's line: her parents if anyone is known there (or her siblings need them)
  const rosaParents = g.parentsOf(ROSA);
  const rootUsed = rosaParents.length > 0 && (rosaParents.some((p) => !isVirtual(p)) || g.siblingsOf(ROSA).length > 0);
  const taken = new Set<string>();
  if (rootUsed) {
    // Rosa's parents stand as one couple even if nobody linked them as partners
    const [first, ...others] = rosaParents;
    extraPartners.set(first, others);
    place(first, 0, taken);
  } else place(ROSA, 0, taken);

  /* ---------- everyone else: next to their relatives, in free space ---------- */

  const rowOccupied = (y: number) =>
    [...x.entries()].filter(([id]) => rowY(id) === y && !isVirtual(id)).map(([, l]) => [l - GX / 2, l + W + GX / 2] as [number, number]);
  const freeSpot = (want: number, width: number, y: number) => {
    const busy = rowOccupied(y);
    const fits = (l: number) => busy.every(([a, b]) => l + width <= a || l >= b);
    for (let step = 0; step < 400; step++) {
      for (const cand of [want + step * 20, want - step * 20]) if (fits(cand)) return cand;
    }
    return Math.max(0, ...busy.map(([, b]) => b)) + GX;
  };
  const center = (ids: string[]) => ids.reduce((s, id) => s + x.get(id)! + W / 2, 0) / ids.length;

  // what a folded branch hides stays hidden (with the partners of those people)
  const hidden = new Set<string>();
  for (const id of collapsed)
    for (const d of descendantsOf(id)) {
      hidden.add(d);
      for (const q of g.partnersOf(d)) if (!placed(q)) hidden.add(q);
    }
  const rest = g.people.filter((p) => !placed(p.id) && !isVirtual(p.id) && !hidden.has(p.id));
  let guard = 0;
  while (rest.some((p) => !placed(p.id)) && guard++ < 50) {
    let progressed = false;
    for (const p of rest) {
      if (placed(p.id)) continue;
      const kids = g.childrenOf(p.id).filter(placed);
      const partners = g.partnersOf(p.id).filter(placed);
      const parents = g.parentsOf(p.id).filter(placed);
      if (!kids.length && !partners.length && !parents.length) continue;
      // a person goes in together with their partners who are not placed yet
      const couple = [p.id, ...g.partnersOf(p.id).filter((q) => !placed(q) && !isVirtual(q) && !hidden.has(q))];
      const width = widthOfMembers(couple.length);
      const want = kids.length ? center(kids) - width / 2 : partners.length ? x.get(partners[0])! + W + CG : center(parents) - width / 2;
      const left = freeSpot(want, width, rowY(p.id));
      couple.forEach((m, i) => x.set(m, left + i * (W + CG)));
      progressed = true;
    }
    if (!progressed) {
      // nobody left is linked to anyone placed: start them at the end of their row
      const p = rest.find((q) => !placed(q.id))!;
      x.set(p.id, freeSpot(0, W, rowY(p.id)));
    }
  }

  /* ---------- normalise, mirror for right-to-left, and draw the lines ---------- */

  const minX = Math.min(...x.values());
  x.forEach((v, k) => x.set(k, v - minX));
  const width = Math.max(...x.values()) + W;
  if (o.rtl) x.forEach((v, k) => x.set(k, width - W - v));
  const ys = [...x.keys()].map(rowY);
  const height = Math.max(...ys) + H;

  const hiddenCount = (id: string) => (collapsed.has(id) ? descendantsOf(id).size : 0);
  const cards: PlacedCard[] = [];
  const junctions: Junction[] = [];
  for (const [id, left] of x) {
    if (isVirtual(id)) continue;
    cards.push({ id, x: left, y: rowY(id), level: levels.get(id) ?? 0, hidden: hiddenCount(id) });
  }

  const connectors: Connector[] = [];
  const mid = (id: string) => x.get(id)! + W / 2;
  const r = 14;

  // couples: a short line between the cards (an arc over the cards if they do not stand side by side)
  const seenPair = new Set<string>();
  for (const p of g.people) {
    if (!placed(p.id) || isVirtual(p.id)) continue;
    for (const q of g.partnersOf(p.id)) {
      const key = [p.id, q].sort().join("|");
      if (seenPair.has(key) || !placed(q) || isVirtual(q)) continue;
      seenPair.add(key);
      const [a, b] = [p.id, q].sort((m, n) => x.get(m)! - x.get(n)!);
      const y = rowY(a) + H / 2;
      const adjacent = rowY(a) === rowY(b) && x.get(b)! - (x.get(a)! + W) <= CG + 1;
      const d = adjacent
        ? `M ${x.get(a)! + W} ${y} H ${x.get(b)!}`
        : `M ${mid(a)} ${rowY(a)} C ${mid(a)} ${rowY(a) - RG / 2} ${mid(b)} ${rowY(b) - RG / 2} ${mid(b)} ${rowY(b)}`;
      connectors.push({ id: `c-${key}`, d, kind: "couple", people: [a, b] });
    }
  }

  // children: from their parents (the line between a couple, or a single parent) down to each child
  const families = new Map<string, string[]>();
  for (const c of g.people) {
    if (!placed(c.id) || isVirtual(c.id)) continue;
    const ps = g.parentsOf(c.id).filter((p) => placed(p) || isVirtual(p));
    if (!ps.length) continue;
    const key = [...ps].sort().join("|");
    families.set(key, [...(families.get(key) ?? []), c.id]);
  }
  for (const [key, kids] of families) {
    const ps = key.split("|");
    const real = ps.filter((p) => !isVirtual(p) && placed(p));
    let ax: number;
    let ay: number;
    // an only child of unnamed parents needs no line at all
    if (!real.length && kids.length < 2) continue;
    if (!real.length) {
      // unnamed parents: a small dot above the brothers and sisters
      ax = center(kids);
      ay = Math.min(...kids.map(rowY)) - RG / 2 - 10;
      junctions.push({ id: `j-${key}`, x: ax, y: ay });
    } else if (real.length >= 2 && rowY(real[0]) === rowY(real[1])) {
      const [a, b] = real.slice(0, 2).sort((m, n) => x.get(m)! - x.get(n)!);
      ax = (x.get(a)! + W + x.get(b)!) / 2;
      ay = rowY(a) + H / 2;
    } else {
      // one parent; if they have a single partner standing beside them, the line starts between them
      const p = real[0];
      const partners = g.partnersOf(p).filter((q) => placed(q) && !isVirtual(q) && rowY(q) === rowY(p));
      const mate = partners.length === 1 && Math.abs(x.get(partners[0])! - x.get(p)!) <= W + CG + 1 ? partners[0] : null;
      if (mate) {
        const [a, b] = [p, mate].sort((m, n) => x.get(m)! - x.get(n)!);
        ax = (x.get(a)! + W + x.get(b)!) / 2;
        ay = rowY(a) + H / 2;
      } else {
        ax = mid(p);
        ay = rowY(p) + H;
      }
    }
    for (const c of kids) {
      const cx = mid(c);
      const top = rowY(c);
      const bus = top - RG / 2;
      let d: string;
      if (Math.abs(cx - ax) < 1) d = `M ${ax} ${ay} V ${top}`;
      else {
        const s = cx > ax ? 1 : -1;
        const rr = Math.min(r, Math.abs(cx - ax) / 2);
        d = `M ${ax} ${ay} V ${bus - rr} Q ${ax} ${bus} ${ax + s * rr} ${bus} H ${cx - s * rr} Q ${cx} ${bus} ${cx} ${bus + rr} V ${top}`;
      }
      connectors.push({ id: `k-${key}-${c}`, d, kind: "child", people: [...ps, c] });
    }
  }

  const rows = [...new Set([...levels.entries()].filter(([id]) => placed(id) && !isVirtual(id)).map(([, l]) => l))].sort((a, b) => a - b).map((level) => ({ level, y: (level - minLevel) * (H + RG) }));
  return { cards, junctions, connectors, width, height, rows };
}
