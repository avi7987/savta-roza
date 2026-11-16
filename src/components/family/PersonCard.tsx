"use client";

import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { ROSA } from "@/content/family";
import type { TreePerson } from "@/lib/family";
import { useLang } from "@/lib/i18n";
import { cn } from "../ui";
import PersonAvatar from "./PersonAvatar";

/** every card in the tree has exactly this size, whoever it is */
export const CARD_W = 176;
export const CARD_H = 104;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const year = (s?: string) => s?.match(/\d{4}/)?.[0] ?? s;

/** selected: the person chosen · path: on the way from Rosa to them · lit: their closest family · dim: everyone else */
export type CardState = "selected" | "path" | "lit" | "dim" | "normal";

/**
 * One person: photo, name, years, and how they are related to Rosa. Rosa and the selected person
 * are marked by colour only; the card is the same size for everyone.
 */
export default function PersonCard({
  person,
  name,
  relation,
  state = "normal",
  onOpen,
  onAdd,
  fold,
  fluid,
  className,
}: {
  person: TreePerson;
  name: string;
  relation?: string;
  state?: CardState;
  onOpen: () => void;
  onAdd?: () => void;
  fold?: { folded: boolean; hidden: number; toggle: () => void };
  /** fill the width it is given (phones: two equal columns), keeping the same height */
  fluid?: boolean;
  className?: string;
}) {
  const { t } = useLang();
  const m = t.family.map;
  const isRosa = person.id === ROSA;
  const born = year(person.born);
  const died = person.died === "?" ? undefined : year(person.died);
  const years = born || died ? `${born ?? "?"}${died ? `–${died}` : ""}` : "";
  const label = cap(name);

  return (
    <div className={cn("group relative", className)} style={{ width: fluid ? "100%" : CARD_W, height: CARD_H }}>
      {/* a folded branch: the people behind it show as sheets under the card */}
      {fold?.folded && (
        <>
          <span aria-hidden className="absolute inset-0 translate-x-[-10px] translate-y-[10px] rounded-[14px] border border-line bg-paper/70" />
          <span aria-hidden className="absolute inset-0 translate-x-[-5px] translate-y-[5px] rounded-[14px] border border-line bg-paper" />
        </>
      )}
      <button
        type="button"
        onClick={onOpen}
        aria-label={t.family.open(label)}
        aria-current={state === "selected" ? "true" : undefined}
        className={cn(
          "relative flex h-full w-full items-center rounded-[14px] border bg-paper text-start",
          fluid ? "gap-2 px-2.5" : "gap-3 px-3.5",
          "transition-[box-shadow,border-color,opacity,transform] duration-300",
          "shadow-[0_1px_2px_rgba(70,35,45,0.07),0_10px_24px_-14px_rgba(70,35,45,0.3)] hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(70,35,45,0.08),0_16px_30px_-14px_rgba(70,35,45,0.34)]",
          isRosa ? "border-2 border-rose bg-[#fbf0f1]" : "border-line",
          state === "selected" && "border-rose shadow-[0_0_0_3px_var(--color-rose),0_10px_24px_-14px_rgba(70,35,45,0.3)]",
          state === "path" && !isRosa && "border-rose/70",
          state === "lit" && !isRosa && "border-rose/35",
          state === "dim" && "opacity-[0.38]",
          person.placeholder && "border-dashed bg-paper/70",
          person.pending && "border-dashed border-rose/60"
        )}
      >
        <span className="relative shrink-0">
          <PersonAvatar person={person} label={label} center={isRosa} className={cn(fluid ? "w-11 text-[0.95rem]" : "w-14 text-[1.05rem]", person.died && "grayscale-[35%]")} />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5 leading-tight">
          <span className={cn("line-clamp-2 text-[0.98rem]", person.placeholder ? "text-ink-soft" : "text-charcoal", isRosa && "font-display text-[1.1rem] text-burgundy")} dir="auto">
            {label}
            {person.died && <span className="ms-1 text-[0.72rem] text-ink-soft">{m.late}</span>}
          </span>
          {years && <span dir="ltr" className={cn("w-fit whitespace-nowrap tabular-nums text-ink-soft", fluid ? "text-[0.7rem]" : "text-[0.78rem]")}>{years}</span>}
          {relation && !isRosa && !person.placeholder && <span className="mt-0.5 w-fit rounded-full bg-blush/45 px-2 py-px text-[0.7rem] text-burgundy">{relation}</span>}
          {person.pending && <span className="mt-0.5 w-fit rounded-full bg-blush/70 px-2 py-px text-[0.66rem] text-burgundy">{t.family.pending}</span>}
        </span>
      </button>

      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          aria-label={t.family.addNear(label)}
          className="absolute -top-2.5 -end-2.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-rose text-white opacity-0 shadow-[var(--shadow-paper)] transition-opacity hover:bg-burgundy focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-90"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      )}

      {fold && (
        <button
          type="button"
          onClick={fold.toggle}
          aria-expanded={!fold.folded}
          aria-label={fold.folded ? m.unfold(fold.hidden) : m.fold}
          className={cn("absolute -bottom-3.5 left-1/2 z-10 flex h-7 min-w-7 -translate-x-1/2 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-line bg-paper px-2.5 text-[0.74rem] text-burgundy shadow-[var(--shadow-paper)] transition-opacity hover:border-burgundy/40 focus-visible:opacity-100", !fold.folded && "opacity-0 group-hover:opacity-100")}
        >
          {fold.folded ? (
            <>
              {m.unfold(fold.hidden)}
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </>
          ) : (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}
