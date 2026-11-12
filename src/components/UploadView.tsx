"use client";

import { TLink } from "@/components/Transition";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { ArrowRight, Check, ImagePlus, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { LangToggle } from "@/components/Header";
import { cn, RoseMark } from "@/components/ui";

function PetalRain() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: 36 }, (_, i) => (
        <motion.span
          key={i}
          initial={{ y: -40, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: "110vh", x: (i % 2 ? 1 : -1) * (40 + (i * 13) % 80), rotate: 360 + i * 20, opacity: [1, 1, 0] }}
          transition={{ duration: 2.8 + (i % 5) * 0.3, delay: (i % 12) * 0.08, ease: "easeIn" }}
          className="absolute top-0 h-4 w-3 rounded-[60%_40%_60%_40%]"
          style={{ left: `${(i * 37) % 100}%`, backgroundColor: ["#e0457b", "#f7a8c4", "#f3c77a", "#f9c9d8"][i % 4] }}
        />
      ))}
    </div>
  );
}

export default function UploadView() {
  const { t, dir } = useLang();
  const u = t.upload;
  const [type, setType] = useState(0);
  const [when, setWhen] = useState(1);
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);
  const [saved, setSaved] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const field = "w-full rounded-2xl bg-white px-4 py-3.5 text-base text-ink ring-1 ring-ink/10 outline-none transition focus:ring-2 focus:ring-rosa placeholder:text-ink/35";

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 start-[-20%] h-[36rem] w-[36rem] animate-aurora rounded-full bg-petal/50 blur-3xl" />
        <div className="absolute bottom-0 end-[-20%] h-[30rem] w-[30rem] animate-aurora rounded-full bg-honey/25 blur-3xl [animation-delay:-8s]" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 pt-6">
        <TLink href="/" aria-label={u.home} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 ring-1 ring-ink/10 backdrop-blur">
          <ArrowRight className={cn("h-5 w-5", dir === "ltr" && "rotate-180")} aria-hidden />
        </TLink>
        <LangToggle compact />
      </header>

      <main className="relative z-10 mx-auto max-w-2xl px-5 pb-20 pt-8">
        <AnimatePresence mode="wait">
          {!saved ? (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, filter: "blur(8px)" }}
              onSubmit={(e) => {
                e.preventDefault();
                setSaved(true);
              }}
              className="flex flex-col gap-8"
            >
              <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-black tracking-tight text-ink sm:text-5xl">{u.title}</h1>
                <p className="text-lg text-ink-soft">{u.hello}</p>
              </div>

              <motion.label
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(true);
                }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(false);
                  setFiles((f) => [...f, ...Array.from(e.dataTransfer.files)]);
                }}
                animate={{ scale: over ? 1.02 : 1 }}
                className="border-beam flex cursor-pointer flex-col items-center gap-3 rounded-[2rem] bg-white/80 px-6 py-12 text-center shadow-[0_30px_80px_-40px_rgba(163,22,74,0.5)] backdrop-blur"
              >
                <motion.span animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.4 }} className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blush text-rosa">
                  <ImagePlus className="h-8 w-8" aria-hidden />
                </motion.span>
                <span className="text-xl font-bold text-ink">{u.drop}</span>
                <span className="text-ink-soft">{u.dropSub}</span>
                <input ref={input} type="file" multiple accept="image/*,video/*,audio/*" className="sr-only" onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files ?? [])])} />
              </motion.label>

              <AnimatePresence>
                {files.length > 0 && (
                  <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap gap-2">
                    {files.map((f, i) => (
                      <motion.li layout key={`${f.name}-${i}`} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-ink/10">
                        {f.name}
                        <button type="button" aria-label="remove" onClick={() => setFiles((all) => all.filter((_, j) => j !== i))} className="text-ink-soft hover:text-rosa">
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      </motion.li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>

              <fieldset className="flex flex-wrap gap-2">
                <legend className="sr-only">type</legend>
                {u.types.map((ty, i) => (
                  <button
                    key={ty}
                    type="button"
                    aria-pressed={type === i}
                    onClick={() => setType(i)}
                    className={cn("relative min-h-11 rounded-full px-5 text-[15px] transition-colors", type === i ? "text-white" : "bg-white text-ink-soft ring-1 ring-ink/10")}
                  >
                    {type === i && <motion.span layoutId="type-pill" className="absolute inset-0 rounded-full bg-rosa" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                    <span className="relative">{ty}</span>
                  </button>
                ))}
              </fieldset>

              <fieldset className="flex flex-col gap-3">
                <legend className="mb-3 text-lg font-bold text-ink">{u.when}</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {u.whens.map((w, i) => (
                    <button
                      key={w}
                      type="button"
                      aria-pressed={when === i}
                      onClick={() => setWhen(i)}
                      className={cn("min-h-14 rounded-2xl px-4 py-3 text-start text-[15px] ring-1 transition", when === i ? "bg-blush text-ink ring-2 ring-rosa" : "bg-white text-ink-soft ring-ink/10")}
                    >
                      {w}
                    </button>
                  ))}
                </div>
                <AnimatePresence>
                  {when !== 2 && (
                    <motion.label initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-2 overflow-hidden px-0.5 pb-1 pt-1 text-ink-soft">
                      {u.year}
                      <input inputMode="numeric" placeholder="1965" className={field} />
                    </motion.label>
                  )}
                </AnimatePresence>
              </fieldset>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-lg font-bold text-ink">
                  {u.where}
                  <input placeholder={u.wherePh} className={field} />
                </label>
                <label className="flex flex-col gap-2 text-lg font-bold text-ink">
                  {u.who}
                  <input placeholder={u.whoPh} className={field} />
                </label>
              </div>

              <label className="flex flex-col gap-2 text-lg font-bold text-ink">
                {u.story}
                <textarea rows={4} placeholder={u.storyPh} className={cn(field, "resize-y")} />
                <span className="text-sm font-normal text-ink-soft">{u.storyHint}</span>
              </label>

              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="relative min-h-14 overflow-hidden rounded-full bg-gradient-to-br from-rosa to-rosa-deep text-lg font-bold text-white shadow-[0_20px_40px_-15px_rgba(224,69,123,0.8)]"
              >
                <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                <span className="relative">{u.save}</span>
              </motion.button>
            </motion.form>
          ) : (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 120, damping: 14 }} className="flex flex-col items-center gap-6 pt-16 text-center">
              <PetalRain />
              <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.2 }} className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-rosa to-rosa-deep text-white shadow-2xl">
                <Check className="h-12 w-12" aria-hidden />
              </motion.span>
              <h1 className="text-4xl font-black text-ink">{u.saved}</h1>
              <p className="max-w-md text-lg text-ink-soft">{u.savedSub}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSaved(false);
                    setFiles([]);
                  }}
                  className="min-h-12 rounded-full bg-ink px-6 text-white"
                >
                  {u.another}
                </button>
                <TLink href="/" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-ink ring-1 ring-ink/10">
                  <RoseMark className="h-5 w-5 text-rosa" />
                  {u.home}
                </TLink>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
