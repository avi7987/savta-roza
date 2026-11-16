import "server-only";
import { ROSA } from "@/content/family";
import type { FamilyGraph } from "@/lib/family";
import { treeState } from "./treeEdit";

/*
  The family tree written out as plain sentences, so a question like "how many grandchildren does
  she have?" can be answered from it. Only people the family entered and the owner approved; empty
  slots (a partner nobody has named yet) are left out, and the text says the tree may be incomplete.
*/

export async function familySummary(lang: "he" | "ru") {
  const { graph } = await treeState();
  return describe(graph, lang);
}

export function describe(g: FamilyGraph, lang: "he" | "ru") {
  const real = (id: string) => {
    const p = g.byId.get(id);
    return !!p && !p.virtual && !p.placeholder && !!p.name;
  };
  const name = (id: string) => {
    const p = g.byId.get(id)!;
    const n = lang === "ru" && p.nameAlt ? p.nameAlt : p.name;
    const life = [p.born, p.died && p.died !== "?" ? p.died : ""].filter(Boolean).join("–");
    return `${n}${p.died ? " (deceased)" : ""}${life ? ` [${life}]` : ""}`;
  };
  const kids = (id: string) => g.childrenOf(id).filter((x) => g.byId.has(x) && !g.byId.get(x)!.virtual);
  const partners = (id: string) => g.partnersOf(id).filter(real);
  const list = (ids: string[]) => ids.map(name).join(", ");

  const children = kids(ROSA);
  const grand = children.flatMap(kids);
  const great = grand.flatMap(kids);
  const great2 = great.flatMap(kids);
  // an empty slot in a row still counts as a person (e.g. a child whose name was not given)
  const count = (ids: string[]) => `${ids.length}${ids.some((x) => !real(x)) ? ` (of them ${ids.filter((x) => !real(x)).length} not named yet)` : ""}`;

  const lines: string[] = ["The family tree on the site, as the family entered it (it may not be complete yet):"];
  const rp = partners(ROSA);
  if (rp.length) lines.push(`Rosa's husband/partner: ${list(rp)}.`);
  const parents = g.realParentsOf(ROSA).filter(real);
  if (parents.length) lines.push(`Rosa's parents: ${list(parents)}.`);
  const sibs = g.siblingsOf(ROSA).filter(real);
  if (sibs.length) lines.push(`Rosa's brothers and sisters: ${list(sibs)}.`);
  lines.push(`Rosa has ${count(children)} children, ${count(grand)} grandchildren and ${count(great)} great-grandchildren${great2.length ? ` and ${count(great2)} great-great-grandchildren` : ""}.`);
  for (const c of children) {
    const parts = [real(c) ? name(c) : "a child not named yet"];
    const cp = partners(c);
    if (cp.length) parts.push(`partner: ${list(cp)}`);
    const gk = kids(c);
    if (gk.length) {
      parts.push(
        `children: ${gk
          .map((x) => {
            const gg = kids(x).filter(real);
            const xp = partners(x);
            return `${real(x) ? name(x) : "not named yet"}${xp.length ? ` (partner: ${list(xp)})` : ""}${gg.length ? ` (children: ${list(gg)})` : ""}`;
          })
          .join("; ")}`
      );
    }
    lines.push(`- ${parts.join("; ")}`);
  }
  return lines.join("\n");
}
