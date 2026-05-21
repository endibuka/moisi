"use client";

import {
  ArrowRight,
  ArrowsClockwise,
  CaretDown,
  ChartBar,
  Check,
  Copy,
  DownloadSimple,
  Image as ImageIcon,
  MagicWand,
  MusicNotes,
  Question,
  Waveform,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { regenerateLyrics } from "@/app/actions/lyric-regen";
import { generateMusic } from "@/app/actions/music-gen";
import SegmentedControl from "@/components/SegmentedControl";
import TickSlider from "@/components/TickSlider";

type Props = {
  text: string;
  /** While the assistant is still streaming this message — disables destructive actions. */
  streaming?: boolean;
  /** Send a follow-up message on behalf of the user (used by LyricsCard buttons). */
  onSend?: (message: string, opts?: { silent?: boolean }) => void;
  /** Together with `messageId`, used to namespace per-card persisted state
   *  (e.g. QuestionsCard remembers which chips you picked). */
  conversationId?: string;
  messageId?: string;
};

/**
 * Strip the `Style: ...` hint line out of the rendered markdown and surface
 * it separately so the LyricsCard can prefill its Style field. The lyric
 * writer agent emits a single such line right after the lyrics fence as the
 * suggested audio-prompt for the music generator.
 */
function extractStyleHint(text: string): { cleaned: string; style: string | null } {
  const match = text.match(/(^|\n)[ \t]*Style:[ \t]*([^\n]+)/i);
  if (!match) return { cleaned: text, style: null };
  const style = match[2].trim();
  // Remove just the matched line (keep surrounding newlines tidy).
  const cleaned = text.replace(/(^|\n)[ \t]*Style:[ \t]*[^\n]+\n?/i, "$1").trim();
  return { cleaned, style };
}

export default function MuseMarkdown({
  text,
  streaming,
  onSend,
  conversationId,
  messageId,
}: Props) {
  const { cleaned, style: suggestedStyle } = useMemo(
    () => extractStyleHint(text),
    [text],
  );

  // Stable key for any per-card persisted state. Falls back to a hash of
  // the text when ids aren't provided (rare — only happens during SSR
  // before MuseChat has settled on a conversationId).
  const persistKey =
    conversationId && messageId
      ? `${conversationId}.${messageId}`
      : `anon.${text.length}`;

  const components: Components = {
    // Lyric blocks render as a custom card; other fenced code stays as a styled <pre><code>.
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className ?? "");
      const lang = match?.[1];
      const isBlock = Boolean(className?.startsWith("language-"));
      const content = String(children ?? "").replace(/\n$/, "");

      if (isBlock && lang === "lyrics") {
        return (
          <LyricsCard
            text={content}
            suggestedStyle={suggestedStyle}
            streaming={streaming}
            onSend={onSend}
            persistKey={persistKey}
          />
        );
      }
      if (isBlock && lang === "questions") {
        return (
          <QuestionsCard
            text={content}
            streaming={streaming}
            onSend={onSend}
            persistKey={persistKey}
          />
        );
      }
      if (isBlock && lang === "cover") {
        return <CoverArtCard text={content} streaming={streaming} />;
      }
      if (isBlock && lang === "analysis") {
        return <AnalysisCard text={content} streaming={streaming} />;
      }
      if (isBlock) {
        return (
          <pre className="overflow-x-auto rounded-[10px] border border-[rgba(252,253,255,0.08)] bg-[rgba(252,253,255,0.03)] p-3">
            <code className="text-[12.5px] leading-relaxed text-[#edeef0]" {...props}>
              {children}
            </code>
          </pre>
        );
      }
      return (
        <code
          className="rounded-[4px] bg-[rgba(252,253,255,0.06)] px-1 py-0.5 text-[12.5px] text-[#edeef0]"
          {...props}
        >
          {children}
        </code>
      );
    },
    // ReactMarkdown wraps fenced code in <pre><code>. <pre> defaults to
    // white-space: pre, which would (a) break text wrapping inside our
    // QuestionsCard/LyricsCard and (b) double-wrap our own styled <pre> in the
    // generic code-block path. Stripping the outer <pre> is safe because every
    // branch of code() above renders its own container.
    pre({ children }) {
      return <>{children}</>;
    },
    p({ children }) {
      return <p className="leading-[1.65]">{children}</p>;
    },
    ul({ children }) {
      return <ul className="my-1 list-disc space-y-1 pl-5">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="my-1 list-decimal space-y-1 pl-5">{children}</ol>;
    },
    li({ children }) {
      return <li className="leading-[1.6] marker:text-[rgba(241,247,254,0.4)]">{children}</li>;
    },
    h1({ children }) {
      return <h1 className="mt-3 mb-1 text-[18px] font-medium text-[#fcfcfd]">{children}</h1>;
    },
    h2({ children }) {
      return <h2 className="mt-3 mb-1 text-[16px] font-medium text-[#fcfcfd]">{children}</h2>;
    },
    h3({ children }) {
      return <h3 className="mt-2 mb-1 text-[14px] font-medium text-[#fcfcfd]">{children}</h3>;
    },
    a({ children, href }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[#00dae8] underline-offset-2 hover:underline"
        >
          {children}
        </a>
      );
    },
    blockquote({ children }) {
      return (
        <blockquote className="border-l-2 border-[rgba(0,218,232,0.4)] pl-3 text-[rgba(241,247,254,0.85)]">
          {children}
        </blockquote>
      );
    },
    strong({ children }) {
      return <strong className="font-medium text-[#fcfcfd]">{children}</strong>;
    },
    em({ children }) {
      return <em className="italic text-[rgba(241,247,254,0.92)]">{children}</em>;
    },
    hr() {
      return <hr className="my-3 border-[rgba(252,253,255,0.08)]" />;
    },
  };

  return (
    <div className="markdown-body space-y-2.5">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {cleaned}
      </ReactMarkdown>
    </div>
  );
}

