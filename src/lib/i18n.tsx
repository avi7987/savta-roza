"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { dict, type Lang } from "./dict";

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (typeof dict)[Lang]; dir: "rtl" | "ltr" };

const LangContext = createContext<Ctx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("he");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("roza-lang");
      if (saved === "he" || saved === "ru") setLangState(saved);
    } catch {}
  }, []);

  const dir = lang === "he" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("roza-lang", l);
    } catch {}
  };

  return <LangContext.Provider value={{ lang, setLang, t: dict[lang], dir }}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang outside LangProvider");
  return ctx;
}
