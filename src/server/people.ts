import "server-only";
import { family as seed } from "@/content/family";
import { FamilyGraph, expandRequest, mergePeople } from "@/lib/family";
import { sameName } from "@/lib/names";
import { familyStore, namesStore } from "./store";

/** ids of the shared name list start with this, so they never clash with tree ids */
export const NAME_PREFIX = "n-";

/** everyone who can be tagged: the family tree as visitors see it, and the shared list of names */
export async function peopleDirectory() {
  const [approved, names] = await Promise.all([familyStore.list("approved"), namesStore.list("approved")]);
  const graph = new FamilyGraph(mergePeople(seed, approved.flatMap((p) => expandRequest(p, `fam-${p.id}`))));
  const listed = names.map((n) => ({ id: NAME_PREFIX + n.id, name: n.name }));
  const ids = new Set<string>([...graph.people.filter((p) => !p.placeholder).map((p) => p.id), ...listed.map((n) => n.id)]);
  const nameOf = (id: string) => {
    const p = graph.byId.get(id);
    if (p) return [p.name, p.nameAlt].filter(Boolean).join(" ");
    return listed.find((n) => n.id === id)?.name ?? "";
  };
  return { graph, listed, ids, nameOf };
}

const cleanName = (v: unknown) => (typeof v === "string" ? v.replace(/[\u0000-\u001F\u007F<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 60) : "");

/**
 * Turns tag requests into ids. Known ids are kept; new names reuse whoever already has that name
 * (in the tree or in the list, however it is spelled with vowel marks, case or final letters),
 * and only a truly new name is added to the shared list.
 */
export async function resolvePeople(ids: unknown, newNames: unknown, by?: string) {
  const dir = await peopleDirectory();
  const out = new Set<string>();
  if (Array.isArray(ids)) for (const id of ids) if (typeof id === "string" && dir.ids.has(id)) out.add(id);
  const names = Array.isArray(newNames) ? Array.from(new Set(newNames.map(cleanName).filter((n) => n.length >= 2))).slice(0, 20) : [];
  for (const name of names) {
    const tree = dir.graph.people.find((p) => !p.placeholder && [p.name, p.nameAlt].some((x) => x && sameName(x, name)));
    const listed = dir.listed.find((n) => sameName(n.name, name));
    if (tree) out.add(tree.id);
    else if (listed) out.add(listed.id);
    else {
      const made = await namesStore.create({ name, addedBy: by }, [], "approved");
      const id = NAME_PREFIX + made.id;
      dir.listed.push({ id, name });
      out.add(id);
    }
  }
  return Array.from(out).slice(0, 40);
}
