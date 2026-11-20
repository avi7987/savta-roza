/*
  The family keeps two memorial sites, each with its own data and its own admin page. This bar at
  the top of the admin page says which one is being managed now, and goes to the other one. (The
  same file is in both projects; only HERE differs.)
*/

type Site = { id: "roza" | "lonya"; name: string; admin: string };
const SITES: Site[] = [
  { id: "roza", name: "סבתא רוזה", admin: "https://savta-roza-1.avi7987.workers.dev/admin" },
  { id: "lonya", name: "סבא לוניה", admin: "https://saba-lonya.ayaokshus.workers.dev/admin" },
];
const HERE: Site["id"] = "roza";

export default function SiteSwitch() {
  return (
    <nav aria-label="איזה אתר לנהל" className="border-b border-line bg-mount/70">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2 px-5 py-2 text-[0.88rem]">
        <span className="text-ink-soft">מנהלים עכשיו את:</span>
        <span className="inline-flex gap-1 rounded-full bg-white/80 p-1 ring-1 ring-line">
          {SITES.map((s) =>
            s.id === HERE ? (
              <span key={s.id} aria-current="page" className="rounded-full bg-burgundy px-3.5 py-1 text-white">
                {s.name}
              </span>
            ) : s.admin ? (
              <a key={s.id} href={s.admin} className="rounded-full px-3.5 py-1 text-burgundy transition-colors hover:bg-blush/50">
                {s.name}
              </a>
            ) : (
              <span key={s.id} title="הכתובת תתווסף בקרוב" className="rounded-full px-3.5 py-1 text-ink-soft/60">
                {s.name}
              </span>
            )
          )}
        </span>
      </div>
    </nav>
  );
}
