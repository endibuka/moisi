"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  STEM_LABELS,
  STEM_NAMES,
  type StemName,
} from "@/lib/separation";
import { createClient } from "@/lib/supabase/client";

function fmt(t: number) {
  if (!Number.isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function StemMixer({
  stems,
}: {
  stems: Record<StemName, string>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [urls, setUrls] = useState<Record<StemName, string> | null>(null);
  const audioRefs = useRef<Partial<Record<StemName, HTMLAudioElement | null>>>({});
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volumes, setVolumes] = useState<Record<StemName, number>>({
    vocals: 1,
    drums: 1,
    bass: 1,
    other: 1,
  });

  // Sign each stem's storage path for playback.
  useEffect(() => {
    let active = true;
    (async () => {
      const entries = await Promise.all(
        STEM_NAMES.map(async (name) => {
          const { data } = await supabase.storage
            .from("stems")
            .createSignedUrl(stems[name], 3600);
          return [name, data?.signedUrl ?? ""] as const;
        }),
      );
      if (active) {
        setUrls(Object.fromEntries(entries) as Record<StemName, string>);
      }
    })();
    return () => {
      active = false;
    };
  }, [stems, supabase]);

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

  const setVolume = (name: StemName, value: number) => {
    setVolumes((v) => ({ ...v, [name]: value }));
    const el = audioRefs.current[name];
    if (el) el.volume = value;
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
      {/* transport */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#00dae8] text-[#001316] transition-opacity hover:opacity-90"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
            </svg>
          ) : (
            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7L8 5Z" />
            </svg>
          )}
        </button>
        <span className="w-10 text-[12px] tabular-nums text-[rgba(241,247,254,0.71)]">
          {fmt(progress)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={progress}
          onChange={(e) => seek(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer accent-[#00dae8]"
        />
        <span className="w-10 text-[12px] tabular-nums text-[rgba(241,247,254,0.71)]">
          {fmt(duration)}
        </span>
      </div>

      {/* per-stem volume */}
      <div className="flex flex-col gap-2.5">
        {STEM_NAMES.map((name, i) => (
          <div key={name} className="flex items-center gap-3">
            <span className="w-16 text-[13px] text-[rgba(252,253,255,0.94)]">
              {STEM_LABELS[name]}
            </span>
            <button
              type="button"
              onClick={() => setVolume(name, volumes[name] > 0 ? 0 : 1)}
              className="text-[12px] text-[rgba(241,247,254,0.71)] transition-colors hover:text-white"
            >
              {volumes[name] > 0 ? "Mute" : "Unmute"}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volumes[name]}
              onChange={(e) => setVolume(name, Number(e.target.value))}
              className="h-1 flex-1 cursor-pointer accent-[#00dae8]"
            />
            {/* the first stem drives the shared timeline */}
            <audio
              ref={(el) => {
                audioRefs.current[name] = el;
              }}
              src={urls[name]}
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
        ))}
      </div>
    </div>
  );
}
