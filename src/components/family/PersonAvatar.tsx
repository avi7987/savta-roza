"use client";

import type { Person } from "@/content/types";
import { cn } from "../ui";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

/** A round portrait, or an initial on paper, or (for an empty slot) a dashed outline. */
export default function PersonAvatar({ person, label, className, center }: { person: Person; label: string; className?: string; center?: boolean }) {
  if (person.photoSrc) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={person.photoSrc} alt="" className={cn("aspect-square rounded-full object-cover ring-2 ring-white shadow-[var(--shadow-paper)]", className)} />;
  }
  if (person.placeholder) {
    return (
      <span aria-hidden className={cn("flex aspect-square items-center justify-center rounded-full border border-dashed border-dusty/60 bg-ivory/80", className)}>
        <svg viewBox="0 0 24 24" className="h-[42%] w-[42%] text-dusty/70" fill="none" stroke="currentColor" strokeWidth="1.1">
          <circle cx="12" cy="8.5" r="3.6" />
          <path d="M5 20c1.2-3.6 4-5.4 7-5.4s5.8 1.8 7 5.4" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex aspect-square items-center justify-center rounded-full font-display text-white shadow-[var(--shadow-paper)] ring-2 ring-white",
        center ? "bg-burgundy text-[1.6em]" : "bg-rose text-[1.15em]",
        className
      )}
    >
      {initials(label)}
    </span>
  );
}
