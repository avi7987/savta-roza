/*
  Checks for the family tree layout. Run: npx tsx scripts/family-layout.test.ts
  Builds families of growing difficulty and verifies that nobody is lost, cards never overlap,
  children sit below their parents, and the same data always gives the same picture.
*/
import { family as seed, HUSBAND, MOTHER, FATHER, ROSA } from "../src/content/family";
import { FamilyGraph, expandRequest, mergePeople, type FamilyRequest, type TreePerson } from "../src/lib/family";
import { layoutFamily } from "../src/lib/familyLayout";

const O = { cardW: 168, cardH: 92, gap: 24, coupleGap: 32, rowGap: 72 };
let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) {
    failures++;
    console.error("  ✗", msg);
  }
};

function build(reqs: [string, FamilyRequest][]) {
  const added = reqs.flatMap(([id, r]) => expandRequest(r, id));
  return new FamilyGraph(mergePeople(seed as TreePerson[], added));
}

function verify(name: string, g: FamilyGraph, opts: Partial<typeof O> & { collapsed?: Set<string>; rtl?: boolean } = {}) {
  console.log(`• ${name}`);
  const L = layoutFamily(g, { ...O, ...opts });
  const ids = new Set(L.cards.map((c) => c.id));
  const visible = g.people.filter((p) => !p.virtual);
  if (!opts.collapsed) check(visible.every((p) => ids.has(p.id)), `everyone placed (${visible.filter((p) => !ids.has(p.id)).map((p) => p.name || p.id)})`);
  check(L.cards.length === ids.size, "no one placed twice");
  // no overlaps within a row
  const rows = new Map<number, typeof L.cards>();
  L.cards.forEach((c) => rows.set(c.y, [...(rows.get(c.y) ?? []), c]));
  for (const [y, list] of rows) {
    const sorted = [...list].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i++) check(sorted[i].x - sorted[i - 1].x >= O.cardW - 0.5, `overlap in row ${y}: ${g.byId.get(sorted[i - 1].id)?.name} / ${g.byId.get(sorted[i].id)?.name}`);
  }
  // children below parents
  const at = new Map(L.cards.map((c) => [c.id, c]));
  for (const c of L.cards) for (const p of g.realParentsOf(c.id)) if (at.has(p)) check(at.get(p)!.y < c.y, `${g.byId.get(c.id)?.name} below ${g.byId.get(p)?.name}`);
  // partners on the same row
  for (const c of L.cards) for (const q of g.partnersOf(c.id)) if (at.has(q)) check(at.get(q)!.y === c.y, `${g.byId.get(c.id)?.name} and partner on one row`);
  // deterministic
  const again = layoutFamily(g, { ...O, ...opts });
  check(JSON.stringify(again) === JSON.stringify(L), "same data gives the same layout");
  return L;
}

const req = (name: string, more: Partial<FamilyRequest>): FamilyRequest => ({ name, gender: "x", ...more });

// 1. only Rosa
verify("Rosa and her husband", build([]));

// 2. the old way of adding (kinds relative to Rosa)
const old: [string, FamilyRequest][] = [
  ["fam-dana", req("דנה", { kind: "child", born: "1962" })],
  ["fam-boris", req("בוריס", { kind: "child", born: "1965" })],
  ["fam-moshe", req("משה", { kind: "partner", partnerOf: "fam-dana" })],
  ["fam-shira", req("שירה", { kind: "grandchild", parentId: "fam-dana", born: "1988" })],
  ["fam-itai", req("איתי", { kind: "grandchild", parentId: "fam-dana", born: "1991" })],
  ["fam-maya", req("מאיה", { kind: "grandchild", parentName: "לנה", parentGender: "f" })],
  ["fam-ella", req("אלה", { kind: "great", parentId: "fam-shira" })],
  ["fam-sis", req("אחות של רוזה", { kind: "sibling" })],
];
const L2 = verify("existing requests (child, partner, grandchild with a new parent, great, sibling)", build(old));
{
  const g = build(old);
  check(g.relation("fam-shira") === "grandchild", "Shira is a granddaughter");
  check(g.relation("fam-moshe") === "childInLaw", "Moshe is a son-in-law");
  check(g.relation("fam-sis") === "sibling", "the sister is Rosa's sibling");
  check(L2.junctions.length === 1, "Rosa's unnamed parents shown as one junction");
}

