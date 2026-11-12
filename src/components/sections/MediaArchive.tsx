"use client";

import { motion } from "motion/react";
import { useRef, useState } from "react";
import { CalendarHeart, MapPin, Play, Users } from "lucide-react";
import { media, photoById } from "@/content";
import type { MediaItem } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { ease } from "@/lib/motion";
import ArchivalImage from "../ArchivalImage";
import AudioPlayer from "../AudioPlayer";
import { Container, PlaceholderTag, SectionIntro, cn } from "../ui";

const findIcon = { year: CalendarHeart, place: MapPin, people: Users };

function FeatureVideo({ item }: { item: MediaItem }) {
  const { t, l } = useLang();
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [now, setNow] = useState(0);
  const poster = photoById(item.posterId);
  const activeLine = item.transcript ? item.transcript.filter((x) => x.at <= now).length - 1 : -1;

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <figure className="lg:col-span-8">
        <div className="relative overflow-hidden rounded-[var(--radius-photo)] bg-charcoal shadow-[var(--shadow-lift)]">
          {item.src && started ? (
            <video ref={video} src={item.src} controls autoPlay className="aspect-video w-full" onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)} />
          ) : (
            <>
              {poster && <ArchivalImage photo={poster} labelled={false} />}
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal/55 via-transparent to-transparent" />
              <button
                type="button"
                disabled={!item.src}
                onClick={() => setStarted(true)}
                aria-label={`${t.media.play}: ${l(item.title)}`}
                className="group absolute inset-0 flex items-center justify-center disabled:cursor-default"
              >
                <span className="flex h-20 w-20 items-center justify-center rounded-full border border-white/70 bg-white/10 text-white backdrop-blur-sm transition-[transform,background-color] duration-500 group-enabled:group-hover:scale-105 group-enabled:group-hover:bg-white/20">
                  <Play className="h-7 w-7 translate-x-0.5" strokeWidth={1.2} aria-hidden />
                </span>
              </button>
            </>
          )}
        </div>
        <figcaption className="mt-5 flex flex-col gap-2">
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-display text-2xl text-burgundy">{l(item.title)}</span>
            {item.date && <span className="text-sm text-ink-soft">{l(item.date)}</span>}
            {item.placeholder && <PlaceholderTag short />}
          </span>
          <span className="max-w-2xl text-ink-soft">{l(item.description)}</span>
          {!item.src && <span className="text-[0.82rem] text-ink-soft">{t.media.unavailable}</span>}
        </figcaption>
      </figure>

      <aside className="flex flex-col gap-8 lg:col-span-4" aria-label={t.media.transcript}>
        {item.transcript && (
          <div>
            <h3 className="label mb-4">{t.media.transcript}</h3>
            <ol className="flex flex-col gap-1 border-s border-line">
              {item.transcript.map((line, i) => (
                <li key={i}>
                  <button
                    type="button"
                    disabled={!item.src}
                    onClick={() => {
                      setStarted(true);
                      setTimeout(() => {
                        if (video.current) video.current.currentTime = line.at;
                      }, 60);
                    }}
                    className={cn(
                      "-ms-px block w-full border-s py-2 ps-4 text-start text-[0.98rem] leading-relaxed transition-colors disabled:cursor-default",
                      i === activeLine ? "border-burgundy text-charcoal" : "border-transparent text-ink-soft enabled:hover:text-charcoal"
                    )}
                  >
                    <span className="me-3 inline-block text-[0.75rem] tabular-nums text-dusty" dir="ltr">
                      {Math.floor(line.at / 60)}:{String(line.at % 60).padStart(2, "0")}
                    </span>
                    {l(line.text)}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}
        {item.findings && (
          <div>
            <h3 className="label mb-4">{t.media.findings}</h3>
            <ul className="flex flex-wrap gap-2">
              {item.findings.map((f) => {
                const Icon = findIcon[f.kind];
                return (
                  <li key={f.kind} className="inline-flex items-center gap-2 rounded-full border border-dashed border-sage-deep/40 px-3 py-1.5 text-[0.88rem] text-sage-deep">
                    <Icon className="h-4 w-4" strokeWidth={1.4} aria-hidden />
                    {l(f.label)}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[0.8rem] text-ink-soft">{t.media.awaiting}</p>
          </div>
        )}
      </aside>
    </div>
  );
}

export default function MediaArchive() {
  const { t, l } = useLang();
  const [feature, ...rest] = media.filter((m) => m.kind === "video").concat(media.filter((m) => m.kind === "audio"));
  const audios = rest.filter((m) => m.kind === "audio");

  return (
    <section id="media" aria-labelledby="media-title" className="py-[var(--spacing-section)]">
      <Container wide>
        <SectionIntro id="media-title" eyebrow={t.media.eyebrow} title={t.media.title} lead={t.media.lead} className="mb-14" />
        {feature && <FeatureVideo item={feature} />}

        {audios.length > 0 && (
          <ul className="mt-20 grid gap-x-12 gap-y-2 border-t border-line md:grid-cols-2">
            {audios.map((a, i) => (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease, delay: i * 0.08 }}
                className="flex flex-col gap-4 border-b border-line py-8"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-[1.5rem] text-charcoal">{l(a.title)}</h3>
                  {a.placeholder && <PlaceholderTag short />}
                </div>
                <p className="text-[0.98rem] text-ink-soft">{l(a.description)}</p>
                <AudioPlayer src={a.src} title={l(a.title)} />
              </motion.li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  );
}
