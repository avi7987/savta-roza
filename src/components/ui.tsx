"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { fadeUp, inView, stagger } from "@/lib/motion";
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
export function Item({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "p" | "h1" | "h2" | "h3" | "span" | "li" }) {
  const Tag = motion[as];
  return (
    <Tag className={className} variants={fadeUp}>
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
          <Item as="span" className="label block">
            {eyebrow}
          </Item>
          <Item as="h2" className="mt-4 text-[clamp(2.4rem,5.2vw,4.5rem)] font-light leading-[1.05] text-burgundy">
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
      <Item as="span" className="label">
        {eyebrow}
      </Item>
      <Item as="h2" className="text-[clamp(2.4rem,5.2vw,4.5rem)] font-light leading-[1.05] text-burgundy">
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