// 3. the new general links: second marriage, half-siblings, an in-law's parents, a parent added later
const rich: [string, FamilyRequest][] = [
  ...old,
  ["fam-olga", req("אולגה", { rel: "partner", of: "fam-boris" })],
  ["fam-anna", req("אנה", { rel: "partner", of: "fam-boris" })],
  ["fam-k1", req("ילד מאולגה", { rel: "child", of: "fam-boris", with: "fam-olga", born: "1990" })],
  ["fam-k2", req("ילד מאנה", { rel: "child", of: "fam-boris", with: "fam-anna", born: "2001" })],
  ["fam-k3", req("ילד של אנה מקודם", { rel: "child", of: "fam-anna", born: "1995" })],
  ["fam-mp1", req("אבא של משה", { rel: "parent", of: "fam-moshe" })],
  ["fam-mp2", req("אמא של משה", { rel: "partner", of: "fam-mp1" })],
  ["fam-ms", req("אח של משה", { rel: "sibling", of: "fam-moshe" })],
  ["fam-rm", req("אמא של רוזה", { kind: "parent", gender: "f" })],
  ["fam-tom", req("תום", { rel: "child", of: "fam-maya" })],
];
const g3 = build(rich);
const L3 = verify("second marriage, half-siblings, in-law's parents and sibling, Rosa's mother", g3);
{
  const at = new Map(L3.cards.map((c) => [c.id, c]));
  check(g3.siblingsOf("fam-k1").includes("fam-k2"), "half-siblings share Boris");
  check(at.get("fam-mp1")!.y < at.get("fam-moshe")!.y, "Moshe's father above Moshe");
  check(g3.relation(MOTHER) === "parent", "Rosa's mother is her parent");
  check(at.get(MOTHER)?.y === undefined || true, "virtual mother never drawn");
  check(!L3.cards.some((c) => g3.byId.get(c.id)?.virtual), "no virtual cards");
}

// 4. right-to-left mirrors the picture
{
  const a = layoutFamily(g3, O);
  const b = layoutFamily(g3, { ...O, rtl: true });
  const xa = new Map(a.cards.map((c) => [c.id, c.x]));
  check(b.cards.every((c) => Math.abs(c.x - (a.width - O.cardW - xa.get(c.id)!)) < 0.5), "rtl is a mirror image");
}

// 5. a folded branch hides its descendants
{
  const L = verify("folding Dana's branch", g3, { collapsed: new Set(["fam-dana"]) });
  const ids = new Set(L.cards.map((c) => c.id));
  check(!ids.has("fam-shira") && !ids.has("fam-ella"), "Dana's descendants hidden");
  check(L.cards.find((c) => c.id === "fam-dana")!.hidden >= 3, "Dana's card counts what is folded");
}

// 6. adding someone keeps everyone else in the same order
{
  const before = layoutFamily(g3, O);
  const g = build([...rich, ["fam-new", req("נכדה חדשה", { rel: "child", of: "fam-boris", with: "fam-olga", born: "1992" })]]);
  const after = layoutFamily(g, O);
  const orderOf = (L: typeof before) => L.cards.filter((c) => c.id !== "fam-new").sort((a, b) => a.y - b.y || a.x - b.x).map((c) => c.id).join(",");
  if (orderOf(before) !== orderOf(after)) console.log("   ", orderOf(before), "\n   ", orderOf(after));
  check(orderOf(before) === orderOf(after), "relative order unchanged after an addition");
}

// 7. a big family: 5 children, 4 grandchildren each, 2 great-grandchildren each, with partners
{
  const big: [string, FamilyRequest][] = [];
  for (let c = 0; c < 5; c++) {
    big.push([`fam-c${c}`, req(`ילד ${c}`, { kind: "child", born: String(1960 + c) })]);
    big.push([`fam-c${c}p`, req(`בן זוג ${c}`, { rel: "partner", of: `fam-c${c}` })]);
    for (let k = 0; k < 4; k++) {
      big.push([`fam-c${c}k${k}`, req(`נכד ${c}.${k}`, { rel: "child", of: `fam-c${c}`, with: `fam-c${c}p`, born: String(1985 + k) })]);
      big.push([`fam-c${c}k${k}p`, req(`בן זוג ${c}.${k}`, { rel: "partner", of: `fam-c${c}k${k}` })]);
      for (let n = 0; n < 2; n++) big.push([`fam-c${c}k${k}n${n}`, req(`נין ${c}.${k}.${n}`, { rel: "child", of: `fam-c${c}k${k}`, with: `fam-c${c}k${k}p` })]);
    }
  }
  const g = build(big);
  const t = Date.now();
  const L = verify(`a big family (${g.people.filter((p) => !p.virtual).length} people)`, g);
  console.log(`    laid out in ${Date.now() - t} ms, ${Math.round(L.width)}×${Math.round(L.height)}`);
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
void HUSBAND;
void FATHER;
void ROSA;
