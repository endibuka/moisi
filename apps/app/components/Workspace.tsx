"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { startSeparation } from "@/app/actions";
import {
  ACCEPTED_AUDIO_EXT,
  MAX_UPLOAD_BYTES,
  type SeparationJob,
} from "@/lib/separation";
import { createClient } from "@/lib/supabase/client";
import UploadEmptyState from "./UploadEmptyState";

const HEADER_DASH = "—";

function formatDuration(seconds: number | null): string {
  if (!seconds || !Number.isFinite(seconds)) return HEADER_DASH;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatCreated(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Read the audio's duration without uploading. Returns null on failure. */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = "metadata";
    a.src = url;
    const done = (v: number | null) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? a.duration : null);
    a.onerror = () => done(null);
  });
}

export default function Workspace({
  userId,
  initialJobs,
}: {
  userId: string;
  initialJobs: SeparationJob[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [jobs, setJobs] = useState<SeparationJob[]>(initialJobs);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  // Live job status updates.
  useEffect(() => {
    const channel = supabase
      .channel("separation_jobs")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "separation_jobs",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as SeparationJob;
          setJobs((prev) => {
            const rest = prev.filter((j) => j.id !== row.id);
            return [row, ...rest].sort((a, b) =>
              b.created_at.localeCompare(a.created_at),
            );
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const pickFile = () => fileInput.current?.click();

  const processFile = async (file: File) => {
    setError(null);
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED_AUDIO_EXT.includes(ext)) {
      setError(`Unsupported file type. Use ${ACCEPTED_AUDIO_EXT.join(", ")}.`);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("File is too large (max 30 MB).");
      return;
    }

    setUploading(true);
    try {
      const duration = await readDuration(file);

      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${userId}/${crypto.randomUUID()}/${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(path, file, { contentType: file.type || undefined });
      if (uploadError) throw new Error(uploadError.message);

      const result = await startSeparation(path, file.name, duration);
      if (result.error) throw new Error(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void processFile(file);
  };

  // ---- drag & drop ----
  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current += 1;
    if (e.dataTransfer.types.includes("Files")) setDragging(true);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) setDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  return (
    <div
      className="relative h-full"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED_AUDIO_EXT.join(",")}
        onChange={handleInput}
        className="hidden"
      />

      {jobs.length === 0 ? (
        <>
          <UploadEmptyState onUpload={pickFile} uploading={uploading} />
          {error && (
            <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[13px] text-[#ff6b6b]">
              {error}
            </p>
          )}
        </>
      ) : (
        <div className="mx-auto max-w-[1400px] px-8 py-10">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-[28px] font-medium text-[#edeef0]">
              Track Separation{" "}
              <span className="ml-2 text-[14px] font-normal text-[rgba(241,247,254,0.5)]">
                {jobs.length} {jobs.length === 1 ? "file" : "files"}
              </span>
            </h1>

            <div className="flex items-center gap-2">
              <div className="hidden md:block">
                <SearchInput />
              </div>
              <IconButton ariaLabel="Filter">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  className="h-4 w-4"
                >
                  <path d="M4 5h16M7 12h10M10 19h4" />
                </svg>
              </IconButton>
              <IconButton ariaLabel="Sort">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  className="h-4 w-4"
                >
                  <path d="M7 4v16M3 8l4-4 4 4M17 20V4M21 16l-4 4-4-4" />
                </svg>
              </IconButton>
              <button
                type="button"
                onClick={pickFile}
                disabled={uploading}
                className="flex h-9 items-center gap-2 rounded-full border border-[rgba(252,252,253,0.1)] bg-white px-4 text-[13px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {uploading ? "Uploading…" : "Add"}
              </button>
            </div>
          </div>

          {error && <p className="mb-4 text-[13px] text-[#ff6b6b]">{error}</p>}

          <div className="overflow-hidden rounded-[12px]">
            <TableHeader />
            <ul className="flex flex-col">
              {jobs.map((job) => (
                <li key={job.id}>
                  <JobRow job={job} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* drag-and-drop overlay */}
      {dragging && (
        <div className="pointer-events-none absolute inset-3 z-10 flex flex-col items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-[#00dae8] bg-[rgba(0,218,232,0.06)] backdrop-blur-[2px]">
          <svg
            className="h-8 w-8 text-[#00dae8]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 16V4m0 0 4 4m-4-4-4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          <p className="text-[15px] font-medium text-[#edeef0]">
            Drop your song to separate it
          </p>
          <p className="text-[12px] text-[rgba(241,247,254,0.71)]">
            {ACCEPTED_AUDIO_EXT.join(", ")} · max 30 MB
          </p>
        </div>
      )}
    </div>
  );
}

function SearchInput() {
  return (
    <div className="flex h-9 w-[260px] items-center gap-2 rounded-full border border-[rgba(252,252,253,0.1)] bg-[rgba(252,252,253,0.03)] px-3 text-[rgba(241,247,254,0.5)] focus-within:border-[rgba(252,252,253,0.2)]">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="h-4 w-4"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="text"
        placeholder="Search"
        className="w-full bg-transparent text-[13px] text-[#edeef0] outline-none placeholder:text-[rgba(241,247,254,0.5)]"
      />
    </div>
  );
}

function IconButton({
  children,
  ariaLabel,
}: {
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="flex size-9 items-center justify-center rounded-full border border-[rgba(252,252,253,0.1)] text-[rgba(241,247,254,0.71)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-white"
    >
      {children}
    </button>
  );
}

const COL_CLASSES = {
  title: "flex-1 min-w-0 pr-4",
  created: "hidden md:block w-[140px] shrink-0",
  genre: "hidden lg:block w-[100px] shrink-0",
  bpm: "hidden lg:block w-[80px] shrink-0",
  key: "hidden lg:block w-[80px] shrink-0",
  duration: "w-[80px] shrink-0 text-right md:text-left",
};

function TableHeader() {
  return (
    <div className="flex items-center px-4 py-3 text-[12px] uppercase tracking-[1px] text-[rgba(241,247,254,0.5)]">
      <span className={COL_CLASSES.title}>Title</span>
      <span className={COL_CLASSES.created}>
        Created <span className="ml-1 inline-block">↑</span>
      </span>
      <span className={COL_CLASSES.genre}>Genre</span>
      <span className={COL_CLASSES.bpm}>BPM</span>
      <span className={COL_CLASSES.key}>Key</span>
      <span className={COL_CLASSES.duration}>Duration</span>
    </div>
  );
}

function JobRow({ job }: { job: SeparationJob }) {
  const inFlight = job.status === "pending" || job.status === "processing";
  const failed = job.status === "failed";

  const body = (
    <div className="flex items-center rounded-[8px] px-4 py-3 transition-colors hover:bg-[rgba(252,252,253,0.04)]">
      <div className={COL_CLASSES.title}>
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[rgba(0,218,232,0.12)] text-[#00dae8]">
            {inFlight ? (
              <span className="size-3.5 animate-spin rounded-full border-2 border-[rgba(0,218,232,0.25)] border-t-[#00dae8]" />
            ) : failed ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4 w-4 text-[#ff6b6b]"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M9 9l6 6M15 9l-6 6" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4 w-4"
              >
                <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
              </svg>
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] text-[#edeef0]">
              {job.original_name}
            </p>
            <p className="truncate text-[12px] text-[rgba(241,247,254,0.5)]">
              {inFlight
                ? "Separating stems…"
                : failed
                ? (job.error ?? "Separation failed.")
                : "Ready"}
            </p>
          </div>
        </div>
      </div>
      <span className={`${COL_CLASSES.created} text-[13px] text-[rgba(241,247,254,0.71)]`}>
        {formatCreated(job.created_at)}
      </span>
      <span className={`${COL_CLASSES.genre} text-[13px] text-[rgba(241,247,254,0.5)]`}>
        {HEADER_DASH}
      </span>
      <span className={`${COL_CLASSES.bpm} text-[13px] text-[rgba(241,247,254,0.5)]`}>
        {HEADER_DASH}
      </span>
      <span className={`${COL_CLASSES.key} text-[13px] text-[rgba(241,247,254,0.5)]`}>
        {HEADER_DASH}
      </span>
      <span className={`${COL_CLASSES.duration} text-[13px] text-[rgba(241,247,254,0.71)]`}>
        {formatDuration(job.duration_seconds)}
      </span>
    </div>
  );

  if (job.status === "completed") {
    const href = `/track/${job.id}`;
    return <PrefetchLink href={href}>{body}</PrefetchLink>;
  }
  return body;
}

/**
 * Link with eager hover prefetch — fires Next's router.prefetch on mouseenter
 * so the dynamic /track/[id] page (and its signed-URL fetching) is warm by
 * click time. Default Link.prefetch only prefetches the loading shell for
 * dynamic routes; this is more aggressive.
 */
function PrefetchLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onMouseEnter={() => router.prefetch(href)}
      onFocus={() => router.prefetch(href)}
    >
      {children}
    </Link>
  );
}
