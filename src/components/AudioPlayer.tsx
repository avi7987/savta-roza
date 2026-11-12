"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { cn } from "./ui";

const fmt = (s: number) => {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

/** Minimal, fully keyboard-operable player. Never starts on its own. */
export default function AudioPlayer({ src, title, className }: { src?: string; title: string; className?: string }) {
  const { t } = useLang();
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [muted, setMuted] = useState(false);
  const disabled = !src;

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    a.volume = volume;
    a.muted = muted;
  }, [volume, muted]);

  const toggle = () => {
    const a = audio.current;
    if (!a || disabled) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {src && (
        <audio
          ref={audio}
          src={src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        />
      )}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          disabled={disabled}
          aria-label={`${playing ? t.media.pause : t.media.play}: ${title}`}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-burgundy/30 text-burgundy transition-colors hover:bg-burgundy hover:text-white disabled:cursor-not-allowed disabled:border-charcoal/15 disabled:text-charcoal/30 disabled:hover:bg-transparent"
        >
          {playing ? <Pause className="h-5 w-5" strokeWidth={1.5} aria-hidden /> : <Play className="h-5 w-5" strokeWidth={1.5} aria-hidden />}
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            disabled={disabled}
            aria-label={`${t.media.progress}: ${title}`}
            aria-valuetext={`${fmt(time)} / ${fmt(duration)}`}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (audio.current) audio.current.currentTime = v;
              setTime(v);
            }}
            className="h-1 min-w-0 flex-1 cursor-pointer accent-rose disabled:cursor-not-allowed disabled:opacity-40"
            dir="ltr"
          />
          <span className="w-20 shrink-0 text-end text-[0.8rem] tabular-nums text-ink-soft" dir="ltr">
            {fmt(time)} / {fmt(duration)}
          </span>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            disabled={disabled}
            aria-label={muted ? t.media.unmute : t.media.mute}
            className="flex h-11 w-11 items-center justify-center text-ink-soft hover:text-burgundy disabled:opacity-40"
          >
            {muted ? <VolumeX className="h-5 w-5" strokeWidth={1.4} aria-hidden /> : <Volume2 className="h-5 w-5" strokeWidth={1.4} aria-hidden />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            disabled={disabled}
            aria-label={t.media.volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-1 w-20 cursor-pointer accent-rose disabled:opacity-40"
            dir="ltr"
          />
        </div>
      </div>
      {disabled && <p className="text-[0.82rem] text-ink-soft">{t.media.unavailable}</p>}
    </div>
  );
}