type Mode = "vocal" | "instrumental";

function loadLyricsOverride(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(`muse.l.${key}`);
  } catch {
    return null;
  }
}

function saveLyricsOverride(key: string, lyrics: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`muse.l.${key}`, lyrics);
  } catch {
    // ignore — quota / private mode
  }
}

function LyricsCard({
  text,
  suggestedStyle,
  streaming,
  persistKey,
}: {
  text: string;
  suggestedStyle: string | null;
  streaming?: boolean;
  /** No longer used — kept on the type signature so callers don't need to
   *  change. Regenerate is now an in-place server-action call, not a chat
   *  message. */
  onSend?: (message: string, opts?: { silent?: boolean }) => void;
  persistKey: string;
}) {
  const [copied, setCopied] = useState(false);

  // Regenerate produces a new lyric draft that overrides the agent's
  // original. Stored in localStorage so reloads / remounts see the latest
  // version. While `override` is null, we follow the prop (which is the
  // agent's streaming output); once set, the override sticks.
  const [override, setOverride] = useState<string | null>(
    () => loadLyricsOverride(persistKey),
  );
  const [regenerating, setRegenerating] = useState(false);

  // Derived: what we display + what we send to the music generator. No
  // setState-in-effect needed because the prop change naturally flows
  // through this expression on every render.
  const lyrics = override ?? text;

  // Inline create-music form state. Hidden until the user clicks "Create
  // music" — collapsed form keeps the lyric card visually quiet by default.
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState(suggestedStyle ?? "");
  const [mode, setMode] = useState<Mode>("vocal");
  const [nSegments, setNSegments] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lyrics);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — clipboard not available
    }
  };

  const regenerate = async () => {
    if (regenerating || streaming) return;
    setError(null);
    setRegenerating(true);
    try {
      const result = await regenerateLyrics(lyrics);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOverride(result.lyrics);
      saveLyricsOverride(persistKey, result.lyrics);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not regenerate.",
      );
    } finally {
      setRegenerating(false);
    }
  };

  const lyricsCount = lyrics.length;
  const styleCount = style.length;

  const canCreate =
    !submitting &&
    !streaming &&
    !regenerating &&
    styleCount >= 4 &&
    styleCount <= 500 &&
    (mode === "instrumental" || lyricsCount > 0) &&
    lyricsCount <= 4000;

  const create = async () => {
    if (!canCreate) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await generateMusic({
        genre: style.trim(),
        lyrics: mode === "instrumental" ? "" : lyrics,
        nSegments,
      });
      if (result.error || !result.jobId) {
        setError(result.error ?? "Failed to start the track.");
        return;
      }
      setCreatedJobId(result.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start the track.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-[20px] border border-[rgba(252,253,255,0.1)] bg-[#0e0f11]">
      <div className="flex items-center justify-between border-b border-[rgba(252,253,255,0.1)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <MusicNotes weight="fill" className="h-3.5 w-3.5 text-[#00dae8]" />
          <span className="text-[12px] font-medium uppercase tracking-[1.2px] text-[rgba(252,252,253,0.6)]">
            Lyrics
          </span>
          {(streaming || regenerating) && (
            <span className="ml-1 inline-flex items-center gap-1.5 text-[11px] text-[rgba(252,252,253,0.5)]">
              <span className="size-1.5 animate-pulse rounded-full bg-[#00dae8]" />
              {regenerating ? "regenerating" : "writing"}
            </span>
          )}
          <span className="ml-1 font-mono text-[10px] tabular-nums text-[rgba(252,252,253,0.35)]">
            {lyricsCount}/4000
          </span>
        </div>
        <div className="flex items-center gap-1">
          <CardButton
            title="Copy lyrics"
            onClick={copy}
            disabled={!lyrics.trim() || regenerating}
          >
            {copied ? <Check weight="bold" className="h-3 w-3" /> : <Copy weight="fill" className="h-3 w-3" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </CardButton>
          <CardButton
            title="Regenerate lyrics in place"
            onClick={regenerate}
            disabled={streaming || regenerating || !lyrics.trim()}
          >
            <ArrowsClockwise
              weight="bold"
              className={`h-3 w-3 ${regenerating ? "animate-spin" : ""}`}
            />
            <span>{regenerating ? "Regenerating…" : "Regenerate"}</span>
          </CardButton>
        </div>
      </div>

      <pre
        className={`min-w-0 overflow-x-auto whitespace-pre-wrap break-words px-5 py-4 font-sans text-[14px] leading-[1.7] text-[#fcfcfd] transition-opacity ${
          regenerating ? "opacity-60" : ""
        }`}
      >
        {lyrics || (streaming ? " " : "")}
      </pre>

      {createdJobId ? (
        <div className="flex items-center gap-3 border-t border-[rgba(252,253,255,0.1)] bg-[rgba(0,218,232,0.04)] px-4 py-3">
          <span className="flex size-7 items-center justify-center rounded-full bg-[rgba(0,218,232,0.12)] text-[#00dae8]">
            <Waveform weight="fill" className="h-3.5 w-3.5" />
          </span>
          <div className="flex-1 text-[12.5px] text-[#fcfcfd]">
            <span className="font-medium">Track started.</span>{" "}
            <span className="text-[rgba(252,252,253,0.6)]">
              It&apos;ll appear under Music Generator when ready.
            </span>
          </div>
          <a
            href="/tools/music-generator"
            className="inline-flex items-center gap-1 rounded-full bg-[#00dae8] px-3 py-1.5 text-[12px] font-medium text-[#001316] hover:opacity-90"
          >
            Open <ArrowRight weight="bold" className="h-3 w-3" />
          </a>
        </div>
      ) : !open ? (
        <div className="flex items-center justify-end border-t border-[rgba(252,253,255,0.1)] px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={streaming}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#00dae8] px-4 py-1.5 text-[12.5px] font-medium text-[#001316] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MagicWand weight="fill" className="h-3.5 w-3.5" />
            Create music
          </button>
        </div>
      ) : (
        <div className="space-y-4 border-t border-[rgba(252,253,255,0.1)] px-5 py-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-[1.2px] text-[rgba(252,252,253,0.5)]">
              Create music
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 text-[11px] text-[rgba(252,252,253,0.5)] hover:text-[#fcfcfd]"
            >
              <CaretDown weight="bold" className="h-3 w-3" />
              Hide
            </button>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[11px] text-[rgba(252,252,253,0.55)]">Style</p>
              <p className="font-mono text-[10px] tabular-nums text-[rgba(252,252,253,0.3)]">
                {styleCount}/500
              </p>
            </div>
            <textarea
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="Describe the music — mood, genre, BPM, instruments, vocals…"
              rows={2}
              maxLength={500}
              className="w-full resize-none rounded-[10px] border border-[rgba(252,253,255,0.08)] bg-[rgba(252,253,255,0.02)] px-3 py-2 text-[13px] leading-relaxed text-[#fcfcfd] outline-none placeholder:text-[rgba(252,252,253,0.3)] focus:border-[rgba(252,253,255,0.2)]"
            />
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-1.5 text-[11px] text-[rgba(252,252,253,0.55)]">Mode</p>
              <SegmentedControl
                value={mode}
                onChange={setMode}
                ariaLabel="Vocal or instrumental"
                size="sm"
                options={[
                  { value: "vocal", label: "Vocal" },
                  { value: "instrumental", label: "Instrumental" },
                ]}
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-[11px] text-[rgba(252,252,253,0.55)]">Length</p>
                <p className="font-mono text-[12px] tabular-nums text-[#fcfcfd]">
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
            </div>
          </div>

          {error && (
            <p className="rounded-[8px] border border-[rgba(255,107,107,0.25)] bg-[rgba(255,107,107,0.04)] px-3 py-2 text-[12px] text-[#ff8888]">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-[rgba(252,252,253,0.35)]">
              {mode === "instrumental"
                ? "Lyrics will be skipped — generator gets a pure style prompt."
                : "Generator uses these lyrics with your style as the audio prompt."}
            </p>
            <button
              type="button"
              onClick={create}
              disabled={!canCreate}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#00dae8] px-4 py-1.5 text-[12.5px] font-medium text-[#001316] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[rgba(252,253,255,0.08)] disabled:text-[rgba(252,252,253,0.4)]"
            >
              {submitting && (
                <span className="size-3 animate-spin rounded-full border-2 border-[rgba(0,19,22,0.3)] border-t-[#001316]" />
              )}
              {submitting ? "Starting" : "Create track"}
              {!submitting && <ArrowRight weight="bold" className="h-3 w-3" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatMinSec(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

type CoverArtPayload = {
  url: string;
  title?: string | null;
  prompt?: string | null;
  libraryJobId?: string | null;
};

/**
 * Square placeholder shown while a cover is being generated. 3×3 grid of
 * cyan-tinted tiles with staggered pulse — gives the user something concrete
 * to watch instead of a generic spinner. Exported because MuseChat uses it
 * to replace the typing-dots while `create_cover_art` is in flight.
 */
export function CoverArtSkeleton() {
  return (
    <div className="my-3 overflow-hidden rounded-[20px] border border-[rgba(252,253,255,0.1)] bg-[#0e0f11]">
      <div className="flex items-center gap-2 border-b border-[rgba(252,253,255,0.1)] px-4 py-2.5">
        <ImageIcon weight="fill" className="h-3.5 w-3.5 text-[#00dae8]" />
        <span className="text-[12px] font-medium uppercase tracking-[1.2px] text-[rgba(252,252,253,0.6)]">
          Cover art
        </span>
        <span className="ml-1 inline-flex items-center gap-1.5 text-[11px] text-[rgba(252,252,253,0.5)]">
          <span className="size-1.5 animate-pulse rounded-full bg-[#00dae8]" />
          generating
        </span>
      </div>
      <div className="grid aspect-square w-full grid-cols-3 grid-rows-3 gap-1.5 bg-[rgba(252,253,255,0.02)] p-1.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-[6px] bg-[rgba(0,218,232,0.09)]"
            style={{ animationDelay: `${i * 110}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function CoverArtCard({
  text,
}: {
  text: string;
  streaming?: boolean;
}) {
  // The agent emits a `cover` fence containing a JSON object. While the
  // message is still streaming this can be partial — fall back to the same
  // shared skeleton until we have a full, parseable payload with a URL.
  const payload = useMemo<CoverArtPayload | null>(() => {
    try {
      const obj = JSON.parse(text);
      if (!obj || typeof obj.url !== "string") return null;
      return obj as CoverArtPayload;
    } catch {
      return null;
    }
  }, [text]);

  if (!payload) return <CoverArtSkeleton />;

  const title = payload.title?.trim() || "Cover art";
  const safeFile = title.replace(/[^\w.\- ]+/g, "_").slice(0, 60);

  return (
    <div className="my-3 overflow-hidden rounded-[20px] border border-[rgba(252,253,255,0.1)] bg-[#0e0f11]">
      <div className="flex items-center justify-between border-b border-[rgba(252,253,255,0.1)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <ImageIcon weight="fill" className="h-3.5 w-3.5 text-[#00dae8]" />
          <span className="text-[12px] font-medium uppercase tracking-[1.2px] text-[rgba(252,252,253,0.6)]">
            Cover art
          </span>
          {payload.libraryJobId && (
            <span className="ml-1 rounded-full bg-[rgba(0,218,232,0.1)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#00dae8]">
              Linked to track
            </span>
          )}
        </div>
        <a
          href={payload.url}
          download={`${safeFile} - cover.png`}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium text-[rgba(252,252,253,0.6)] transition-colors hover:bg-white/5 hover:text-white"
        >
          <DownloadSimple weight="bold" className="h-3 w-3" />
          <span>Download</span>
        </a>
      </div>

      <div className="bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={payload.url}
          alt={`Cover art for ${title}`}
          className="block aspect-square w-full object-cover"
        />
      </div>

      <div className="space-y-1 px-5 py-3.5">
        <p className="text-[14px] font-medium text-[#fcfcfd]">{title}</p>
        {payload.prompt && (
          <p className="text-[12px] leading-relaxed text-[rgba(252,252,253,0.55)]">
            {payload.prompt}
          </p>
        )}
      </div>
    </div>
  );
}

type AnalysisPayload = {
  title?: string;
  jobType?: "separation" | "vocal_isolation" | "music_generation";
  bpm?: number | null;
  key?: string | null;
  mode?: "major" | "minor" | null;
  durationSeconds?: number | null;
  loudnessDb?: number | null;
  brightnessHz?: number | null;
  stems?: string[];
  vibe?: string;
  hasAnalysis?: boolean;
  jobId?: string;
  hasCover?: boolean;
  prompt?: string | null;
  lyricsExcerpt?: string | null;
};

function AnalysisCard({
  text,
  streaming,
}: {
  text: string;
  streaming?: boolean;
}) {
  const payload = useMemo<AnalysisPayload | null>(() => {
    try {
      const obj = JSON.parse(text);
      if (!obj || typeof obj !== "object") return null;
      return obj as AnalysisPayload;
    } catch {
      return null;
    }
  }, [text]);

  if (!payload) {
    return (
      <div className="my-3 overflow-hidden rounded-[20px] border border-[rgba(252,253,255,0.1)] bg-[#0e0f11]">
        <div className="flex items-center gap-2 border-b border-[rgba(252,253,255,0.1)] px-4 py-2.5">
          <ChartBar weight="fill" className="h-3.5 w-3.5 text-[#00dae8]" />
          <span className="text-[12px] font-medium uppercase tracking-[1.2px] text-[rgba(252,252,253,0.6)]">
            Track inspection
          </span>
          {streaming && (
            <span className="ml-1 inline-flex items-center gap-1.5 text-[11px] text-[rgba(252,252,253,0.5)]">
              <span className="size-1.5 animate-pulse rounded-full bg-[#00dae8]" />
              analyzing
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-px bg-[rgba(252,253,255,0.04)] p-px">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex h-16 animate-pulse items-center justify-center bg-[#0e0f11]"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  const title = payload.title?.trim() || "Track";
  const jobTypeLabel =
    payload.jobType === "music_generation"
      ? "Generated"
      : payload.jobType === "vocal_isolation"
        ? "Vocal isolation"
        : payload.jobType === "separation"
          ? "Separation"
          : null;
  const stems = payload.stems ?? [];
  const has = payload.hasAnalysis !== false; // default to true unless explicitly false

  const formatDuration = (s: number | null | undefined) => {
    if (s == null || !Number.isFinite(s)) return "—";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  // BPM → tempo descriptor for the second line of the BPM tile.
  const tempoLabel = (bpm: number | null | undefined) => {
    if (bpm == null) return null;
    if (bpm < 76) return "Slow";
    if (bpm < 100) return "Medium-slow";
    if (bpm < 120) return "Medium";
    if (bpm < 140) return "Up-tempo";
    if (bpm < 168) return "Fast";
    return "Very fast";
  };

  // Loudness in dBFS (negative). Closer to 0 = louder.
  const loudnessLabel = (db: number | null | undefined) => {
    if (db == null) return null;
    if (db > -8) return "Hot";
    if (db > -14) return "Loud";
    if (db > -20) return "Balanced";
    if (db > -28) return "Quiet";
    return "Whisper";
  };

  // Brightness (spectral centroid in Hz).
  const brightnessLabel = (hz: number | null | undefined) => {
    if (hz == null) return null;
    if (hz < 1500) return "Dark";
    if (hz < 2500) return "Warm";
    if (hz < 3500) return "Balanced";
    if (hz < 5000) return "Bright";
    return "Airy";
  };

  return (
    <div className="my-3 overflow-hidden rounded-[20px] border border-[rgba(252,253,255,0.1)] bg-[#0e0f11]">
      <div className="flex items-center justify-between gap-3 border-b border-[rgba(252,253,255,0.1)] px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ChartBar weight="fill" className="h-3.5 w-3.5 text-[#00dae8]" />
            <span className="text-[11px] font-medium uppercase tracking-[1.2px] text-[rgba(252,252,253,0.5)]">
              Track inspection
            </span>
            {jobTypeLabel && (
              <span className="rounded-full bg-[rgba(252,252,253,0.05)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[rgba(252,252,253,0.55)]">
                {jobTypeLabel}
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-[14px] font-medium text-[#fcfcfd]">
            {title}
          </p>
        </div>
      </div>

      {has ? (
        <div className="grid grid-cols-3 gap-px bg-[rgba(252,253,255,0.04)] p-px">
          <Stat
            label="BPM"
            value={payload.bpm != null ? `${payload.bpm}` : "—"}
            sub={tempoLabel(payload.bpm)}
          />
          <Stat
            label="Key"
            value={
              payload.key && payload.mode
                ? `${payload.key} ${payload.mode === "minor" ? "min" : "maj"}`
                : payload.key ?? "—"
            }
          />
          <Stat
            label="Duration"
            value={formatDuration(payload.durationSeconds)}
          />
          <Stat
            label="Loudness"
            value={
              payload.loudnessDb != null
                ? `${payload.loudnessDb.toFixed(1)} dB`
                : "—"
            }
            sub={loudnessLabel(payload.loudnessDb)}
          />
          <Stat
            label="Brightness"
            value={
              payload.brightnessHz != null
                ? `${(payload.brightnessHz / 1000).toFixed(1)} kHz`
                : "—"
            }
            sub={brightnessLabel(payload.brightnessHz)}
          />
          <Stat label="Stems" value={`${stems.length || "—"}`} />
        </div>
      ) : (
        <div className="px-5 py-4 text-[12.5px] leading-relaxed text-[rgba(252,252,253,0.6)]">
          Analysis isn&apos;t available for this track yet — it predates the
          inspector. Re-run a separation on the source audio to get BPM, key
          and loudness.
        </div>
      )}

      {payload.vibe && (
        <div className="border-t border-[rgba(252,253,255,0.06)] px-5 py-3.5">
          <p className="text-[11px] font-medium uppercase tracking-[1.2px] text-[rgba(252,252,253,0.4)]">
            Vibe
          </p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-[#fcfcfd]">
            {payload.vibe}
          </p>
        </div>
      )}

      {stems.length > 0 && (
        <div className="border-t border-[rgba(252,253,255,0.06)] px-5 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[1.2px] text-[rgba(252,252,253,0.4)]">
            Stems
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {stems.map((s) => (
              <span
                key={s}
                className="rounded-full border border-[rgba(252,253,255,0.08)] bg-[rgba(252,253,255,0.03)] px-2.5 py-0.5 text-[11px] text-[rgba(252,252,253,0.75)]"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {payload.prompt && (
        <div className="border-t border-[rgba(252,253,255,0.06)] px-5 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[1.2px] text-[rgba(252,252,253,0.4)]">
            Prompt
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[rgba(252,252,253,0.75)]">
            {payload.prompt}
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string | null;
}) {
  return (
    <div className="bg-[#0e0f11] px-3 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[1.2px] text-[rgba(252,252,253,0.4)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-[16px] tabular-nums text-[#fcfcfd]">
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-[10.5px] text-[rgba(252,252,253,0.45)]">
          {sub}
        </p>
      )}
    </div>
  );
}

type QuestionItem = {
  id: string;
  label: string;
  options?: string[];
  multi?: boolean;
  allowOther?: boolean;
  type?: "text";
  placeholder?: string;
};

type QuestionsBlock = {
  intro?: string;
  questions: QuestionItem[];
};

type QuestionsCardState = {
  selections: Record<string, string[]>;
  otherText: Record<string, string>;
  submitted: boolean;
};

function loadQuestionsState(key: string): QuestionsCardState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`muse.q.${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<QuestionsCardState>;
    return {
      selections: parsed.selections ?? {},
      otherText: parsed.otherText ?? {},
      submitted: parsed.submitted ?? false,
    };
  } catch {
    return null;
  }
}

function saveQuestionsState(key: string, state: QuestionsCardState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`muse.q.${key}`, JSON.stringify(state));
  } catch {
    // ignore — quota, private mode, etc.
  }
}

function QuestionsCard({
  text,
  streaming,
  onSend,
  persistKey,
}: {
  text: string;
  streaming?: boolean;
  onSend?: (message: string, opts?: { silent?: boolean }) => void;
  persistKey: string;
}) {
  const parsed = useMemo<QuestionsBlock | null>(() => {
    try {
      const obj = JSON.parse(text);
      if (!obj || !Array.isArray(obj.questions)) return null;
      return obj as QuestionsBlock;
    } catch {
      return null;
    }
  }, [text]);

  // Hydrate from localStorage on first mount so selections + submitted state
  // survive remounts (parent re-renders during streaming, ReactMarkdown
  // rebuilds, etc.) AND page reloads.
  const initial = useMemo(() => loadQuestionsState(persistKey), [persistKey]);
  const [selections, setSelections] = useState<Record<string, string[]>>(
    () => initial?.selections ?? {},
  );
  const [otherText, setOtherText] = useState<Record<string, string>>(
    () => initial?.otherText ?? {},
  );
  const [submitted, setSubmitted] = useState<boolean>(
    () => initial?.submitted ?? false,
  );

  // Persist any change.
  useEffect(() => {
    saveQuestionsState(persistKey, { selections, otherText, submitted });
  }, [persistKey, selections, otherText, submitted]);

  if (!parsed) {
    return (
      <div className="my-3 flex items-center gap-2 rounded-[20px] border border-[rgba(252,253,255,0.1)] bg-[#0e0f11] px-4 py-3 text-[12px] text-[rgba(252,252,253,0.6)]">
        <span className="size-1.5 animate-pulse rounded-full bg-[#00dae8]" />
        Preparing questions
      </div>
    );
  }

  const toggle = (q: QuestionItem, value: string) => {
    if (submitted) return;
    setSelections((prev) => {
      const cur = prev[q.id] ?? [];
      if (q.multi) {
        return {
          ...prev,
          [q.id]: cur.includes(value)
            ? cur.filter((v) => v !== value)
            : [...cur, value],
        };
      }
      return { ...prev, [q.id]: cur.includes(value) ? [] : [value] };
    });
  };

  const setOther = (qid: string, val: string) => {
    if (submitted) return;
    setOtherText((prev) => ({ ...prev, [qid]: val }));
  };

  const composeAnswer = (q: QuestionItem): string => {
    if (q.type === "text") return (otherText[q.id] ?? "").trim();
    const picks = selections[q.id] ?? [];
    const other = (otherText[q.id] ?? "").trim();
    const all = other ? [...picks, other] : picks;
    return all.join(", ");
  };

  const anyAnswered = parsed.questions.some((q) => composeAnswer(q).length > 0);

  const handleSubmit = () => {
    if (submitted || !onSend) return;
    const lines = parsed.questions
      .map((q) => {
        const answer = composeAnswer(q);
        return answer ? `- ${q.label}: ${answer}` : null;
      })
      .filter(Boolean);
    if (lines.length === 0) return;
    setSubmitted(true);
    onSend(`Here are my answers:\n${lines.join("\n")}`, { silent: true });
  };

  return (
    <div className="my-3 overflow-hidden rounded-[20px] border border-[rgba(252,253,255,0.1)] bg-[#0e0f11]">
      <div className="flex items-center justify-between border-b border-[rgba(252,253,255,0.1)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Question weight="fill" className="h-3.5 w-3.5 text-[rgba(252,252,253,0.6)]" />
          <span className="text-[12px] font-medium uppercase tracking-[1.2px] text-[rgba(252,252,253,0.6)]">
            Quick questions
          </span>
          {submitted && (
            <span className="ml-1 text-[11px] text-[#0affa7]">Answered</span>
          )}
        </div>
        {streaming && !submitted && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[rgba(252,252,253,0.5)]">
            <span className="size-1.5 animate-pulse rounded-full bg-[#00dae8]" />
            loading
          </span>
        )}
      </div>

      <div className="min-w-0 space-y-5 px-5 py-5">
        {parsed.intro && (
          <p className="text-[13.5px] leading-relaxed break-words text-[rgba(252,252,253,0.85)]">
            {parsed.intro}
          </p>
        )}

        {parsed.questions.map((q) => {
          const picked = selections[q.id] ?? [];
          return (
            <div key={q.id} className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[1.2px] text-[rgba(252,252,253,0.5)]">
                {q.label}
              </p>

              {q.type === "text" ? (
                <input
                  type="text"
                  value={otherText[q.id] ?? ""}
                  onChange={(e) => setOther(q.id, e.target.value)}
                  placeholder={q.placeholder ?? "Type your answer"}
                  disabled={submitted}
                  className="w-full rounded-full border border-[rgba(252,253,255,0.1)] bg-transparent px-4 py-2 text-[13px] text-[#fcfcfd] placeholder:text-[rgba(252,252,253,0.3)] focus:border-[rgba(252,253,255,0.25)] focus:outline-none disabled:opacity-60"
                />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(q.options ?? []).map((opt) => {
                    const selected = picked.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggle(q, opt)}
                        disabled={submitted}
                        className={`rounded-full border px-3 py-1.5 text-[12.5px] transition-colors disabled:cursor-default ${
                          selected
                            ? "border-[#00dae8] bg-[#00dae8] text-[#001316]"
                            : "border-[rgba(252,253,255,0.1)] bg-transparent text-[rgba(252,252,253,0.78)] hover:border-[rgba(252,253,255,0.25)] hover:bg-white/5 hover:text-white"
                        } ${submitted && !selected ? "opacity-40" : ""}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                  {q.allowOther && (
                    <input
                      type="text"
                      value={otherText[q.id] ?? ""}
                      onChange={(e) => setOther(q.id, e.target.value)}
                      placeholder="Other"
                      disabled={submitted}
                      className="min-w-[120px] flex-1 rounded-full border border-[rgba(252,253,255,0.1)] bg-transparent px-3 py-1.5 text-[12.5px] text-[#fcfcfd] placeholder:text-[rgba(252,252,253,0.3)] focus:border-[rgba(252,253,255,0.25)] focus:outline-none disabled:opacity-60"
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}

        {!submitted && (
          <div className="flex items-center justify-between pt-1">
            <p className="text-[11px] text-[rgba(252,252,253,0.3)]">
              Pick what fits, skip the rest.
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!anyAnswered || !onSend}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#00dae8] px-4 py-1.5 text-[12.5px] font-medium text-[#001316] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[rgba(252,253,255,0.08)] disabled:text-[rgba(252,252,253,0.4)]"
            >
              Send answers
              <ArrowRight weight="bold" className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CardButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium text-[rgba(252,252,253,0.6)] transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
