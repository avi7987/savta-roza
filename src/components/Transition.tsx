"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";

type SiteCtx = { go: (href: string) => void; ready: boolean; setReady: (b: boolean) => void };

/** In the single-file preview build there is no server routing, so the upload screen lives at #upload. */
export const STATIC = process.env.NEXT_PUBLIC_STATIC === "1";

export function useHashView() {
  const [view, setView] = useState<string>("");
  useEffect(() => {
    const read = () => setView(window.location.hash.replace("#", ""));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return view;
}

const Ctx = createContext<SiteCtx>({ go: () => {}, ready: true, setReady: () => {} });

export const useSite = () => useContext(Ctx);

/** Holds the intro "ready" flag and runs the rose-curtain page transition between routes. */
export function TransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [covering, setCovering] = useState(false);
  const [ready, setReady] = useState(false);
  const target = useRef<string | null>(null);
  const prev = useRef(pathname);

  useEffect(() => {
    if (prev.current === pathname) return;
    prev.current = pathname;
    const lenis = (window as unknown as { __lenis?: { scrollTo: (n: number, o: object) => void } }).__lenis;
    lenis?.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
    const id = setTimeout(() => setCovering(false), 150);
    return () => clearTimeout(id);
  }, [pathname]);

  const go = (href: string) => {
    if (!STATIC && href === pathname) return;
    target.current = href;
    if (!STATIC) router.prefetch(href);
    setCovering(true);
  };

  const arrive = (href: string) => {
    if (!STATIC) {
      router.push(href);
      return;
    }
    if (href === "/upload") window.location.hash = "upload";
    else history.replaceState(null, "", window.location.pathname + window.location.search);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    const lenis = (window as unknown as { __lenis?: { scrollTo: (n: number, o: object) => void } }).__lenis;
    if (href === "/") lenis?.scrollTo(0, { immediate: true, force: true });
    setTimeout(() => setCovering(false), 200);
  };

  return (
    <Ctx.Provider value={{ go, ready, setReady }}>
      {children}
      <AnimatePresence>
        {covering && (
          <motion.div
            key="curtain"
            aria-hidden
            className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-rosa via-rosa-deep to-[#6e0f33]"
            initial={{ clipPath: "circle(0% at 50% 100%)" }}
            animate={{ clipPath: "circle(150% at 50% 100%)" }}
            exit={{ clipPath: "circle(0% at 50% 0%)" }}
            transition={{ duration: 0.75, ease: [0.76, 0, 0.24, 1] }}
            onAnimationComplete={() => {
              if (target.current) {
                const href = target.current;
                target.current = null;
                arrive(href);
              }
            }}
          >
            <motion.svg
              viewBox="0 0 24 24"
              className="h-20 w-20 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              initial={{ scale: 0.6, opacity: 0, rotate: -30 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <path d="M12 6.5c-2.2 0-3.6 1.5-3.6 3.3 0 1.6 1.2 2.7 2.7 2.7 1.3 0 2.2-.9 2.2-2 0-.9-.7-1.5-1.5-1.5" />
              <path d="M8.6 8.4C7.2 9 6.4 10.3 6.4 11.8c0 2.5 2.4 4.4 5.6 4.4s5.6-1.9 5.6-4.4c0-1.6-.9-2.9-2.3-3.5" />
              <path d="M9.2 7.2c.6-1.4 1.6-2.2 2.8-2.2s2.3.8 2.9 2.1" />
              <path d="M12 16.2V22" />
            </motion.svg>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}

/** Link that plays the curtain transition before navigating. */
export function TLink({ href, onClick, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const { go } = useSite();
  return (
    <a
      href={href}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || href.startsWith("#")) return;
        e.preventDefault();
        go(href);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
