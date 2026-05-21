"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { startVocalIsolation } from "@/app/actions";
import AudioSourcePicker, { type LibraryItem } from "./AudioSourcePicker";
import { createClient } from "@/lib/supabase/client";
import type { JobStatus, StemPaths } from "@/lib/separation";

export type VocalIsolationJob = {
  id: string;
  status: JobStatus;
  original_name: string;
  stems: StemPaths | null;
  error: string | null;
  created_at: string;
  duration_seconds: number | null;
};

type Mode = "vocal" | "karaoke";

/** Reads the audio's duration from a File without uploading it. */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = "metadata";
    const done = (v: number | null) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    a.onloadedmetadata = () =>
      done(Number.isFinite(a.duration) ? a.duration : null);
    a.onerror = () => done(null);
    a.src = url;
  });
}

function formatMinSec(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function targetStemFor(mode: Mode): "vocals" | "instrumental" {
  return mode === "vocal" ? "vocals" : "instrumental";
}

/**
 * Vocal Isolator + Karaoke share this flow — both submit a 2-stem
 * `vocal_isolation` job. Source can be a fresh upload or a track already in
 * the user's library (reuses the existing `input_path`, no re-upload).
 *
 * The component is the whole tool surface: upload picker on top, live status
 * + inline playback for the active job, and a recent-runs strip underneath.
 * Job updates stream in over Supabase Realtime — no polling, no page reload.
 */
export default function VocalIsolationFlow({
  userId,
  library,
  initialJobs,
  mode,
}: {
  userId: string;
  library: LibraryItem[];
  initialJobs: VocalIsolationJob[];
  mode: Mode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const targetStem = targetStemFor(mode);

  const [jobs, setJobs] = useState<VocalIsolationJob[]>(initialJobs);
  const [activeJobId, setActiveJobId] = useState<string | null>(() => {
    const inFlight = initialJobs.find(
      (j) => j.status === "pending" || j.status === "processing",
    );
    return inFlight?.id ?? null;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---------- realtime: new + updated vocal_isolation jobs ---------- */
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(
        `vocal_iso:${userId}:${Math.random().toString(36).slice(2, 10)}`,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "separation_jobs",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as VocalIsolationJob & { job_type?: string };
          if (row.job_type !== "vocal_isolation") return;
          setJobs((prev) => {
            const rest = prev.filter((j) => j.id !== row.id);
            return [
              {
                id: row.id,
                status: row.status,
                original_name: row.original_name,
                stems: row.stems ?? null,
                error: row.error ?? null,
                created_at: row.created_at,
                duration_seconds: row.duration_seconds ?? null,
              },
              ...rest,
            ].sort((a, b) => b.created_at.localeCompare(a.created_at));
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  /* ---------- upload-then-submit ---------- */
  const onUpload = async (file: File) => {
    setError(null);
    setSubmitting(true);
    try {
      const duration = await readDuration(file);
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${userId}/${crypto.randomUUID()}/${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(path, file, { contentType: file.type || undefined });
      if (uploadError) throw new Error(uploadError.message);

      const result = await startVocalIsolation(path, file.name, duration);
      if (result.error || !result.jobId) {
        throw new Error(result.error ?? "Could not start the job.");
      }
      // Optimistically add the new row so the active card appears instantly.
      // Realtime will reconcile status as the worker progresses.
      setJobs((prev) => [
        {
          id: result.jobId!,
          status: "pending",
          original_name: file.name,
          stems: null,
          error: null,
          created_at: new Date().toISOString(),
          duration_seconds: duration,
        },
        ...prev.filter((j) => j.id !== result.jobId),
      ]);
      setActiveJobId(result.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- pick-from-library ---------- */
  const onPickLibrary = async (item: LibraryItem) => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await startVocalIsolation(item.input_path, item.original_name);
      if (result.error || !result.jobId) {
        throw new Error(result.error ?? "Could not start the job.");
      }
      setJobs((prev) => [
        {
          id: result.jobId!,
          status: "pending",
          original_name: item.original_name,
          stems: null,
          error: null,
          created_at: new Date().toISOString(),
          duration_seconds: null,
        },
        ...prev.filter((j) => j.id !== result.jobId),
      ]);
      setActiveJobId(result.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit job.");
    } finally {
      setSubmitting(false);
    }
  };

  const activeJob = useMemo(
    () => (activeJobId ? jobs.find((j) => j.id === activeJobId) ?? null : null),
    [activeJobId, jobs],
  );

  const recentRuns = useMemo(
    () => jobs.filter((j) => j.id !== activeJobId).slice(0, 6),
    [jobs, activeJobId],
  );

  const resetToPicker = useCallback(() => {
    setActiveJobId(null);
    setError(null);
  }, []);

  /* ---------- active-job view ---------- */
  if (activeJob) {
    return (
      <div className="space-y-6">
        <ActiveJobCard
          job={activeJob}
          mode={mode}
          targetStem={targetStem}
          supabase={supabase}
          onRunAnother={resetToPicker}
        />
        {recentRuns.length > 0 && (
          <RecentRuns
            runs={recentRuns}
            mode={mode}
            targetStem={targetStem}
            supabase={supabase}
            onResume={(id) => setActiveJobId(id)}
          />
        )}
      </div>
    );
  }

  /* ---------- picker view ---------- */
  return (
    <div className="space-y-6">
      <AudioSourcePicker
        mode="audio"
        library={library}
        onUpload={onUpload}
        onPickLibrary={onPickLibrary}
        uploading={submitting}
        uploadError={error}
      />
      <p className="text-[12px] leading-relaxed text-[rgba(252,252,253,0.5)]">
        Powered by the same Mel-Roformer pipeline as Track Separation — but
        only the vocal / instrumental split runs, so it&apos;s roughly 3×
        faster.
      </p>
      {recentRuns.length > 0 && (
        <RecentRuns
          runs={recentRuns}
          mode={mode}
          targetStem={targetStem}
          supabase={supabase}
          onResume={(id) => setActiveJobId(id)}
        />
      )}
    </div>
  );
}

/* ---------------- active job card ---------------- */

type SupabaseLike = ReturnType<typeof createClient>;

function ActiveJobCard({
  job,
  mode,
  targetStem,
  supabase,
  onRunAnother,
}: {
  job: VocalIsolationJob;
  mode: Mode;
  targetStem: "vocals" | "instrumental";
  supabase: SupabaseLike;
  onRunAnother: () => void;
}) {
  const inFlight = job.status === "pending" || job.status === "processing";
  const failed = job.status === "failed";
  const stemPath = job.stems?.[targetStem];
  const ready = job.status === "completed" && Boolean(stemPath);

  return (
    <div className="rounded-[20px] border border-[rgba(252,252,253,0.1)] bg-[rgba(252,252,253,0.03)] p-7">
      <div className="flex items-start gap-4">
        <StatusIcon status={job.status} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-[#fcfcfd]">
            {job.original_name}
          </p>
          <p className="mt-1 text-[13px] text-[rgba(252,252,253,0.6)]">
            {inFlight && (mode === "vocal"
              ? "Isolating the vocal — usually under a minute."
              : "Stripping the vocal — usually under a minute.")}
            {ready && (mode === "vocal"
              ? "Vocal ready. Preview and download below."
              : "Karaoke ready. Preview and download below.")}
            {failed &&
              (job.error?.split("\n")[0]?.slice(0, 200) ||
                "Something went wrong. Try again.")}
          </p>
        </div>
        <button
          type="button"
          onClick={onRunAnother}
          className="flex h-9 shrink-0 items-center rounded-full border border-[rgba(252,252,253,0.1)] px-3.5 text-[12px] text-[rgba(252,252,253,0.65)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]"
        >
          Run another
        </button>
      </div>

      {inFlight && <ProgressStripe status={job.status} />}

      {ready && stemPath && (
        <div className="mt-5">
          <StemPlayer
            jobId={job.id}
            stemPath={stemPath}
            stemLabel={targetStem === "vocals" ? "Vocals" : "Instrumental"}
            originalName={job.original_name}
            supabase={supabase}
          />
          <div className="mt-3 flex gap-2">
            <Link
              href={`/track/${job.id}`}
              className="flex h-9 items-center rounded-full border border-[rgba(252,252,253,0.1)] px-3.5 text-[12px] text-[rgba(252,252,253,0.65)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]"
            >
              Open in editor
            </Link>
          </div>
        </div>
      )}

      {failed && (
        <details className="mt-4 rounded-[10px] border border-[rgba(255,107,107,0.2)] bg-[rgba(255,107,107,0.04)] p-3">
          <summary className="cursor-pointer text-[12px] text-[#ff8888]">
            Error details
          </summary>
          <pre className="mt-2 max-h-[180px] overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[rgba(255,200,200,0.85)]">
            {job.error || "No error detail available."}
          </pre>
        </details>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: JobStatus }) {
  if (status === "pending" || status === "processing") {
    return (
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[rgba(0,218,232,0.12)] text-[#00dae8]">
        <span className="size-4 animate-spin rounded-full border-2 border-[rgba(0,218,232,0.25)] border-t-[#00dae8]" />
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[rgba(10,255,167,0.14)] text-[#0affa7]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  return (
    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[rgba(255,107,107,0.14)] text-[#ff8888]">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
    </span>
  );
}

function ProgressStripe({ status }: { status: JobStatus }) {
  // Indeterminate two-stage stripe — at "pending" the worker hasn't picked
  // up the job, at "processing" the GPU is actively crunching.
  const reach = status === "processing" ? 0.7 : 0.25;
  return (
    <div className="mt-5">
      <div className="h-[3px] overflow-hidden rounded-full bg-[rgba(252,252,253,0.06)]">
        <div
          className="h-full animate-pulse bg-[#00dae8] transition-[width] duration-700"
          style={{ width: `${reach * 100}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] tabular-nums text-[rgba(252,252,253,0.4)]">
        <span>Queued</span>
        <span className={status === "processing" ? "text-[#00dae8]" : ""}>
          Processing
        </span>
        <span>Done</span>
      </div>
    </div>
  );
}

/* ---------------- recent runs strip ---------------- */

function RecentRuns({
  runs,
  mode,
  targetStem,
  supabase,
  onResume,
}: {
  runs: VocalIsolationJob[];
  mode: Mode;
  targetStem: "vocals" | "instrumental";
  supabase: SupabaseLike;
  onResume: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[13px] font-medium text-[#fcfcfd]">Recent runs</h2>
        <p className="text-[11px] text-[rgba(252,252,253,0.45)]">
          Last {runs.length}
        </p>
      </div>
      <ul className="flex flex-col gap-1">
        {runs.map((run) => (
          <RecentRunRow
            key={run.id}
            job={run}
            mode={mode}
            targetStem={targetStem}
            supabase={supabase}
            onResume={() => onResume(run.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function RecentRunRow({
  job,
  mode,
  targetStem,
  supabase,
  onResume,
}: {
  job: VocalIsolationJob;
  mode: Mode;
  targetStem: "vocals" | "instrumental";
  supabase: SupabaseLike;
  onResume: () => void;
}) {
  const stemPath = job.stems?.[targetStem];
  const ready = job.status === "completed" && Boolean(stemPath);
  const inFlight = job.status === "pending" || job.status === "processing";
  const failed = job.status === "failed";

  return (
    <li className="group flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors hover:bg-[rgba(252,252,253,0.03)]">
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
          ready
            ? "bg-[rgba(0,218,232,0.12)] text-[#00dae8]"
            : failed
              ? "bg-[rgba(255,107,107,0.12)] text-[#ff8888]"
              : "bg-[rgba(252,252,253,0.05)] text-[rgba(252,252,253,0.55)]"
        }`}
      >
        {inFlight ? (
          <span className="size-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
        ) : ready ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-3.5 w-3.5">
            <path d="M8 5v14l11-7L8 5Z" />
          </svg>
        ) : failed ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3.5 w-3.5">
            <path d="M9 18V6l11-2v12" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="17" cy="16" r="3" />
          </svg>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-[#fcfcfd]">
          {job.original_name}
        </p>
        <p className="truncate text-[11px] text-[rgba(252,252,253,0.5)]">
          {ready
            ? mode === "vocal"
              ? "Vocal ready"
              : "Karaoke ready"
            : inFlight
              ? "Processing…"
              : failed
                ? "Failed"
                : "Pending"}
          {job.duration_seconds
            ? ` · ${formatMinSec(job.duration_seconds)}`
            : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 opacity-70 transition-opacity group-hover:opacity-100">
        {ready && stemPath && (
          <DownloadStemButton
            stemPath={stemPath}
            originalName={job.original_name}
            stemLabel={targetStem === "vocals" ? "vocals" : "instrumental"}
            supabase={supabase}
          />
        )}
        <button
          type="button"
          onClick={onResume}
          className="flex h-8 items-center rounded-full px-3 text-[11px] text-[rgba(252,252,253,0.65)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]"
        >
          Open
        </button>
      </div>
    </li>
  );
}

/* ---------------- player + download ---------------- */

function useSignedStemUrl(
  stemPath: string | undefined,
  supabase: SupabaseLike,
): { url: string | null; error: string | null; resolve: () => Promise<string | null> } {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<Promise<string | null> | null>(null);

  const resolve = useCallback(async (): Promise<string | null> => {
    if (url) return url;
    if (!stemPath) return null;
    if (pending.current) return pending.current;
    const p = (async () => {
      const { data, error } = await supabase.storage
        .from("stems")
        .createSignedUrl(stemPath, 60 * 60);
      if (error || !data?.signedUrl) {
        setError(error?.message ?? "Could not load audio.");
        return null;
      }
      setUrl(data.signedUrl);
      setError(null);
      return data.signedUrl;
    })();
    pending.current = p;
    try {
      return await p;
    } finally {
      pending.current = null;
    }
  }, [stemPath, supabase, url]);

  return { url, error, resolve };
}

function StemPlayer({
  jobId,
  stemPath,
  stemLabel,
  originalName,
  supabase,
}: {
  jobId: string;
  stemPath: string;
  stemLabel: string;
  originalName: string;
  supabase: SupabaseLike;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { error, resolve } = useSignedStemUrl(stemPath, supabase);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  // Pause this player whenever another instance starts (one-at-a-time).
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { except: string };
      if (detail.except !== jobId) {
        audioRef.current?.pause();
        setPlaying(false);
      }
    };
    window.addEventListener("moisi-stem-player-stop", handler);
    return () => window.removeEventListener("moisi-stem-player-stop", handler);
  }, [jobId]);

  const ensureLoaded = async (): Promise<HTMLAudioElement | null> => {
    if (audioRef.current) return audioRef.current;
    setLoading(true);
    try {
      const signed = await resolve();
      if (!signed) return null;
      const a = new Audio(signed);
      a.preload = "metadata";
      a.addEventListener("loadedmetadata", () => {
        setDuration(Number.isFinite(a.duration) ? a.duration : 0);
      });
      a.addEventListener("timeupdate", () => setCurrent(a.currentTime));
      a.addEventListener("ended", () => {
        setPlaying(false);
        setCurrent(0);
      });
      audioRef.current = a;
      return a;
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    const a = await ensureLoaded();
    if (!a) return;
    if (a.paused) {
      window.dispatchEvent(
        new CustomEvent("moisi-stem-player-stop", { detail: { except: jobId } }),
      );
      await a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    a.currentTime = ratio * duration;
    setCurrent(a.currentTime);
  };

  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-[rgba(252,252,253,0.08)] bg-[rgba(252,252,253,0.02)] px-3 py-2.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#00dae8] text-[#001316] transition-opacity hover:opacity-90"
      >
        {loading ? (
          <span className="size-4 animate-spin rounded-full border-2 border-[rgba(0,19,22,0.25)] border-t-[#001316]" />
        ) : playing ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-4 w-4">
            <path d="M8 5v14l11-7L8 5Z" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] text-[#fcfcfd]">{stemLabel}</p>
        <div
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={duration || 0}
          aria-valuenow={current}
          tabIndex={0}
          onClick={seek}
          className="mt-1.5 h-[4px] cursor-pointer overflow-hidden rounded-full bg-[rgba(252,252,253,0.06)]"
        >
          <div
            className="h-full bg-[#00dae8]"
            style={{
              width: duration ? `${(current / duration) * 100}%` : "0%",
            }}
          />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-[rgba(252,252,253,0.45)]">
          <span>{formatMinSec(current)}</span>
          <span>{duration ? formatMinSec(duration) : "—"}</span>
        </div>
        {error && (
          <p className="mt-1 text-[11px] text-[#ff8888]">{error}</p>
        )}
      </div>
      <DownloadStemButton
        stemPath={stemPath}
        originalName={originalName}
        stemLabel={stemLabel.toLowerCase()}
        supabase={supabase}
      />
    </div>
  );
}

function DownloadStemButton({
  stemPath,
  originalName,
  stemLabel,
  supabase,
}: {
  stemPath: string;
  originalName: string;
  stemLabel: string;
  supabase: SupabaseLike;
}) {
  const [loading, setLoading] = useState(false);

  const download = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.storage
        .from("stems")
        .createSignedUrl(stemPath, 60 * 60, {
          download: `${originalName.replace(/\.[^.]+$/, "")} - ${stemLabel}.mp3`,
        });
      if (data?.signedUrl) {
        const a = document.createElement("a");
        a.href = data.signedUrl;
        a.rel = "noopener";
        a.click();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={download}
      disabled={loading}
      aria-label={`Download ${stemLabel}`}
      className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[rgba(252,252,253,0.1)] text-[rgba(252,252,253,0.65)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd] disabled:opacity-50"
    >
      {loading ? (
        <span className="size-3.5 animate-spin rounded-full border-2 border-[rgba(252,252,253,0.3)] border-t-[#fcfcfd]" />
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
          <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
      )}
    </button>
  );
}
