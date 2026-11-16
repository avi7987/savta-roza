"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import type { Photo } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { decadeLabel } from "@/lib/photoDate";
import { LanguageSwitcher } from "../Header";
import PeoplePicker, { refreshNames } from "../people/PeoplePicker";
import { DECADES } from "../PhotoActions";
import { TLink } from "../Transition";
import { Container, Segmented, buttonClass, cn } from "../ui";
import { refreshPhotos, usePhotos } from "./usePhotos";

type Filter = "undated" | "untagged" | "all";
const NAME = "roza-my-name";
const undated = (p: Photo) => !p.when || p.when.source === "ai";
const untagged = (p: Photo) => !(p.people ?? []).some((x) => x !== "rosa");

/**
 * After a big upload: many photos without details. Pick several, then give them a decade (or a year)
 * and the people in them, all at once. Each change is kept as a note with the name of who made it.
 */
export default function SortView() {
  const { t, lang } = useLang();
  const s = t.sort;
  const { photos, loaded } = usePhotos();
  const [filter, setFilter] = useState<Filter>("undated");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [decade, setDecade] = useState<number | null>(null);
  const [year, setYear] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [newNames, setNewNames] = useState<string[]>([]);
  const [by, setBy] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "failed" | "empty" | "name"; n?: number }>({ kind: "idle" });

  useEffect(() => {
    try {
      setBy(localStorage.getItem(NAME) ?? "");
    } catch {}
  }, []);

  const visual = useMemo(() => photos.filter((p) => p.kind !== "audio" && p.memoryId && p.file), [photos]);
  const shown = useMemo(() => visual.filter((p) => (filter === "undated" ? undated(p) : filter === "untagged" ? untagged(p) : true)), [visual, filter]);
  const counts = { undated: visual.filter(undated).length, untagged: visual.filter(untagged).length, all: visual.length };

  const toggle = (id: string) =>
    setChosen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    if (!decade && !year && !people.length && !newNames.length) return setState({ kind: "empty" });
    if (by.trim().length < 2) return setState({ kind: "name" });
    setState({ kind: "saving" });
    try {
      localStorage.setItem(NAME, by.trim());
    } catch {}
    const items = visual.filter((p) => chosen.has(p.id)).map((p) => ({ memoryId: p.memoryId, file: p.file }));
    const r = await fetch("/api/photos/bulk-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, people, newPeople: newNames, decade: year ? undefined : decade, year: year ? Number(year) : undefined, by }),
    }).catch(() => null);
    if (!r?.ok) return setState({ kind: "failed" });
    const d = (await r.json()) as { changed: number };
    setState({ kind: "saved", n: d.changed });
    setChosen(new Set());
    setDecade(null);
    setYear("");
    setPeople([]);
    setNewNames([]);
    if (newNames.length) refreshNames();
    refreshPhotos();
  };

  const n = chosen.size;
  return (
    <div className="min-h-[100svh] bg-ivory pb-[22rem]">
      <header className="sticky top-0 z-40 bg-ivory/95 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <Container wide className="flex h-14 items-center justify-between sm:h-16">
          <TLink href="/gallery" className="group inline-flex min-h-11 items-center gap-2 text-[0.95rem] text-burgundy">
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 ltr:rotate-180" strokeWidth={1.5} aria-hidden />
            {t.bulk.album}
          </TLink>
          <LanguageSwitcher />
        </Container>
      </header>

      <main id="content">
        <Container wide className="flex flex-col gap-6 pt-4">
          <div className="flex max-w-2xl flex-col gap-2">
            <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-light text-burgundy">{s.title}</h1>
            <p className="text-[1.02rem] leading-relaxed text-ink-soft">{s.lead}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Segmented label={s.filter} value={filter} onChange={(f) => (setFilter(f), setChosen(new Set()))} options={(["undated", "untagged", "all"] as Filter[]).map((f) => ({ id: f, label: `${s.filters[f]} · ${counts[f]}` }))} />
            {shown.length > 0 && (
              <button type="button" onClick={() => setChosen(n === shown.length ? new Set() : new Set(shown.map((p) => p.id)))} className="min-h-11 px-2 text-[0.95rem] text-burgundy underline decoration-dusty/50 underline-offset-4">
                {n === shown.length ? s.clear : s.selectAll}
              </button>
            )}
          </div>

          {state.kind === "saved" && <p role="status" className="rounded-[14px] bg-white/80 px-4 py-3 text-burgundy ring-1 ring-blush">{s.saved(state.n ?? 0)}</p>}
          {loaded && !shown.length && <p className="py-16 text-center text-ink-soft">{s.none}</p>}

          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
            {shown.map((p) => {
              const on = chosen.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={`${s.open}${p.year ? `, ${p.year}` : ""}`}
                    onClick={() => toggle(p.id)}
                    className={cn("relative block aspect-square w-full overflow-hidden rounded-[10px] bg-mount transition-[box-shadow,transform] duration-200", on ? "scale-[0.94] shadow-[0_0_0_3px_var(--color-rose)]" : "hover:scale-[0.98]")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.src} alt="" loading="lazy" className="h-full w-full object-cover" />
                    <span className={cn("absolute end-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors", on ? "border-rose bg-rose text-white" : "border-white/90 bg-black/15")}>
                      {on && <Check className="h-4 w-4" aria-hidden />}
                    </span>
                    {p.year && <span className="absolute bottom-1 start-1 rounded-full bg-white/85 px-1.5 text-[0.7rem] tabular-nums text-charcoal">{p.year}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </Container>
      </main>

      {/* what to give the chosen photos: rises from the bottom once something is chosen */}
      <AnimatePresence>
        {n > 0 && (
          <motion.section
            aria-label={s.selected(n)}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", visualDuration: 0.4, bounce: 0.1 }}
            className="fixed inset-x-0 bottom-0 z-[75] max-h-[70svh] overflow-y-auto rounded-t-[22px] bg-paper shadow-[0_-12px_40px_-12px_rgba(70,35,45,0.35)] ring-1 ring-line"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <Container wide className="flex flex-col gap-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-[1.3rem] text-burgundy">{s.selected(n)}</span>
                <button type="button" onClick={() => setChosen(new Set())} className="min-h-10 px-2 text-[0.9rem] text-ink-soft hover:text-charcoal">
                  {s.clear}
                </button>
              </div>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-[1rem] text-charcoal">{s.when}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {DECADES.map((d) => (
                    <button key={d} type="button" aria-pressed={decade === d && !year} onClick={() => (setDecade(decade === d ? null : d), setYear(""))} className={cn("min-h-10 rounded-full px-3.5 text-[0.92rem]", decade === d && !year ? "bg-burgundy text-white" : "bg-white text-charcoal ring-1 ring-charcoal/10")}>
                      {decadeLabel(d, lang)}
                    </button>
                  ))}
                </div>
                <input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder={s.year} aria-label={s.year} className="w-full max-w-[12rem] rounded-xl border border-charcoal/15 bg-white px-4 py-3 text-[1rem]" />
                <span className="text-[0.8rem] text-ink-soft">{s.datedNote}</span>
              </fieldset>
              <PeoplePicker
                label={s.who}
                selected={people}
                added={newNames}
                onChange={(ids, names) => {
                  setPeople(ids);
                  setNewNames(names);
                }}
              />
              <label className="flex max-w-sm flex-col gap-1.5">
                <span className="text-[1rem] text-charcoal">{s.by}</span>
                <input value={by} onChange={(e) => setBy(e.target.value)} maxLength={80} autoComplete="name" className="rounded-xl border border-charcoal/15 bg-white px-4 py-3 text-[1rem]" />
              </label>
              {state.kind === "empty" && <p role="alert" className="text-burgundy">{s.empty}</p>}
              {state.kind === "name" && <p role="alert" className="text-burgundy">{s.needName}</p>}
              {state.kind === "failed" && <p role="alert" className="text-burgundy">{s.failed}</p>}
              <button type="button" onClick={save} disabled={state.kind === "saving"} className={cn(buttonClass.primary, "min-h-14 w-full justify-center sm:w-fit sm:px-10")}>
                {state.kind === "saving" ? s.saving : s.apply}
              </button>
            </Container>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
