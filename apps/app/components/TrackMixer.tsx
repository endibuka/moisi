"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import JSZip from "jszip";
import { saveWaveformPeaks } from "@/app/actions";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  STEM_LABELS,
  STEM_NAMES,
  type SeparationJob,
  type StemName,
  type WaveformPeaks,
} from "@/lib/separation";

type StemUrls = Partial<Record<StemName, string | null>>;
type Speed = 0.5 | 1 | 2;

function fmt(t: number) {
  if (!Number.isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function seed<T>(stems: StemName[], v: T): Record<StemName, T> {
  return Object.fromEntries(stems.map((s) => [s, v])) as Record<StemName, T>;
}

export default function TrackMixer({
  job,
  stemUrls,
}: {
  job: SeparationJob;
  stemUrls: StemUrls;
}) {
  const stems = useMemo(
    () =>
      STEM_NAMES.filter(
        (n): n is StemName => Boolean(stemUrls[n]) && Boolean(job.stems?.[n]),
      ),
    [stemUrls, job.stems],
  );

  const audios = useRef<Partial<Record<StemName, HTMLAudioElement>>>({});
  const wavesurfers = useRef<Partial<Record<StemName, WaveSurfer>>>({});
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainsRef = useRef<Partial<Record<StemName, GainNode>>>({});
  const pannersRef = useRef<Partial<Record<StemName, StereoPannerNode>>>({});

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(job.duration_seconds ?? 0);
  const [speed, setSpeed] = useState<Speed>(1);
  const [volumes, setVolumes] = useState<Record<StemName, number>>(() =>
    seed(stems, 1),
  );
  const [pans, setPans] = useState<Record<StemName, number>>(() =>
    seed(stems, 0),
  );
  const [muted, setMuted] = useState<Set<StemName>>(new Set());
  const [solo, setSolo] = useState<StemName | null>(null);
  const [ready, setReady] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    let loaded = 0;
    const cleanup: Array<() => void> = [];

    // Cached peaks per stem (from DB). When present we skip WaveSurfer's
    // audio fetch entirely — waveform renders instantly from peaks +
    // duration, audio loads only when the user hits Play.
    const cachedPeaks = job.waveform_peaks ?? null;
    const cachedDuration = job.duration_seconds ?? 0;
    const canRenderFromCache =
      !!cachedPeaks && cachedDuration > 0 && stems.every((n) => cachedPeaks[n]);

    // Collect freshly-extracted peaks here. When all stems are ready, save
    // back so the next visit hits the fast path.
    const computedPeaks: WaveformPeaks = {};
    const pendingSave = !canRenderFromCache;

    for (const name of stems) {
      const url = stemUrls[name];
      if (!url) continue;

      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      // When we have peaks we don't need audio bytes until Play; metadata
      // gives us duration without downloading the file. Saves ~all of the
      // initial page-load network cost.
      audio.preload = canRenderFromCache ? "metadata" : "auto";
      audio.src = url;
      audios.current[name] = audio;

      const source = ctx.createMediaElementSource(audio);
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner();
      source.connect(gain).connect(pan).connect(ctx.destination);
      gainsRef.current[name] = gain;
      pannersRef.current[name] = pan;

      const peaksForStem = canRenderFromCache
        ? (cachedPeaks?.[name] as number[][] | undefined)
        : undefined;

      const ws = WaveSurfer.create({
        container: `#waveform-${name}`,
        // Fast path: peaks + duration; no `url`, so WS doesn't fetch audio.
        // Slow path (first ever visit): give it `url` so it fetches + decodes.
        ...(peaksForStem
          ? { peaks: peaksForStem, duration: cachedDuration, media: audio }
          : { url, media: audio }),
        // Vertical gradient (top → bottom) — STYLING.md cyan + a deeper blue.
        // Wavesurfer v7 turns a string[] into a vertical canvas gradient.
        waveColor: ["#00dae8", "#0080c7"],
        progressColor: ["#a8f1ff", "#5ec3e8"],
        cursorColor: "#fcfcfd",
        cursorWidth: 1,
        height: 44,
        barWidth: 2,
        barGap: 1,
        barRadius: 1,
        normalize: false,
        interact: true,
      });
      wavesurfers.current[name] = ws;

      ws.on("interaction", (time: number) => {
        for (const other of stems) {
          const a = audios.current[other];
          if (a) a.currentTime = time;
        }
        setProgress(time);
      });

      // First-ever visit: extract peaks after WS has decoded the audio and
      // batch-save once every stem is ready.
      if (pendingSave) {
        ws.on("ready", () => {
          try {
            // maxLength 2048 = good visual fidelity at typical widths.
            // precision 1000 = 3 decimals (~5-6 chars per peak), keeps
            // jsonb payload around 60KB total instead of ~150KB at default.
            computedPeaks[name] = ws.exportPeaks({
              maxLength: 2048,
              precision: 1000,
            });
            if (Object.keys(computedPeaks).length === stems.length) {
              void saveWaveformPeaks(job.id, computedPeaks);
            }
          } catch (err) {
            console.warn("[waveform] exportPeaks failed for", name, err);
          }
        });
      }

      const onMeta = () => {
        loaded += 1;
        if (loaded >= stems.length) {
          setReady(true);
          if (Number.isFinite(audio.duration) && audio.duration > 0) {
            setDuration(audio.duration);
          }
        }
      };
      audio.addEventListener("loadedmetadata", onMeta);
      cleanup.push(() => audio.removeEventListener("loadedmetadata", onMeta));
    }

    const master = audios.current[stems[0]];
    if (master) {
      const onTime = () => setProgress(master.currentTime);
      const onEnded = () => {
        for (const name of stems) audios.current[name]?.pause();
        setPlaying(false);
        setProgress(0);
        for (const name of stems) {
          const a = audios.current[name];
          if (a) a.currentTime = 0;
        }
      };
      master.addEventListener("timeupdate", onTime);
      master.addEventListener("ended", onEnded);
      cleanup.push(() => {
        master.removeEventListener("timeupdate", onTime);
        master.removeEventListener("ended", onEnded);
      });
    }

    return () => {
      for (const fn of cleanup) fn();
      for (const name of stems) {
        wavesurfers.current[name]?.destroy();
        const a = audios.current[name];
        if (a) {
          a.pause();
          a.src = "";
        }
      }
      wavesurfers.current = {};
      audios.current = {};
      gainsRef.current = {};
      pannersRef.current = {};
      void ctx.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stems.join(",")]);

  useEffect(() => {
    for (const name of stems) {
      const gain = gainsRef.current[name];
      if (!gain) continue;
      const silenced = muted.has(name) || (solo !== null && solo !== name);
      gain.gain.value = silenced ? 0 : volumes[name] ?? 1;
    }
  }, [volumes, muted, solo, stems]);

  useEffect(() => {
    for (const name of stems) {
      const pan = pannersRef.current[name];
      if (pan) pan.pan.value = pans[name] ?? 0;
    }
  }, [pans, stems]);

  useEffect(() => {
    for (const name of stems) {
      const a = audios.current[name];
      if (a) a.playbackRate = speed;
    }
  }, [speed, stems]);

  const togglePlay = useCallback(async () => {
    const ctx = audioCtxRef.current;
    if (ctx?.state === "suspended") await ctx.resume();
    if (playing) {
      for (const name of stems) audios.current[name]?.pause();
      setPlaying(false);
    } else {
      await Promise.all(
        stems.map(async (name) => {
          const a = audios.current[name];
          if (a) await a.play().catch(() => {});
        }),
      );
      setPlaying(true);
    }
  }, [playing, stems]);

  const seek = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(duration || 0, t));
      for (const name of stems) {
        const a = audios.current[name];
        if (a) a.currentTime = clamped;
      }
      setProgress(clamped);
    },
    [stems, duration],
  );

  const reset = () => {
    setVolumes(seed(stems, 1));
    setPans(seed(stems, 0));
    setMuted(new Set());
    setSolo(null);
  };

  const exportZip = async () => {
    setExporting(true);
    try {
      const zip = new JSZip();
      const baseName = job.original_name.replace(/\.[^.]+$/, "");
      await Promise.all(
        stems.map(async (name) => {
          const url = stemUrls[name];
          if (!url) return;
          const res = await fetch(url);
          const blob = await res.blob();
          zip.file(`${baseName}/${name}.mp3`, blob);
        }),
      );
      const out = await zip.generateAsync({ type: "blob" });
      const dlUrl = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = `${baseName} (stems).zip`;
      a.click();
      URL.revokeObjectURL(dlUrl);
    } finally {
      setExporting(false);
    }
  };

  const toggleMute = (name: StemName) =>
    setMuted((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const toggleSolo = (name: StemName) =>
    setSolo((prev) => (prev === name ? null : name));

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <header className="flex h-[68px] shrink-0 items-center gap-3 px-6">
        <Link
          href="/"
          aria-label="Back to library"
          className="flex size-9 items-center justify-center rounded-full text-[rgba(252,252,253,0.6)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="m15 6-6 6 6 6" />
          </svg>
        </Link>

        <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[rgba(252,252,253,0.05)] text-[rgba(252,252,253,0.6)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
            <path d="M9 18V6l11-2v12" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="17" cy="16" r="3" />
          </svg>
        </span>

        <h1 className="min-w-0 flex-1 truncate text-[15px] font-medium text-[#fcfcfd]">
          {job.original_name.replace(/\.[^.]+$/, "")}
        </h1>

        <ChipButton>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
            <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
          </svg>
          Separate tracks
        </ChipButton>
        <Chip>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3.5 w-3.5">
            <path d="M3 12c2-3 5-3 7 0s5 3 7 0 5-3 4 0M2 20l20-16" />
          </svg>
          96
          <Caret />
        </Chip>
        <Chip>
          <span className="text-[11px]">♭</span>
          Gm
          <Caret />
        </Chip>
        <Chip>
          <span className="text-[11px] tabular-nums">4/4</span>
          <Caret />
        </Chip>

        <button
          type="button"
          onClick={exportZip}
          disabled={exporting || !ready}
          className="flex h-9 items-center gap-2 rounded-full bg-[#00dae8] px-4 text-[13px] font-medium text-[#001316] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          {exporting ? "Exporting…" : "Export"}
        </button>
      </header>

      {/* mixer body */}
      <ScrollArea className="flex-1" viewportClassName="px-6 pb-32 pt-2">
      <div>
        {/* Speed toggle (aligned to the stem-info column width) + top timeline
            scrubber (aligned with the waveforms below it). */}
        <div className="mb-2 flex items-end gap-3">
          <div className="flex w-[300px] shrink-0 items-center gap-1 text-[12px]">
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s as Speed)}
                className={`h-6 rounded-full px-2 transition-colors ${
                  speed === s
                    ? "bg-[#fcfcfd] text-black"
                    : "text-[rgba(252,252,253,0.6)] hover:text-[#fcfcfd]"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
          <TimelineScrubber
            progress={progress}
            duration={duration}
            onSeek={seek}
          />
        </div>

        <ul className="flex flex-col gap-3">
          {stems.map((name) => (
            <StemRow
              key={name}
              name={name}
              volume={volumes[name] ?? 1}
              pan={pans[name] ?? 0}
              muted={muted.has(name)}
              solo={solo === name}
              onMute={() => toggleMute(name)}
              onSolo={() => toggleSolo(name)}
              onVolume={(v) =>
                setVolumes((p) => ({ ...p, [name]: v }))
              }
              onPan={(v) => setPans((p) => ({ ...p, [name]: v }))}
            />
          ))}
        </ul>

        <button
          type="button"
          onClick={reset}
          className="mt-4 ml-[300px] text-[12px] text-[rgba(252,252,253,0.6)] transition-colors hover:text-[#fcfcfd]"
        >
          Reset
        </button>
      </div>
      </ScrollArea>

      {/* Transport bar: tight height, centered controls, time on the right.
          Three-column flex so the play group stays optically centered. */}
      <div className="absolute inset-x-0 bottom-0 flex h-[64px] items-center bg-[rgba(14,15,17,0.85)] px-8 backdrop-blur-[12px]">
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Rewind 5s"
            onClick={() => seek(progress - 5)}
            className="flex size-9 items-center justify-center rounded-full text-[rgba(252,252,253,0.6)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
              <path d="M11 6 4 12l7 6V6Zm9 0-7 6 7 6V6Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            disabled={!ready}
            className="flex size-11 items-center justify-center rounded-full bg-[#fcfcfd] text-black shadow-[0_0_0_1px_rgba(252,252,253,0.1)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {playing ? (
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
              </svg>
            ) : (
              <svg className="ml-0.5 h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7L8 5Z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            aria-label="Forward 5s"
            onClick={() => seek(progress + 5)}
            className="flex size-9 items-center justify-center rounded-full text-[rgba(252,252,253,0.6)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
              <path d="M13 6v12l7-6-7-6Zm-9 0v12l7-6-7-6Z" />
            </svg>
          </button>
        </div>
        <div className="flex flex-1 justify-end">
          <span className="text-[12px] tabular-nums text-[rgba(252,252,253,0.6)]">
            <span className="text-[#fcfcfd]">{fmt(progress)}</span>{" "}
            <span className="text-[rgba(252,252,253,0.3)]">/</span>{" "}
            {fmt(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- subcomponents ---------- */

function StemRow({
  name,
  volume,
  pan,
  muted,
  solo,
  onMute,
  onSolo,
  onVolume,
  onPan,
}: {
  name: StemName;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  onMute: () => void;
  onSolo: () => void;
  onVolume: (v: number) => void;
  onPan: (v: number) => void;
}) {
  return (
    <li className="flex items-center gap-3">
      <div className="flex w-[300px] shrink-0 items-center gap-2.5 rounded-[12px] border border-[rgba(252,252,253,0.03)] bg-[rgba(252,252,253,0.05)] px-3 pb-4 pt-2.5">
        <ToggleButton on={muted} onClick={onMute} label={`Mute ${STEM_LABELS[name]}`} accent="red">
          M
        </ToggleButton>
        <ToggleButton on={solo} onClick={onSolo} label={`Solo ${STEM_LABELS[name]}`} accent="cyan">
          S
        </ToggleButton>
        <span className="min-w-0 flex-1 truncate text-[13px] text-[#fcfcfd]">
          {STEM_LABELS[name]}
        </span>
        <VolumeSlider value={volume} onChange={onVolume} />
        <PannerKnob value={pan} onChange={onPan} />
      </div>

      <div className="relative flex-1">
        <div id={`waveform-${name}`} className="w-full" />
      </div>
    </li>
  );
}

function ToggleButton({
  children,
  on,
  onClick,
  label,
  accent,
}: {
  children: React.ReactNode;
  on: boolean;
  onClick: () => void;
  label: string;
  accent: "red" | "cyan";
}) {
  const activeBg =
    accent === "red" ? "bg-[#ff6b6b] text-[#1a0606]" : "bg-[#00dae8] text-[#001316]";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      className={`flex size-6 shrink-0 items-center justify-center rounded-[5px] text-[11px] font-semibold transition-colors ${
        on
          ? activeBg
          : "bg-[rgba(252,252,253,0.08)] text-[rgba(252,252,253,0.6)] hover:text-[#fcfcfd]"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Horizontal volume fader. Click anywhere to jump, drag to scrub. Double-click
 * to reset to 100%. Bypasses React state during the drag — direct DOM writes
 * to the fill + handle elements so a continuous drag stays smooth.
 */
function VolumeSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const latest = useRef(value);

  const ratioFromX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  };

  const paint = useCallback((v: number) => {
    if (fillRef.current) fillRef.current.style.width = `${v * 100}%`;
    if (handleRef.current) handleRef.current.style.left = `${v * 100}%`;
  }, []);

  // Follow prop when not dragging (e.g. Reset button).
  useEffect(() => {
    if (dragging.current) return;
    latest.current = value;
    paint(value);
  }, [value, paint]);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    const v = ratioFromX(e.clientX);
    latest.current = v;
    paint(v);
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const v = ratioFromX(e.clientX);
      latest.current = v;
      paint(v);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      onChange(latest.current);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onChange, paint]);

  return (
    <div
      ref={trackRef}
      onMouseDown={onMouseDown}
      onDoubleClick={() => onChange(1)}
      title="Volume (double-click to reset)"
      className="relative h-5 w-20 shrink-0 cursor-pointer select-none"
    >
      <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[rgba(252,252,253,0.12)]" />
      <div
        ref={fillRef}
        className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-gradient-to-r from-[#00dae8] to-[#0affa7]"
      />
      <div
        ref={handleRef}
        className="pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(252,252,253,0.4)] bg-[#fcfcfd]"
      />
    </div>
  );
}

