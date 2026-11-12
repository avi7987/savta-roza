import type { Person } from "./types";

/*
  The family tree. Only Rosa's own name is real here; everyone else is a placeholder
  slot (no name, `placeholder: true`) that shows its relation until the person adds
  themselves through "Add yourself to the tree". Relations are calculated from
  `parents` and `partnerId`.
*/
export const ROSA = "rosa";

export const family: Person[] = [
  { id: ROSA, name: "רוזה", nameAlt: "Роза", gender: "f", parents: ["p-mother", "p-father"], partnerId: "husband" },
  { id: "husband", name: "", gender: "m", partnerId: ROSA, placeholder: true },

  // where she came from
  { id: "p-mother", name: "", gender: "f", partnerId: "p-father", placeholder: true },
  { id: "p-father", name: "", gender: "m", partnerId: "p-mother", placeholder: true },
  { id: "sib-1", name: "", gender: "f", parents: ["p-mother", "p-father"], placeholder: true },
  { id: "sib-2", name: "", gender: "m", parents: ["p-mother", "p-father"], placeholder: true },

  // children and their partners
  { id: "c1", name: "", gender: "f", parents: [ROSA, "husband"], partnerId: "c1-p", placeholder: true },
  { id: "c1-p", name: "", gender: "m", partnerId: "c1", placeholder: true },
  { id: "c2", name: "", gender: "m", parents: [ROSA, "husband"], partnerId: "c2-p", placeholder: true },
  { id: "c2-p", name: "", gender: "f", partnerId: "c2", placeholder: true },
  { id: "c3", name: "", gender: "f", parents: [ROSA, "husband"], partnerId: "c3-p", placeholder: true },
  { id: "c3-p", name: "", gender: "m", partnerId: "c3", placeholder: true },

  // grandchildren
  { id: "g1", name: "", gender: "f", parents: ["c1", "c1-p"], partnerId: "g1-p", placeholder: true },
  { id: "g1-p", name: "", gender: "m", partnerId: "g1", placeholder: true },
  { id: "g2", name: "", gender: "m", parents: ["c1", "c1-p"], placeholder: true },
  { id: "g3", name: "", gender: "m", parents: ["c2", "c2-p"], partnerId: "g3-p", placeholder: true },
  { id: "g3-p", name: "", gender: "f", partnerId: "g3", placeholder: true },
  { id: "g4", name: "", gender: "f", parents: ["c2", "c2-p"], placeholder: true },
  { id: "g5", name: "", gender: "f", parents: ["c2", "c2-p"], placeholder: true },
  { id: "g6", name: "", gender: "m", parents: ["c3", "c3-p"], placeholder: true },

  // great-grandchildren
  { id: "gg1", name: "", gender: "f", parents: ["g1", "g1-p"], placeholder: true },
  { id: "gg2", name: "", gender: "m", parents: ["g1", "g1-p"], placeholder: true },
  { id: "gg3", name: "", gender: "m", parents: ["g3", "g3-p"], placeholder: true },
];
