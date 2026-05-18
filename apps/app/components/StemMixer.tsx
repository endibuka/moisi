"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  STEM_LABELS,
  STEM_NAMES,
  type StemName,
  type StemPaths,
} from "@/lib/separation";
import { createClient } from "@/lib/supabase/client";

function fmt(t: number) {
  if (!Number.isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Gradient track + circular knob slider, styled after the marketing site. */
function Slider({
  value,
  max,
  step,
  onChange,
  ariaLabel,
}: {
  value: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  ariaLabel: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="relative h-1 flex-1 rounded-[2px] bg-[rgba(252,252,253,0.1)]">
      <div
        className="absolute left-0 top-0 h-1 rounded-[2px] bg-gradient-to-r from-[#00dae8] to-[#0affa7]"
        style={{ width: `${pct}%` }}
      />
      <div
        className="pointer-events-none absolute top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#545454] bg-black"
        style={{ left: `${pct}%` }}
      >
        <div className="size-1.5 rounded-full bg-[#0affa7]" />
      </div>
      <input
        type="range"
        min={0}
        max={max || 0}
        step={step}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute left-0 top-1/2 h-7 w-full -translate-y-1/2 cursor-pointer appearance-none bg-transparent opacity-0"
      />
    </div>
  );
}

export default function StemMixer({ stems }: { stems: StemPaths }) {
  const supabase = useMemo(() => createClient(), []);

  // Only render the stems this row actually has — older jobs are 4-stem.
  const availableStems = useMemo(
    () => STEM_NAMES.filter((name) => Boolean(stems[name])),
    [stems],
  );

  const [urls, setUrls] = useState<Partial<Record<StemName, string>> | null>(
    null,
  );
  const audioRefs = useRef<Partial<Record<StemName, HTMLAudioElement | null>>>(
    {},
  );
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volumes, setVolumes] = useState<Partial<Record<StemName, number>>>(
    () => Object.fromEntries(availableStems.map((n) => [n, 1])),
  );
  const [muted, setMuted] = useState<Set<StemName>>(new Set());
  const [solo, setSolo] = useState<StemName | null>(null);

  // Sign each stem's storage path for playback.
  useEffect(() => {
    let active = true;
    (async () => {
      const entries = await Promise.all(
        availableStems.map(async (name) => {
          const path = stems[name];
          if (!path) return [name, ""] as const;
          const { data } = await supabase.storage
            .from("stems")
            .createSignedUrl(path, 3600);
          return [name, data?.signedUrl ?? ""] as const;
        }),
      );
      if (active) setUrls(Object.fromEntries(entries));
    })();
    return () => {
      active = false;
    };
  }, [stems, supabase, availableStems]);

  // Push volume / mute / solo state onto the audio elements.
  useEffect(() => {
    for (const name of availableStems) {
      const el = audioRefs.current[name];
      if (!el) continue;
      const silenced = muted.has(name) || (solo !== null && solo !== name);
      el.volume = silenced ? 0 : volumes[name] ?? 1;
    }
  }, [volumes, muted, solo, urls, availableStems]);

  const forEachAudio = (fn: (el: HTMLAudioElement) => void) => {
    for (const el of Object.values(audioRefs.current)) if (el) fn(el);
  };

  const toggle = () => {
    if (playing) {
      forEachAudio((el) => el.pause());
      setPlaying(false);
    } else {
      forEachAudio((el) => void el.play().catch(() => {}));
      setPlaying(true);
    }
  };

  const seek = (t: number) => {
    forEachAudio((el) => {
      el.currentTime = t;
    });
    setProgress(t);
  };

  const toggleMute = (name: StemName) => {
    setMuted((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleSolo = (name: StemName) => {
    setSolo((prev) => (prev === name ? null : name));
  };

  if (!urls) {
    return (
      <p className="text-[13px] text-[rgba(241,247,254,0.71)]">
        Loading stems…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* player bar */}
      <div className="flex h-[88px] items-center gap-5 rounded-[20px] border border-[rgba(252,252,253,0.1)] px-5">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white text-black transition-opacity hover:opacity-90"
        >
          {playing ? (
            <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
            </svg>
          ) : (
            <svg className="ml-0.5 size-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7L8 5Z" />
            </svg>
          )}
        </button>
        <span className="w-9 text-[12px] tabular-nums text-[rgba(241,247,254,0.71)]">
          {fmt(progress)}
        </span>
        <Slider
          value={progress}
          max={duration}
          step={0.1}
          onChange={seek}
          ariaLabel="Seek"
        />
        <span className="w-9 text-right text-[12px] tabular-nums text-[rgba(241,247,254,0.71)]">
          {fmt(duration)}
        </span>
      </div>

      {/* stem rows */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {availableStems.map((name, i) => {
          const isMuted = muted.has(name);
          const isSolo = solo === name;
          return (
            <div
              key={name}
              className="flex h-[72px] items-center gap-2 rounded-[16px] border border-[rgba(252,252,253,0.03)] bg-[rgba(252,252,253,0.05)] px-4"
            >
              <button
                type="button"
                onClick={() => toggleMute(name)}
                aria-label={`Mute ${STEM_LABELS[name]}`}
                aria-pressed={isMuted}
                className={`flex size-6 shrink-0 items-center justify-center rounded-[5px] text-[11px] font-semibold transition-colors ${
                  isMuted
                    ? "bg-[#ff6b6b] text-[#1a0606]"
                    : "bg-[rgba(252,252,253,0.1)] text-[rgba(241,247,254,0.71)] hover:text-white"
                }`}
              >
                M
              </button>
              <button
                type="button"
                onClick={() => toggleSolo(name)}
                aria-label={`Solo ${STEM_LABELS[name]}`}
                aria-pressed={isSolo}
                className={`flex size-6 shrink-0 items-center justify-center rounded-[5px] text-[11px] font-semibold transition-colors ${
                  isSolo
                    ? "bg-[#00dae8] text-[#001316]"
                    : "bg-[rgba(252,252,253,0.1)] text-[rgba(241,247,254,0.71)] hover:text-white"
                }`}
              >
                S
              </button>
              <span className="ml-1 w-14 shrink-0 text-[13px] text-[rgba(252,253,255,0.94)]">
                {STEM_LABELS[name]}
              </span>
              <Slider
                value={volumes[name] ?? 1}
                max={1}
                step={0.01}
                onChange={(v) =>
                  setVolumes((prev) => ({ ...prev, [name]: v }))
                }
                ariaLabel={`${STEM_LABELS[name]} volume`}
              />

              {/* the first stem drives the shared timeline */}
              <audio
                ref={(el) => {
                  audioRefs.current[name] = el;
                }}
                src={urls?.[name] ?? ""}
                preload="auto"
                onLoadedMetadata={
                  i === 0
                    ? (e) => setDuration(e.currentTarget.duration)
                    : undefined
                }
                onTimeUpdate={
                  i === 0
                    ? (e) => setProgress(e.currentTarget.currentTime)
                    : undefined
                }
                onEnded={
                  i === 0
                    ? () => {
                        setPlaying(false);
                        setProgress(0);
                      }
                    : undefined
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
