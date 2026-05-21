"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { generateMusic } from "@/app/actions/music-gen";
import type { MusicGenJob } from "@/app/(dashboard)/tools/music-generator/page";
import SegmentedControl from "@/components/SegmentedControl";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  createClient,
  createClient as createSupabase,
} from "@/lib/supabase/client";

const STYLE_CHIPS = [
  "lo-fi",
  "synthwave",
  "ambient",
  "trap",
  "house",
  "mellow",
  "cinematic",
  "120 bpm",
  "airy female vocal",
];

const RANDOM_STYLES = [
  "inspiring female uplifting pop airy vocal electronic bright 110 bpm",
  "dark techno 130 bpm acid synth industrial kick eerie pads",
  "lo-fi piano soft drums vinyl crackle 80 bpm A minor",
  "bossa nova nylon guitar brushed drums 90 bpm warm",
  "synthwave cinematic driving arpeggios male vocal 120 bpm",
  "acoustic folk fingerpicking light strings warm intimate female vocal",
];

const SECTION_MARKERS = ["[verse]", "[chorus]", "[bridge]", "[outro]"];

const LYRIC_PLACEHOLDER = `[verse]
Walk into the morning light
Feel the city wake up slow

[chorus]
And we rise, and we rise
Through the noise, through the night
`;

type Mode = "vocal" | "instrumental";

