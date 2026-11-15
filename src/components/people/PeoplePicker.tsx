"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { Person } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { nameScore, sameName } from "@/lib/names";
import { STATIC } from "../Transition";
import { cn } from "../ui";
import PersonAvatar from "../family/PersonAvatar";
import { useFamily } from "../family/useFamily";

export type Entry = { id: string; label: string; names: string[]; person?: Person; hint?: string };

let listCache: { id: string; name: string }[] | null = null;
const subscribers = new Set<(l: { id: string; name: string }[]) => void>();

/** the shared list of names that are not in the tree, fetched once and shared by every picker */
async function loadNames() {
  if (listCache || STATIC) return listCache ?? [];
  try {
    const r = await fetch("/api/people");
    listCache = r.ok ? ((await r.json()).names ?? []) : [];
  } catch {
    listCache = [];
  }
  subscribers.forEach((f) => f(listCache!));
  return listCache!;
}

/** call after a submit that may have added names */
export function refreshNames() {
  listCache = null;
  loadNames();
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** everyone who can be tagged, with every spelling we know for them, and a name for any id */
export function usePeople() {
  const { graph, nameOf, relLabel } = useFamily();
  const { t } = useLang();
  const [names, setNames] = useState(listCache ?? []);

  useEffect(() => {
    subscribers.add(setNames);
    loadNames().then(setNames);
    return () => void subscribers.delete(setNames);
  }, []);

  const entries = useMemo<Entry[]>(
    () => [
      ...graph.people
        .filter((p) => p.name && !p.placeholder && !p.pending)
        .map((p) => ({ id: p.id, label: cap(nameOf(p.id)), names: [p.name, p.nameAlt ?? ""].filter(Boolean), person: p, hint: p.id === "rosa" ? undefined : relLabel(p.id) })),
      ...names.map((n) => ({ id: n.id, label: n.name, names: [n.name], hint: t.picker.notInTree })),
    ],
    [graph, names, nameOf, relLabel, t]
  );

  const labelOf = useCallback((id: string) => entries.find((e) => e.id === id)?.label ?? (graph.byId.has(id) ? cap(nameOf(id)) : ""), [entries, graph, nameOf]);
  return { entries, labelOf };
}

function Initial({ label }: { label: string }) {
  return <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blush/60 text-[0.8rem] text-burgundy">{label.trim().charAt(0)}</span>;
}

/**
 * One search box for tagging people. Type a few letters (Hebrew or Russian) and everyone with a
 * similar name is offered, so small spelling differences do not create a second copy of someone.
 * A name nobody has yet can be added; it joins the shared list when the form is sent.
 */
export default function PeoplePicker({
  selected,
  added,
  onChange,
  label,
  hint,
}: {
  selected: string[];
  added: string[];
  onChange: (ids: string[], added: string[]) => void;
  label: string;
  hint?: string;
}) {
  const { t } = useLang();
  const p = t.picker;
  const uid = useId();
  const { entries, labelOf } = usePeople();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const typed = q.trim();
  const matches = useMemo(() => {
    if (!typed) return [];
    return entries
      .filter((e) => !selected.includes(e.id))
      .map((e) => ({ e, s: nameScore(typed, [...e.names, e.label]) }))
      .filter((x) => x.s >= 0.6)
      .sort((a, b) => b.s - a.s || a.e.label.localeCompare(b.e.label))
      .slice(0, 8);
  }, [entries, selected, typed]);
  const exact = matches.some((m) => m.s === 1) || added.some((n) => sameName(n, typed));
  const canAdd = typed.length >= 2 && !exact;
  const options = [...matches.map((m) => ({ kind: "entry" as const, e: m.e })), ...(canAdd ? [{ kind: "new" as const }] : [])];
  const fuzzyOnly = matches.length > 0 && matches.every((m) => m.s < 0.85);

  useEffect(() => setActive(0), [typed]);
  useEffect(() => {
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const choose = (i: number) => {
    const o = options[i];
    if (!o) return;
    if (o.kind === "entry") onChange([...selected, o.e.id], added);
    else onChange(selected, [...added, typed.replace(/\s+/g, " ")]);
    setQ("");
    inputRef.current?.focus();
  };

  const listId = `${uid}-list`;
  const showList = open && typed.length > 0 && options.length > 0;

  return (
    <div ref={box} className="flex flex-col gap-2.5">
      <label htmlFor={`${uid}-in`} className="text-[1.02rem] text-charcoal">
        {label}
      </label>

      {(selected.length > 0 || added.length > 0) && (
        <ul aria-label={p.selected} className="flex flex-wrap gap-2">
          {selected.map((id) => {
            const e = entries.find((x) => x.id === id);
            const name = labelOf(id) || id;
            return (
              <li key={id} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-burgundy py-1 pe-1 ps-1 text-[0.95rem] text-white">
                {e?.person ? <PersonAvatar person={e.person} label={name} className="w-8 text-[0.7rem]" /> : <Initial label={name} />}
                {name}
                <button type="button" onClick={() => onChange(selected.filter((x) => x !== id), added)} aria-label={p.remove(name)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            );
          })}
          {added.map((n) => (
            <li key={n} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-burgundy py-1 pe-1 ps-1 text-[0.95rem] text-white">
              <Initial label={n} />
              {n}
              <span className="rounded-full bg-white/20 px-2 text-[0.72rem]">{p.isNew}</span>
              <button type="button" onClick={() => onChange(selected, added.filter((x) => x !== n))} aria-label={p.remove(n)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          id={`${uid}-in`}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${uid}-o${active}` : undefined}
          aria-describedby={`${uid}-hint`}
          autoComplete="off"
          value={q}
          maxLength={60}
          placeholder={p.placeholder}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(options.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              if (typed) {
                e.preventDefault();
                choose(active);
              }
            } else if (e.key === "Escape") setOpen(false);
            else if (e.key === "Backspace" && !q) {
              if (added.length) onChange(selected, added.slice(0, -1));
              else if (selected.length) onChange(selected.slice(0, -1), added);
            }
          }}
          className="w-full rounded-[var(--radius-card)] border border-charcoal/15 bg-white px-4 py-3.5 text-[1.05rem] text-charcoal outline-none transition-[border-color,box-shadow] placeholder:text-charcoal/35 focus:border-rose focus:shadow-[0_0_0_3px_rgba(184,92,120,0.15)]"
        />
        {showList && (
          <ul id={listId} role="listbox" aria-label={label} className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-80 overflow-y-auto rounded-[var(--radius-card)] bg-white p-1.5 shadow-[0_12px_32px_-8px_rgba(60,40,30,0.25)] ring-1 ring-charcoal/10">
            {fuzzyOnly && <li className="px-3 pb-1 pt-2 text-[0.82rem] text-ink-soft">{p.maybe}</li>}
            {options.map((o, i) => (
              <li
                key={o.kind === "entry" ? o.e.id : "new"}
                id={`${uid}-o${i}`}
                role="option"
                aria-selected={i === active}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
                onPointerEnter={() => setActive(i)}
                className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-[8px] px-3 py-1.5", i === active ? "bg-blush/40" : "", o.kind === "new" && "mt-1 border-t border-line pt-2.5 text-burgundy")}
              >
                {o.kind === "entry" ? (
                  <>
                    {o.e.person ? <PersonAvatar person={o.e.person} label={o.e.label} className="w-8 text-[0.7rem]" /> : <Initial label={o.e.label} />}
                    <span className="flex flex-col leading-tight">
                      <span className="text-[1rem] text-charcoal">{o.e.label}</span>
                      {o.e.hint && <span className="text-[0.8rem] text-ink-soft">{o.e.hint}</span>}
                    </span>
                  </>
                ) : (
                  <>
                    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-burgundy/40">
                      <Plus className="h-4 w-4" />
                    </span>
                    <span className="text-[0.98rem]">{p.addNew(typed)}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p id={`${uid}-hint`} className="text-[0.85rem] leading-relaxed text-ink-soft">
        {hint ?? p.hint}
      </p>
    </div>
  );
}
