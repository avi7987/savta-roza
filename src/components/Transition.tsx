"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";

/** In the single-file preview build there is no server routing, so the share screen lives at #share. */
export const STATIC = process.env.NEXT_PUBLIC_STATIC === "1";

export function useHashView() {
  const [view, setView] = useState("");
  useEffect(() => {
    const read = () => setView(window.location.hash.replace("#", ""));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return view;
}

type Ctx = { go: (href: string) => void };
const SiteCtx = createContext<Ctx>({ go: () => {} });
export const useSite = () => useContext(SiteCtx);

type LenisLike = { scrollTo: (t: number | HTMLElement, o?: object) => void; stop: () => void; start: () => void };
export const getLenis = () => (typeof window === "undefined" ? undefined : (window as unknown as { __lenis?: LenisLike }).__lenis);

/** A short ivory fade between pages: calm, like turning to the next page of an album. */
export function TransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [veil, setVeil] = useState(false);
  const target = useRef<string | null>(null);
  const prev = useRef(pathname);

  useEffect(() => {
    if (prev.current === pathname) return;
    prev.current = pathname;
    getLenis()?.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
    const id = setTimeout(() => setVeil(false), 80);
    return () => clearTimeout(id);
  }, [pathname]);

  const arrive = (href: string) => {
    if (!STATIC) {
      router.push(href);
      return;
    }
    const [path, hash] = href.split("#");
    if (path === "/share") window.location.hash = "share";
    else {
      history.replaceState(null, "", window.location.pathname + window.location.search);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      if (hash) setTimeout(() => document.getElementById(hash) && getLenis()?.scrollTo(document.getElementById(hash)!, { immediate: true }), 50);
    }
    setTimeout(() => setVeil(false), 120);
  };

  const go = (href: string) => {
    if (!STATIC && href === pathname) return;
    target.current = href;
    if (!STATIC) router.prefetch(href);
    setVeil(true);
  };

  return (
    <SiteCtx.Provider value={{ go }}>
      {children}
      <AnimatePresence>
        {veil && (
          <motion.div
            key="veil"
            aria-hidden
            className="fixed inset-0 z-[100] bg-ivory"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            onAnimationComplete={() => {
              if (target.current) {
                const href = target.current;
                target.current = null;
                arrive(href);
              }
            }}
          />
        )}
      </AnimatePresence>
    </SiteCtx.Provider>
  );
}

/** Link between pages that uses the soft fade. In-page anchors scroll smoothly instead. */
export function TLink({ href, onClick, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const { go } = useSite();
  const pathname = usePathname();
  return (
    <a
      href={STATIC && href === "/share" ? "#share" : href}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        const [path, hash] = href.split("#");
        const samePage = href.startsWith("#") || ((path === "" || path === pathname) && !STATIC) || (STATIC && path === "/" && window.location.hash !== "#share");
        if (samePage && hash) {
          const el = document.getElementById(hash);
          if (el) {
            e.preventDefault();
            const lenis = getLenis();
            if (lenis) lenis.scrollTo(el, { offset: -24, duration: 1.4 });
            else el.scrollIntoView({ behavior: "smooth" });
            return;
          }
        }
        e.preventDefault();
        go(href);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