/**
 * L/R panner. Drag horizontally → pan; double-click → recenter. Range -1..+1.
 */
function PannerKnob({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const dragging = useRef(false);
  const start = useRef({ x: 0, v: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    start.current = { x: e.clientX, v: value };
    e.preventDefault();
  };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - start.current.x;
      const next = Math.max(-1, Math.min(1, start.current.v + dx / 60));
      onChange(next);
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onChange]);

  const angle = value * 135; // -135° .. +135°

  return (
    // The wrapper's layout box is just the 28px knob — L/R labels are
    // absolutely positioned below so they don't drag the flex baseline down
    // and misalign the volume slider in the same row.
    <div
      className="relative shrink-0"
      onDoubleClick={() => onChange(0)}
      title="Pan (double-click to center)"
    >
      <div
        onMouseDown={onMouseDown}
        className="relative flex size-7 cursor-ew-resize items-center justify-center rounded-full border border-[rgba(252,252,253,0.18)] bg-[rgba(252,252,253,0.04)]"
      >
        <div
          className="absolute top-1 h-2 w-[2px] rounded-full bg-[#fcfcfd]"
          style={{ transform: `rotate(${angle}deg)`, transformOrigin: "center 12px" }}
        />
      </div>
      <div className="pointer-events-none absolute left-0 right-0 top-full mt-0.5 flex justify-between text-[9px] leading-none text-[rgba(252,252,253,0.3)]">
        <span>L</span>
        <span>R</span>
      </div>
    </div>
  );
}

