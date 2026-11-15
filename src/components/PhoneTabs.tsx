"use client";

import { usePathname } from "next/navigation";
import { BookOpen, Images, Plus, Sparkles, Users } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { TLink } from "./Transition";
import { cn } from "./ui";

/**
 * On phones, the four places of the site and "add" stay at the bottom of the screen, where a
 * thumb reaches them, each with its name (never an icon alone).
 */
export default function PhoneTabs() {
  const { t } = useLang();
  const path = usePathname();
  // not on pages that are a task of their own
  if (path.startsWith("/admin") || path.startsWith("/share")) return null;
  const tabs = [
    { href: "/#story", label: t.tabs.story, Icon: BookOpen, on: false },
    { href: "/gallery", label: t.tabs.album, Icon: Images, on: path.startsWith("/gallery") },
    { href: "/share", label: t.tabs.add, Icon: Plus, add: true, on: false },
    { href: "/family", label: t.tabs.family, Icon: Users, on: path.startsWith("/family") },
    { href: "/#ask", label: t.tabs.ask, Icon: Sparkles, on: false },
  ];
  return (
    <nav
      aria-label={t.tabs.label}
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-line bg-paper/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)", paddingLeft: "env(safe-area-inset-left, 0px)", paddingRight: "env(safe-area-inset-right, 0px)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {tabs.map(({ href, label, Icon, add, on }) => (
          <li key={href}>
            <TLink href={href} aria-current={on ? "page" : undefined} className={cn("flex min-h-[3.75rem] flex-col items-center justify-center gap-0.5 text-[0.72rem]", on ? "text-burgundy" : "text-ink-soft")}>
              {add ? (
                <span className="-mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose text-white shadow-[0_8px_18px_-6px_rgba(118,46,73,0.5)] ring-4 ring-paper">
                  <Icon className="h-6 w-6" strokeWidth={1.8} aria-hidden />
                </span>
              ) : (
                <Icon className="h-[1.35rem] w-[1.35rem]" strokeWidth={on ? 1.9 : 1.5} aria-hidden />
              )}
              <span className={cn(add && "text-rose")}>{label}</span>
            </TLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
