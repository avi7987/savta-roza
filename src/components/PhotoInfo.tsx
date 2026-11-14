"use client";

import { useMemo, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import type { Photo } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { formatDate, sourceLabel, type PhotoDate } from "@/lib/photoDate";
import { useFamily } from "./family/useFamily";
import { refreshPhotos, usePhotos } from "./gallery/usePhotos";
import { DECADES, RemovalRequest } from "./PhotoActions";
import { cn } from "./ui";

type Note = NonNullable<Photo["notes"]>[number];
const NAME_KEY = "roza-my-name";
const myName = () => {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
};

/** "Tell us more about this photo": who, when, where, what happened. Every field optional. */
function TellMore({ photo, onSaved, onCancel }: { photo: Photo; onSaved: (n: Note, date?: PhotoDate) => void; onCancel: () => void }) {
  const { t, lang } = useLang();
  const { graph, nameOf } = useFamily();
  const [people, setPeople] = useState<string[]>(photo.people ?? []);
  const [filter, setFilter] = useState("");
  const [who, setWho] = useState("");
  const [decade, setDecade] = useState<number | null>(null);
  const [year, setYear] = useState("");
  const [place, setPlace] = useState("");
  const [what, setWhat] = useState("");
  const [by, setBy] = useState(myName);
  const [state, setState] = useState<"idle" | "sending" | "failed" | "empty">("idle");
  const canDate = !photo.when || photo.when.source === "ai";
  const known = useMemo(() => graph.people.filter((p) => p.name && !p.placeholder && !p.pending), [graph]);
  const list = known.filter((p) => !filter || `${p.name} ${p.nameAlt ?? ""}`.toLowerCase().includes(filter.toLowerCase()));
  const decadeLabel = (d: number) => (lang === "ru" ? `${d}-е` : d >= 2000 ? `שנות ה־${d}` : `שנות ה־${String(d).slice(2)}`);

  const send = async () => {
    const added = people.filter((id) => !(photo.people ?? []).includes(id));
    if (!added.length && !who.trim() && !decade && !year && !place.trim() && !what.trim()) return setState("empty");
    setState("sending");
    try {
      localStorage.setItem(NAME_KEY, by.trim());
    } catch {}
    const r = await fetch("/api/photos/info", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memoryId: photo.memoryId, file: photo.file, people: added, who, decade: canDate && !year ? decade : undefined, year: canDate && year ? Number(year) : undefined, place, what, by }),
    }).catch(() => null);
    if (!r?.ok) return setState("failed");
    const d = (await r.json()) as { file?: { notes?: Note[]; date?: PhotoDate } };
    onSaved(d.file?.notes?.at(-1) ?? { at: new Date().toISOString() }, d.file?.date);
    refreshPhotos();
  };

  const field = "w-full rounded-xl border border-charcoal/15 bg-white px-4 py-3 text-[1.02rem] text-charcoal placeholder:text-ink-soft/70";
  const label = "text-[1rem] font-medium text-charcoal";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="flex flex-col gap-5 rounded-2xl bg-white/70 p-5 ring-1 ring-charcoal/5"
    >
      <div>
        <h3 className="font-display text-[1.45rem] text-burgundy">{t.info.tellTitle}</h3>
        <p className="mt-1 text-[0.92rem] text-ink-soft">{t.info.tellLead}</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={cn(label, "mb-2")}>{t.info.who}</legend>
        {known.length > 8 && <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t.info.findName} aria-label={t.info.findName} className={field} />}
        {known.length > 0 && (
          <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
            {list.map((p) => {
              const on = people.includes(p.id);
              return (
                <button key={p.id} type="button" aria-pressed={on} onClick={() => setPeople(on ? people.filter((x) => x !== p.id) : [...people, p.id])} className={cn("min-h-10 rounded-full px-3.5 text-[0.95rem] transition-colors", on ? "bg-burgundy text-white" : "bg-ivory text-charcoal ring-1 ring-charcoal/10")}>
                  {nameOf(p.id)}
                </button>
              );
            })}
          </div>
        )}
        <input value={who} onChange={(e) => setWho(e.target.value)} maxLength={300} placeholder={t.info.whoFree} aria-label={t.info.whoFree} className={field} />
      </fieldset>

      {canDate && (
        <fieldset className="flex flex-col gap-2">
          <legend className={cn(label, "mb-2")}>{t.info.when}</legend>
          <div className="flex flex-wrap gap-1.5">
            {DECADES.map((d) => (
              <button key={d} type="button" aria-pressed={decade === d} onClick={() => setDecade(decade === d ? null : d)} className={cn("min-h-10 rounded-full px-3.5 text-[0.92rem] tabular-nums", decade === d ? "bg-burgundy text-white" : "bg-ivory text-charcoal ring-1 ring-charcoal/10")}>
                {decadeLabel(d)}
              </button>
            ))}
          </div>
          <input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder={t.info.exactYear} aria-label={t.info.exactYear} className={cn(field, "max-w-[12rem]")} />
        </fieldset>
      )}

      <label className="flex flex-col gap-2">
        <span className={label}>{t.info.where}</span>
        <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={160} placeholder={t.info.wherePh} className={field} />
      </label>

      <label className="flex flex-col gap-2">
        <span className={label}>{t.info.what}</span>
        <textarea value={what} onChange={(e) => setWhat(e.target.value)} maxLength={2000} rows={3} placeholder={t.info.whatPh} className={field} />
      </label>

      <label className="flex flex-col gap-2">
        <span className={label}>{t.info.by}</span>
        <input value={by} onChange={(e) => setBy(e.target.value)} maxLength={80} autoComplete="name" className={field} />
      </label>

      {state === "empty" && <p role="alert" className="text-burgundy">{t.info.empty}</p>}
      {state === "failed" && <p role="alert" className="text-burgundy">{t.info.failed}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={state === "sending"} className="min-h-12 flex-1 rounded-full bg-rose px-6 text-[1.05rem] text-white transition-colors hover:bg-burgundy disabled:opacity-60">
          {state === "sending" ? t.info.sending : t.info.send}
        </button>
        <button type="button" onClick={onCancel} className="min-h-12 rounded-full px-5 text-ink-soft hover:text-charcoal">
          {t.removal.cancel}
        </button>
      </div>
    </form>
  );
}

