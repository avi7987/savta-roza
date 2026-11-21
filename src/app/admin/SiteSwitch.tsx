"use client";

/*
  The family keeps two memorial sites, each with its own data and its own admin page. This bar at
  the top of the admin page says which one is being managed now, and moves to the other one with
  the sign-in carried along: the password goes in the part of the address after "#", which the
  browser never sends to any server, and the other admin page takes it out of the address at once.
  If the two sites have the same password, moving between them asks for nothing; if not, the other
  one asks for its own once. (The same file is in both projects; only HERE differs.)
*/

type Site = { id: "roza" | "lonya"; name: string; admin: string };
const SITES: Site[] = [
  { id: "roza", name: "סבתא רוזה", admin: "https://savta-roza-1.avi7987.workers.dev/admin" },
  { id: "lonya", name: "סבא לוניה", admin: "https://saba-lonya.ayaokshus.workers.dev/admin" },
];
const HERE: Site["id"] = "roza";
const KEY = "roza-admin";
const HAND = "#signin=";

/** the sign-in handed over from the other site's admin page, if there is one: taken out of the address and kept */
export function takeHandedSignIn(): string {
  if (typeof window === "undefined" || !window.location.hash.startsWith(HAND)) return "";
  const tk = decodeURIComponent(window.location.hash.slice(HAND.length));
  window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  try {
    sessionStorage.setItem(KEY, tk);
  } catch {}
  return tk;
}

function go(site: Site) {
  let tk = "";
  try {
    tk = sessionStorage.getItem(KEY) ?? "";
  } catch {}
  window.location.assign(tk ? `${site.admin}${HAND}${encodeURIComponent(tk)}` : site.admin);
}

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
            ) : (
              <a
                key={s.id}
                href={s.admin}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  go(s);
                }}
                className="rounded-full px-3.5 py-1 text-burgundy transition-colors hover:bg-blush/50"
              >
                {s.name}
              </a>
            )
          )}
        </span>
        <span className="text-[0.8rem] text-ink-soft/80">עם אותה סיסמה בשני האתרים, המעבר ביניהם לא יבקש להתחבר שוב.</span>
      </div>
    </nav>
  );
}
