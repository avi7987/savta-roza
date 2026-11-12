"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ui, type UI } from "@/i18n/ui";
import type { Lang, Localized } from "@/content/types";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: UI;
  dir: "rtl" | "ltr";
  /** pick the visitor's language from a localized content field */
  l: (v?: Localized) => string;
};

const LangContext = createContext<Ctx | null>(null);
const KEY = "roza-lang";

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("he");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "he" || saved === "ru") setLangState(saved);
    } catch {}
  }, []);

  const dir = lang === "he" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {}
  }, []);

  const l = useCallback((v?: Localized) => (v ? v[lang] : ""), [lang]);

  return <LangContext.Provider value={{ lang, setLang, t: ui[lang], dir, l }}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside LangProvider");
  return ctx;
}
