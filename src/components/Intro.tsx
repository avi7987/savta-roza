"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { useSite } from "./Transition";

/** Opening moment: a rose is drawn line by line, the name fades in, then the curtain lifts. */
export default function Intro() {
  const { t } = useLang();
  const { setReady } = useSite();
  const [show, setShow] = useState(true);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("roza-intro") === "1";
      sessionStorage.setItem("roza-intro", "1");
    } catch {}
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = seen || reduce ? 250 : 2600;
    const id = setTimeout(() => {
      setShow(false);
      setReady(true);
    }, ms);
    return () => clearTimeout(id);
  }, [setReady]);

  const draw = (delay: number) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { pathLength: { delay, duration: 1.1, ease: [0.65, 0, 0.35, 1] as const }, opacity: { delay, duration: 0.2 } },
  });

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="intro"
          className="fixed inset-0 z-[120] flex flex-col items-center justify-center gap-6 bg-cream"
          exit={{ y: "-100%", borderBottomLeftRadius: "50% 20%", borderBottomRightRadius: "50% 20%" }}
          transition={{ duration: 1, ease: [0.76, 0, 0.24, 1] }}
        >
          <motion.svg viewBox="0 0 24 24" className="h-28 w-28 text-rosa" fill="none" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <motion.path d="M12 6.5c-2.2 0-3.6 1.5-3.6 3.3 0 1.6 1.2 2.7 2.7 2.7 1.3 0 2.2-.9 2.2-2 0-.9-.7-1.5-1.5-1.5" {...draw(0.1)} />
            <motion.path d="M8.6 8.4C7.2 9 6.4 10.3 6.4 11.8c0 2.5 2.4 4.4 5.6 4.4s5.6-1.9 5.6-4.4c0-1.6-.9-2.9-2.3-3.5" {...draw(0.35)} />
            <motion.path d="M9.2 7.2c.6-1.4 1.6-2.2 2.8-2.2s2.3.8 2.9 2.1" {...draw(0.6)} />
            <motion.path d="M12 16.2V22" {...draw(0.8)} className="text-sage" stroke="#5f8f6f" />
            <motion.path d="M12 19.5c-1.6-.2-2.9-1-3.5-2.4 1.6-.1 2.9.6 3.5 2.4z" {...draw(0.95)} stroke="#5f8f6f" />
          </motion.svg>
          <motion.span
            initial={{ opacity: 0, y: 14, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 1.1, duration: 0.9 }}
            className="font-hand text-6xl font-bold text-ink"
          >
            {t.brand}
          </motion.span>
          <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.2, duration: 2.2, ease: "easeInOut" }} className="h-px w-40 origin-center bg-rosa/40" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