/**
 * Everything we know about one photo, and how we know it: what the uploader wrote,
 * what the family added, the date and where it came from. Machine estimates are labelled as such.
 */
export default function PhotoInfo({ photo, onChange, onJump }: { photo: Photo; onChange: (patch: Partial<Photo>) => void; onJump: (p: Photo) => void }) {
  const { t, l, lang } = useLang();
  const { nameOf, graph } = useFamily();
  const { photos: all } = usePhotos();
  const [telling, setTelling] = useState(false);
  const [thanks, setThanks] = useState(false);

  const related = useMemo(() => {
    const same = all.filter((p) => p.memoryId === photo.memoryId && p.id !== photo.id && p.kind !== "audio");
    const near = photo.year ? all.filter((p) => p.memoryId !== photo.memoryId && p.year && Math.abs(p.year - photo.year!) <= 1 && p.kind !== "audio") : [];
    const withPeople = photo.people?.length ? all.filter((p) => p.id !== photo.id && p.memoryId !== photo.memoryId && p.kind !== "audio" && p.people?.some((x) => x !== "rosa" && photo.people!.includes(x))) : [];
    return Array.from(new Map([...same, ...withPeople, ...near].map((p) => [p.id, p])).values()).slice(0, 8);
  }, [all, photo]);

  const people = (photo.people ?? []).filter((id) => graph.byId.has(id));
  const notes = photo.notes ?? [];
  const estimate = photo.when?.source === "ai";

  return (
    <div className="flex flex-col gap-7 text-charcoal">
      <div className="flex flex-col gap-2">
        {photo.caption && <h2 className="font-display text-[1.7rem] leading-tight text-burgundy">{l(photo.caption)}</h2>}
        <p className="text-[1rem]">
          {photo.when ? formatDate(photo.when, lang) : t.info.noDate}
          {photo.when && <span className="text-ink-soft"> · {sourceLabel(photo.when, lang)}</span>}
        </p>
        {estimate && <p className="rounded-lg bg-blush/40 px-3 py-2 text-[0.85rem] text-burgundy">{t.info.estimateNote}{photo.when?.clues ? ` ${photo.when.clues}` : ""}</p>}
        {photo.contributor && (
          <p className="text-[0.92rem] text-ink-soft">
            {t.lightbox.by}: {photo.contributor}
          </p>
        )}
      </div>

      {photo.story && (
        <blockquote dir="auto" lang={photo.storyLang} className="whitespace-pre-line border-s-2 border-dusty ps-4 font-display text-[1.2rem] leading-relaxed text-charcoal/90">
          {photo.story}
        </blockquote>
      )}

      {people.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="label">{t.info.inPhoto}</h3>
          <ul className="flex flex-wrap gap-1.5">
            {people.map((id) => (
              <li key={id} className="rounded-full bg-white px-3 py-1.5 text-[0.95rem] ring-1 ring-charcoal/10">
                {nameOf(id)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {notes.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="label">{t.info.told}</h3>
          <ul className="flex flex-col gap-3">
            {notes.map((n) => (
              <li key={n.at} className="rounded-xl bg-white/70 p-4 ring-1 ring-charcoal/5">
                {n.what && <p dir="auto" className="whitespace-pre-line leading-relaxed">{n.what}</p>}
                <p className="mt-1 text-[0.9rem] text-charcoal/80">
                  {[n.when && `${t.info.whenShort}: ${n.when}`, n.place && `${t.info.whereShort}: ${n.place}`, (n.people?.length || n.who) && `${t.info.whoShort}: ${[...(n.people ?? []).map(nameOf), n.who].filter(Boolean).join(", ")}`].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 text-[0.8rem] text-ink-soft">— {n.by || t.info.someone}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {photo.memoryId && photo.file && (
        <div>
          {thanks && !telling && <p role="status" className="mb-3 text-sage-deep">{t.info.thanks}</p>}
          {telling ? (
            <TellMore
              photo={photo}
              onCancel={() => setTelling(false)}
              onSaved={(n, date) => {
                onChange({ notes: [...notes, n], people: Array.from(new Set([...(photo.people ?? []), ...(n.people ?? [])])), when: date ?? photo.when });
                setTelling(false);
                setThanks(true);
              }}
            />
          ) : (
            <button type="button" onClick={() => setTelling(true)} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full border border-rose/50 bg-white px-6 text-[1.05rem] text-burgundy transition-colors hover:bg-rose hover:text-white">
              <MessageSquarePlus className="h-5 w-5" strokeWidth={1.5} aria-hidden />
              {t.info.tellButton}
            </button>
          )}
        </div>
      )}

      {related.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="label">{t.info.related}</h3>
          <ul className="grid grid-cols-4 gap-2">
            {related.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => onJump(p)} aria-label={`${t.gallery.open}${p.year ? `, ${p.year}` : ""}`} className="block aspect-square w-full overflow-hidden rounded-[6px] bg-mount">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {photo.memoryId && photo.file && (
        <div className="border-t border-line pt-4">
          <RemovalRequest key={`r-${photo.id}`} memoryId={photo.memoryId} file={photo.file} requested={photo.removalRequested} />
        </div>
      )}
    </div>
  );
}