/**
 * Thin ruler above the waveforms. Tick marks every ~5s, draggable playhead
 * triangle, click anywhere to seek. Width follows the waveform column so the
 * triangle stays vertically aligned with the wavesurfer cursors below.
 */
function TimelineScrubber({
  progress,
  duration,
  onSeek,
}: {
  progress: number;
  duration: number;
  onSeek: (t: number) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const latestRatio = useRef(0);

  // Imperative playhead — direct DOM writes during the drag bypass React
  // entirely, so the 7 wavesurfer canvases in the parent don't reconcile on
  // every mousemove. That's the difference between silky and laggy.
  const setPlayhead = useCallback((ratio: number) => {
    if (playheadRef.current) {
      playheadRef.current.style.left = `${ratio * 100}%`;
    }
  }, []);

  // When NOT dragging, follow the `progress` prop (driven by the audio's
  // timeupdate). When dragging, ignore prop changes so the drag isn't fought
  // by playback updates landing mid-drag.
  useEffect(() => {
    if (dragging.current || duration <= 0) return;
    setPlayhead(Math.min(1, progress / duration));
  }, [progress, duration, setPlayhead]);

  const computeRatio = (clientX: number) => {
    const el = rootRef.current;
    if (!el || duration <= 0) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    const r = computeRatio(e.clientX);
    latestRatio.current = r;
    setPlayhead(r);
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const r = computeRatio(e.clientX);
      latestRatio.current = r;
      setPlayhead(r);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      onSeek(latestRatio.current * duration);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, onSeek, setPlayhead]);

  const ticks = Array.from({ length: 21 }, (_, i) => i * 5);

  return (
    <div
      ref={rootRef}
      onMouseDown={onMouseDown}
      className="relative h-5 flex-1 cursor-pointer select-none"
    >
      <div className="absolute inset-x-0 bottom-0 flex h-3 items-end">
        {ticks.map((t) => (
          <div
            key={t}
            className="flex-1 border-l border-[rgba(252,252,253,0.12)]"
            style={t === 0 ? { borderLeft: "none" } : undefined}
          />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-px bg-[rgba(252,252,253,0.1)]" />
      <div
        ref={playheadRef}
        className="pointer-events-none absolute -top-0.5 bottom-0 flex flex-col items-center"
        // No `left` in React style — imperative setPlayhead owns it. React
        // setting style={{ left: ... }} on every parent re-render was fighting
        // the drag and resetting the playhead 4-5×/s during playback.
        style={{ transform: "translateX(-50%)" }}
      >
        <svg viewBox="0 0 12 10" className="h-2.5 w-3" fill="#fcfcfd">
          <path d="M0 0 L12 0 L6 10 Z" />
        </svg>
        <div className="w-px flex-1 bg-[#fcfcfd]" />
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-9 items-center gap-1.5 rounded-full border border-[rgba(252,252,253,0.1)] px-3 text-[12px] text-[rgba(252,252,253,0.6)]">
      {children}
    </div>
  );
}
function ChipButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="flex h-9 items-center gap-2 rounded-full border border-[rgba(252,252,253,0.1)] px-3 text-[12px] text-[rgba(252,252,253,0.6)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]"
    >
      {children}
    </button>
  );
}
function Caret() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3 w-3 opacity-60">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
