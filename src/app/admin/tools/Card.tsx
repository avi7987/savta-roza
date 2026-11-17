import type { ReactNode } from "react";

/** one tool on the admin "tools" tab */
export function Card({ icon, title, lead, children }: { icon: ReactNode; title: string; lead?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg bg-white p-6 shadow-[var(--shadow-paper)]">
      <h2 className="flex items-center gap-2.5 font-display text-2xl text-burgundy">
        <span className="text-rose">{icon}</span>
        {title}
      </h2>
      {lead && <p className="mt-1 text-ink-soft">{lead}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
