import type { Person } from "./types";

/*
  The family tree starts with only Rosa and her husband. Everyone else is added
  through the site ("Add to the tree") and the tree grows a ring per generation.
  Rosa's parents are referenced by fixed ids so her siblings can be linked to
  them even before the parents themselves are added.
*/
export const ROSA = "rosa";
export const HUSBAND = "husband";
export const MOTHER = "p-mother";
export const FATHER = "p-father";

export const family: Person[] = [
  { id: ROSA, name: "רוזה", nameAlt: "Роза", gender: "f", born: "1938", photoSrc: "/images/rosa-avatar.webp", parents: [MOTHER, FATHER], partnerId: HUSBAND },
  { id: HUSBAND, name: "", gender: "m", partnerId: ROSA, placeholder: true },
];