export default function MusicGenFlow({
  userId,
  jobs: initialJobs,
  coverUrlByPath: initialCoverUrls,
}: {
  userId: string;
  workspaceName: string; // kept for prop compatibility; no longer rendered
  jobs: MusicGenJob[];
  coverUrlByPath: Record<string, string>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [jobs, setJobs] = useState<MusicGenJob[]>(initialJobs);
  const [coverUrls, setCoverUrls] =
    useState<Record<string, string>>(initialCoverUrls);

  /* ---------- prompt state ---------- */
  const [style, setStyle] = useState("");
  const [mode, setMode] = useState<Mode>("vocal");
  const [lyrics, setLyrics] = useState("");
  const [nSegments, setNSegments] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lyricsRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the lyrics textarea up to its container's max — anything past
  // that and the surrounding ScrollArea takes over with the themed scrollbar.
  // Synchronous (useLayoutEffect) so we never see a one-frame flicker at the
  // wrong height when the field mounts or content changes.
  useLayoutEffect(() => {
    const ta = lyricsRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.max(200, ta.scrollHeight)}px`;
  }, [lyrics, mode]);

  /* ---------- right panel state ---------- */
  const [query, setQuery] = useState("");
  const [sortNewest, setSortNewest] = useState(true);

  /* ---------- realtime: new + updated jobs ---------- */
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`music_gen:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "separation_jobs",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const row = payload.new as MusicGenJob & { job_type?: string };
          if (row.job_type !== "music_generation") return;
          setJobs((prev) => {
            const rest = prev.filter((j) => j.id !== row.id);
            return [row, ...rest].sort((a, b) =>
              b.created_at.localeCompare(a.created_at),
            );
          });
          if (row.cover_art_path && !coverUrls[row.cover_art_path]) {
            const { data } = await supabase.storage
              .from("stems")
              .createSignedUrl(row.cover_art_path, 60 * 60);
            if (data?.signedUrl) {
              setCoverUrls((prev) => ({
                ...prev,
                [row.cover_art_path!]: data.signedUrl,
              }));
            }
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, userId]);

  /* ---------- create ---------- */
  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const r = await generateMusic({
        genre: style,
        lyrics: mode === "instrumental" ? "" : lyrics,
        nSegments,
      });
      if (r.error || !r.jobId) throw new Error(r.error ?? "Failed.");
      setStyle("");
      setLyrics("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const randomizeStyle = () => {
    setStyle(RANDOM_STYLES[Math.floor(Math.random() * RANDOM_STYLES.length)]);
  };

  const appendStyleChip = (chip: string) => {
    setStyle((cur) => {
      const trimmed = cur.trim();
      if (!trimmed) return chip;
      if (trimmed.toLowerCase().includes(chip.toLowerCase())) return trimmed;
      return `${trimmed}, ${chip}`;
    });
  };

  const insertSectionMarker = (marker: string) => {
    const ta = lyricsRef.current;
    if (!ta) {
      setLyrics((cur) => (cur ? `${cur}\n${marker}\n` : `${marker}\n`));
      return;
    }
    const start = ta.selectionStart ?? lyrics.length;
    const end = ta.selectionEnd ?? lyrics.length;
    const before = lyrics.slice(0, start);
    const after = lyrics.slice(end);
    const insert = `${before.endsWith("\n") || before === "" ? "" : "\n"}${marker}\n`;
    const next = `${before}${insert}${after}`;
    setLyrics(next);
    requestAnimationFrame(() => {
      const pos = before.length + insert.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  /* ---------- visible list ---------- */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = jobs;
    if (q) {
      list = list.filter(
        (j) =>
          j.original_name.toLowerCase().includes(q) ||
          (j.prompt?.toLowerCase().includes(q) ?? false) ||
          (j.lyrics?.toLowerCase().includes(q) ?? false),
      );
    }
    return [...list].sort((a, b) =>
      sortNewest
        ? b.created_at.localeCompare(a.created_at)
        : a.created_at.localeCompare(b.created_at),
    );
  }, [jobs, query, sortNewest]);

  const canSubmit =
    !submitting &&
    style.trim().length >= 4 &&
    (mode === "instrumental" || lyrics.trim().length >= 1);

  return (
    <div className="flex h-full">
      {/* ---------- Left: prompt panel ---------- */}
      <aside className="flex w-[440px] shrink-0 flex-col overflow-y-auto border-r border-[rgba(252,252,253,0.06)]">
        <div className="flex flex-1 flex-col gap-6 px-7 py-6">
          <h2 className="text-[20px] font-medium tracking-tight text-[#fcfcfd]">
            Compose
          </h2>

          {/* Style */}
          <Field
            label="Style"
            action={
              <IconButton onClick={randomizeStyle} ariaLabel="Suggest a style">
                <Shuffle />
              </IconButton>
            }
          >
            <textarea
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="Describe the music — mood, genre, BPM, instruments, vocals…"
              rows={3}
              maxLength={500}
              className="w-full resize-none bg-transparent text-[13px] leading-relaxed text-[#fcfcfd] outline-none placeholder:text-[rgba(252,252,253,0.3)]"
            />
            <CharCount count={style.length} max={500} />

            {/* Chips: thin row, dense */}
            <div className="-mx-1 mt-3 flex flex-wrap gap-1">
              {STYLE_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => appendStyleChip(chip)}
                  className="flex h-6 items-center rounded-full px-2 text-[11px] text-[rgba(252,252,253,0.55)] transition-colors hover:bg-[rgba(252,252,253,0.06)] hover:text-[#fcfcfd]"
                >
                  + {chip}
                </button>
              ))}
            </div>
          </Field>

          {/* Mode: Vocal / Instrumental */}
          <div>
            <p className="mb-2 text-[12px] text-[rgba(252,252,253,0.6)]">
              Mode
            </p>
            <SegmentedControl
              value={mode}
              onChange={setMode}
              ariaLabel="Vocal or instrumental"
              options={[
                { value: "vocal", label: "Vocal" },
                { value: "instrumental", label: "Instrumental" },
              ]}
            />
          </div>

          {/* Lyrics (only in vocal mode) — auto-grows up to ~260px, then the
              ScrollArea takes over with the themed scrollbar so the left
              panel doesn't reflow as the user adds more lines. */}
          {mode === "vocal" && (
            <Field
              label="Lyrics"
              action={
                <div className="flex gap-0.5">
                  {SECTION_MARKERS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => insertSectionMarker(m)}
                      className="flex h-6 items-center rounded-full px-2 text-[10px] text-[rgba(252,252,253,0.55)] transition-colors hover:bg-[rgba(252,252,253,0.06)] hover:text-[#fcfcfd]"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              }
            >
              <ScrollArea className="max-h-[260px]">
                <textarea
                  ref={lyricsRef}
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  placeholder={LYRIC_PLACEHOLDER}
                  maxLength={4000}
                  className="block w-full resize-none bg-transparent font-mono text-[12px] leading-[1.7] text-[#fcfcfd] outline-none placeholder:text-[rgba(252,252,253,0.25)]"
                  // textarea height is driven imperatively by the
                  // useLayoutEffect above; overflow:hidden so the textarea
                  // itself never grows its own scrollbar — the ScrollArea
                  // wrapper owns scrolling above max-h.
                  style={{ overflow: "hidden" }}
                />
              </ScrollArea>
              <CharCount count={lyrics.length} max={4000} />
            </Field>
          )}

          {/* Length */}
          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <p className="text-[12px] text-[rgba(252,252,253,0.6)]">Length</p>
              <p className="font-mono text-[18px] tabular-nums leading-none text-[#fcfcfd]">
                {formatMinSec(nSegments * 30)}
              </p>
            </div>
            <TickSlider
              value={nSegments}
              min={1}
              max={6}
              step={1}
              onChange={setNSegments}
              ariaLabel="Length in 30-second segments"
            />
            <div className="mt-3 flex justify-between font-mono text-[10px] tabular-nums text-[rgba(252,252,253,0.3)]">
              <span>0:30</span>
              <span>3:00</span>
            </div>
          </div>

          {error && (
            <p className="rounded-[8px] border border-[rgba(255,107,107,0.25)] bg-[rgba(255,107,107,0.04)] px-3 py-2 text-[12px] text-[#ff8888]">
              {error}
            </p>
          )}
        </div>

        {/* Footer action bar — separated by hairline */}
        <div className="sticky bottom-0 flex items-center gap-2 border-t border-[rgba(252,252,253,0.06)] bg-[#0c0c0e]/85 px-7 py-4 backdrop-blur-md">
          <button
            type="button"
            onClick={() => {
              setStyle("");
              setLyrics("");
            }}
            disabled={!style && !lyrics}
            aria-label="Clear"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-[rgba(252,252,253,0.55)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd] disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-[#00dae8] text-[13px] font-medium text-[#001316] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {submitting && (
              <span className="size-3.5 animate-spin rounded-full border-2 border-[rgba(0,19,22,0.25)] border-t-[#001316]" />
            )}
            {submitting ? "Generating" : "Create track"}
          </button>
        </div>
      </aside>

      {/* ---------- Right: tracks list ---------- */}
      <section className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-[rgba(252,252,253,0.06)] px-7 py-5">
          <h1 className="text-[18px] font-medium tracking-tight text-[#fcfcfd]">
            Tracks
            <span className="ml-2 text-[13px] font-normal text-[rgba(252,252,253,0.5)]">
              {visible.length}
            </span>
          </h1>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex h-9 w-[240px] items-center gap-2 rounded-full border border-[rgba(252,252,253,0.1)] bg-[rgba(252,252,253,0.03)] px-3 text-[rgba(252,252,253,0.5)] focus-within:border-[rgba(252,252,253,0.18)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="w-full bg-transparent text-[13px] text-[#edeef0] outline-none placeholder:text-[rgba(252,252,253,0.4)]"
              />
            </div>
            <button
              type="button"
              onClick={() => setSortNewest((v) => !v)}
              className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] text-[rgba(252,252,253,0.6)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
                <path d="M7 4v16M3 8l4-4 4 4M17 20V4M21 16l-4 4-4-4" />
              </svg>
              {sortNewest ? "Newest" : "Oldest"}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          {visible.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="flex flex-col">
              {visible.map((job) => (
                <TrackRow
                  key={job.id}
                  job={job}
                  coverUrl={
                    job.cover_art_path
                      ? coverUrls[job.cover_art_path] ?? null
                      : null
                  }
                  supabaseClient={supabase}
                />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

/* ---------------- small primitives ---------------- */

function Field({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] text-[rgba(252,252,253,0.6)]">{label}</p>
        {action}
      </div>
      <div className="rounded-[12px] border border-[rgba(252,252,253,0.08)] bg-[rgba(252,252,253,0.02)] px-3 py-2.5 focus-within:border-[rgba(252,252,253,0.18)]">
        {children}
      </div>
    </div>
  );
}

function CharCount({ count, max }: { count: number; max: number }) {
  return (
    <p className="mt-1 text-right font-mono text-[10px] tabular-nums text-[rgba(252,252,253,0.3)]">
      {count} / {max}
    </p>
  );
}

function IconButton({
  children,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex size-7 items-center justify-center rounded-full text-[rgba(252,252,253,0.55)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]"
    >
      {children}
    </button>
  );
}

function Shuffle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
    </svg>
  );
}

function formatMinSec(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Custom discrete slider — track with active cyan fill, tick dots that
 * brighten as the fill crosses them, white thumb with a cyan halo + soft
 * drop shadow. Native <input type="range"> sits invisible on top for drag,
 * keyboard, and screen-reader support.
 */
function TickSlider({
  value,
  min,
  max,
  step,
  onChange,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  ariaLabel?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const ticks: number[] = [];
  for (let v = min; v <= max; v += step) ticks.push(v);

  return (
    <div className="relative h-5">
      {/* Track */}
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-[rgba(252,252,253,0.07)]">
        <div
          className="h-full rounded-full bg-[#00dae8] transition-[width] duration-150 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Tick dots */}
      {ticks.map((v) => {
        const tickPct = ((v - min) / (max - min)) * 100;
        const active = v <= value;
        return (
          <span
            key={v}
            aria-hidden
            className="pointer-events-none absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-150"
            style={{
              left: `${tickPct}%`,
              backgroundColor: active
                ? "rgba(0, 19, 22, 0.55)"
                : "rgba(252,252,253,0.18)",
            }}
          />
        );
      })}

      {/* Thumb */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fcfcfd] shadow-[0_0_0_4px_rgba(0,218,232,0.18),0_2px_10px_rgba(0,0,0,0.35)] transition-[left] duration-150 ease-out"
        style={{ left: `${pct}%` }}
      />

      {/* Native input layered on top — fully transparent, handles drag +
          keyboard + a11y. */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={ariaLabel}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
      />
    </div>
  );
}

/* ---------------- TrackRow ---------------- */

type SupabaseLike = ReturnType<typeof createSupabase>;

function TrackRow({
  job,
  coverUrl,
  supabaseClient,
}: {
  job: MusicGenJob;
  coverUrl: string | null;
  supabaseClient: SupabaseLike;
}) {
  const [signedAudio, setSignedAudio] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const inFlight = job.status === "pending" || job.status === "processing";
  const failed = job.status === "failed";
  const ready = job.status === "completed" && Boolean(job.stems?.audio);

  const ensureSignedAudio = async (): Promise<string | null> => {
    if (signedAudio) return signedAudio;
    const path = job.stems?.audio;
    if (!path) return null;
    const { data } = await supabaseClient.storage
      .from("stems")
      .createSignedUrl(path, 60 * 60);
    if (data?.signedUrl) {
      setSignedAudio(data.signedUrl);
      return data.signedUrl;
    }
    return null;
  };

  const togglePlay = async () => {
    if (!ready) return;
    if (!audioRef.current) {
      const url = await ensureSignedAudio();
      if (!url) return;
      const a = new Audio(url);
      audioRef.current = a;
      a.addEventListener("timeupdate", () => {
        if (!a.duration) return;
        setProgress(a.currentTime / a.duration);
      });
      a.addEventListener("ended", () => {
        setPlaying(false);
        setProgress(0);
      });
      window.dispatchEvent(
        new CustomEvent("moisi-musicgen-stop", { detail: { except: job.id } }),
      );
      await a.play();
      setPlaying(true);
      return;
    }
    const a = audioRef.current;
    if (a.paused) {
      window.dispatchEvent(
        new CustomEvent("moisi-musicgen-stop", { detail: { except: job.id } }),
      );
      await a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { except: string };
      if (detail.except !== job.id) {
        audioRef.current?.pause();
        setPlaying(false);
      }
    };
    window.addEventListener("moisi-musicgen-stop", handler);
    return () => window.removeEventListener("moisi-musicgen-stop", handler);
  }, [job.id]);

  const subtitle = job.prompt ?? "";
  const durationLabel = job.duration_seconds
    ? `${Math.floor(job.duration_seconds / 60)}:${String(
        Math.floor(job.duration_seconds % 60),
      ).padStart(2, "0")}`
    : "—";
  const hasVocals = Boolean(job.lyrics && job.lyrics.length > 0);

  return (
    <li className="group flex items-center gap-4 rounded-[10px] px-4 py-2.5 transition-colors hover:bg-[rgba(252,252,253,0.03)]">
      {/* Thumbnail */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={!ready}
        aria-label={playing ? "Pause" : "Play"}
        className="relative size-[56px] shrink-0 overflow-hidden rounded-[8px] disabled:cursor-not-allowed"
      >
        {coverUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={coverUrl}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,218,232,0.22) 0%, rgba(10,255,167,0.14) 50%, rgba(0,128,199,0.22) 100%)",
            }}
          />
        )}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity ${
            playing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {ready &&
            (playing ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-white">
                <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-5 w-5 text-white">
                <path d="M8 5v14l11-7L8 5Z" />
              </svg>
            ))}
        </div>
        {inFlight && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55">
            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
        )}
      </button>

      {/* Middle: title + subtitle + progress */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[14px] text-[#fcfcfd]">
            {job.original_name}
          </p>
          {hasVocals ? (
            <span className="shrink-0 rounded-[3px] bg-[rgba(0,218,232,0.1)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#00dae8]">
              Vocal
            </span>
          ) : (
            <span className="shrink-0 rounded-[3px] bg-[rgba(252,252,253,0.05)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[rgba(252,252,253,0.5)]">
              Inst
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[12px] text-[rgba(252,252,253,0.5)]">
          {failed
            ? job.error ?? "Generation failed."
            : inFlight
              ? "Generating…"
              : subtitle}
        </p>
        {ready && (
          <div className="mt-2 h-[2px] overflow-hidden rounded-full bg-[rgba(252,252,253,0.06)]">
            <div
              className="h-full bg-[#00dae8] transition-[width]"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Right: meta + actions */}
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-mono text-[12px] tabular-nums text-[rgba(252,252,253,0.5)]">
          {durationLabel}
        </span>
        {ready && signedAudio && (
          <a
            href={signedAudio}
            download={`${job.original_name.slice(0, 40)}.mp3`}
            aria-label="Download"
            className="flex size-8 items-center justify-center rounded-full text-[rgba(252,252,253,0.5)] opacity-0 transition-opacity hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd] group-hover:opacity-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
          </a>
        )}
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-3 h-px w-12 bg-[rgba(252,252,253,0.1)]" />
      <p className="text-[13px] text-[rgba(252,252,253,0.55)]">No tracks yet.</p>
      <p className="mt-1 text-[12px] text-[rgba(252,252,253,0.35)]">
        Describe a style on the left and hit Create.
      </p>
    </div>
  );
}
