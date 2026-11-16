"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  const home = path === "/";
  // on the home page, the tab follows the reader: the question section, or the story around it
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    const el = home ? document.getElementById("ask") : null;
    if (!el) return setAsking(false);
    const io = new IntersectionObserver(([e]) => setAsking(e.isIntersecting), { rootMargin: "-35% 0px -45% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [home]);
  // not on pages that are a task of their own
  if (path.startsWith("/admin") || path.startsWith("/share")) return null;
  const tabs = [
    { href: "/#story", label: t.tabs.story, Icon: BookOpen, on: home && !asking, here: "location" as const },
    { href: "/gallery", label: t.tabs.album, Icon: Images, on: path.startsWith("/gallery"), here: "page" as const },
    { href: "/share", label: t.tabs.add, Icon: Plus, add: true, on: false, here: "page" as const },
    { href: "/family", label: t.tabs.family, Icon: Users, on: path.startsWith("/family"), here: "page" as const },
    { href: "/#ask", label: t.tabs.ask, Icon: Sparkles, on: home && asking, here: "location" as const },
  ];
  return (
    <motion.nav
      layoutRoot
      aria-label={t.tabs.label}
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-line bg-paper/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)", paddingLeft: "env(safe-area-inset-left, 0px)", paddingRight: "env(safe-area-inset-right, 0px)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {tabs.map(({ href, label, Icon, add, on, here }) => (
          <li key={href}>
            <TLink href={href} aria-current={on ? here : undefined} className={cn("relative flex min-h-[3.75rem] flex-col items-center justify-center gap-0.5 text-[0.72rem] transition-colors duration-300", on ? "text-burgundy" : "text-ink-soft")}>
              {/* a soft mark behind the current tab, gliding from tab to tab */}
              {on && <motion.span layoutId="phone-tab" aria-hidden className="absolute top-1.5 h-8 w-14 rounded-full bg-blush/70" style={{ borderRadius: 999 }} transition={{ type: "spring", visualDuration: 0.4, bounce: 0 }} />}
              {add ? (
                <span className="-mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose text-white shadow-[0_8px_18px_-6px_rgba(118,46,73,0.5)] ring-4 ring-paper">
                  <Icon className="h-6 w-6" strokeWidth={1.8} aria-hidden />
                </span>
              ) : (
                <Icon className="relative h-[1.35rem] w-[1.35rem]" strokeWidth={on ? 1.9 : 1.5} aria-hidden />
              )}
              <span className={cn("relative", add && "text-burgundy")}>{label}</span>
            </TLink>
          </li>
        ))}
      </ul>
    </motion.nav>
  );
}
