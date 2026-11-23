"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId, type ReactNode } from "react";
import { fadeUp, inView, lineReveal, stagger } from "@/lib/motion";
import { useLang } from "@/lib/i18n";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/** Fades and lifts its children into place the first time they are seen. */
export function Reveal({ children, className, delay = 0, as = "div" }: { children: ReactNode; className?: string; delay?: number; as?: "div" | "li" | "article" | "figure" }) {
  const Tag = motion[as];
  return (
    <Tag className={className} variants={stagger(0.08, delay)} initial="hidden" whileInView="show" viewport={inView}>
      {children}
    </Tag>
  );
}

/** A child of <Reveal> that takes part in its stagger. */
export function Item({ children, className, as = "div", rise }: { children: ReactNode; className?: string; as?: "div" | "p" | "h1" | "h2" | "h3" | "span" | "li"; rise?: boolean }) {
  const Tag = motion[as];
  return (
    <Tag className={className} variants={rise ? lineReveal : fadeUp}>
      {children}
    </Tag>
  );
}

/** Section opener. `layout` varies so neighbouring sections never look the same. */
export function SectionIntro({
  id,
  eyebrow,
  title,
  lead,
  layout = "start",
  className,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  lead?: string;
  layout?: "start" | "center" | "split";
  className?: string;
}) {
  if (layout === "split") {
    return (
      <Reveal className={cn("grid gap-6 md:grid-cols-12 md:items-end", className)}>
        <div className="md:col-span-7">
          <Item as="span" className="block">
            <Eyebrow>{eyebrow}</Eyebrow>
          </Item>
          <Item as="h2" rise className="mt-4 text-[clamp(2.4rem,5.2vw,4.5rem)] font-medium leading-[1.05] text-burgundy">
            <span id={id}>{title}</span>
          </Item>
        </div>
        {lead && (
          <Item as="p" className="max-w-md text-lg leading-relaxed text-ink-soft md:col-span-5 md:pb-3">
            {lead}
          </Item>
        )}
      </Reveal>
    );
  }
  const center = layout === "center";
  return (
    <Reveal className={cn("flex max-w-3xl flex-col gap-4", center && "mx-auto items-center text-center", className)}>
      <Item as="span">
        <Eyebrow>{eyebrow}</Eyebrow>
      </Item>
      <Item as="h2" rise className="text-[clamp(2.4rem,5.2vw,4.5rem)] font-medium leading-[1.05] text-burgundy">
        <span id={id}>{title}</span>
      </Item>
      {lead && (
        <Item as="p" className="max-w-xl text-lg leading-relaxed text-ink-soft">
          {lead}
        </Item>
      )}
    </Reveal>
  );
}

/** Small, honest marker on anything still waiting for family content. */
export function PlaceholderTag({ className, short }: { className?: string; short?: boolean }) {
  const { t } = useLang();
  return (
    <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full border border-dashed border-dusty/60 px-2.5 py-0.5 text-[0.72rem] leading-5 text-rose", className)}>
      <span aria-hidden className="h-1 w-1 rounded-full bg-dusty" />
      {short ? t.placeholderShort : t.placeholder}
    </span>
  );
}

/** The page's outer measure. */
export function Container({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn("mx-auto w-full px-[var(--spacing-gutter)]", wide ? "max-w-[96rem]" : "max-w-[78rem]", className)}>{children}</div>;
}

const btnBase =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-7 text-[0.98rem] font-medium transition-[background-color,color,box-shadow,transform] duration-300 ease-[var(--ease-gentle)] hover:-translate-y-0.5 active:translate-y-0";

export const buttonClass = {
  primary: cn(btnBase, "bg-rose text-white shadow-[0_10px_24px_-14px_rgba(118,46,73,0.8)] hover:bg-burgundy"),
  secondary: cn(btnBase, "border border-burgundy/25 text-burgundy hover:border-burgundy/50 hover:bg-white/60"),
  quiet: "inline-flex items-center gap-2 text-burgundy underline decoration-dusty/50 decoration-1 underline-offset-[6px] transition-colors hover:decoration-burgundy",
};


/* ---------- the Living Album's shared pieces ---------- */

/** a sheet of album paper: the same soft, rose-tinted card as the people in the family tree */
export const paper = "rounded-[18px] border border-line bg-paper shadow-[0_1px_2px_rgba(70,35,45,0.07),0_10px_24px_-14px_rgba(70,35,45,0.3)]";

/** a small soft label, like the relation under a name in the tree */
export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex w-fit items-center gap-1 rounded-full bg-blush/45 px-2.5 py-0.5 text-[0.78rem] text-burgundy", className)}>{children}</span>;
}

/** the little capsule above a section's title */
export function Eyebrow({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-[0.85rem] text-burgundy ring-1 ring-blush">
      {icon ?? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rose" />}
      {children}
    </span>
  );
}

/**
 * A decade's heading, drawn like a generation in the family tree: the year large and quiet, its
 * name, and a dotted line that draws itself across the page the first time it is seen.
 */
/** quiet: the title only says what the big year already says, so it is there for screen readers only */
export function DecadeMark({ year, title, count, as: Tag = "h2", id, className, quiet }: { year?: number | string; title: string; count?: ReactNode; as?: "h2" | "h3"; id?: string; className?: string; quiet?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className={cn("flex items-end gap-4 sm:gap-6", className)}>
      {year !== undefined && <span aria-hidden className="font-display text-[clamp(2.6rem,6vw,4.6rem)] leading-[0.8] tabular-nums text-[#a87482]">{year}</span>}
      <div className="flex min-w-0 flex-1 flex-col gap-2 pb-1">
        <div className="flex items-baseline justify-between gap-3">
          <Tag id={id} className={quiet ? "sr-only" : "font-display text-[clamp(1.45rem,2.6vw,1.9rem)] font-normal leading-tight text-burgundy"}>
            {title}
          </Tag>
          {count && <Pill className="shrink-0 tabular-nums">{count}</Pill>}
        </div>
        <motion.span
          aria-hidden
          className="block h-px w-full origin-left bg-[repeating-linear-gradient(90deg,var(--color-rail)_0_3px,transparent_3px_9px)] rtl:origin-right"
          initial={reduce ? false : { scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, margin: "0px 0px -10% 0px" }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

/** a row of choices where a soft mark glides to the chosen one */
export function Segmented<T extends string>({ options, value, onChange, label, className }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string; className?: string }) {
  const uid = useId();
  return (
    <div role="group" aria-label={label} className={cn("inline-flex flex-wrap justify-center gap-1 rounded-full bg-white/70 p-1 ring-1 ring-line", className)}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)} className={cn("relative min-h-10 rounded-full px-4 text-[0.92rem] transition-colors duration-300", value === o.id ? "text-burgundy" : "text-ink-soft hover:text-burgundy")}>
          {value === o.id && <motion.span layoutId={`seg-${uid}`} aria-hidden className="absolute inset-0 rounded-full bg-blush/70" style={{ borderRadius: 999 }} transition={{ type: "spring", visualDuration: 0.4, bounce: 0 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
