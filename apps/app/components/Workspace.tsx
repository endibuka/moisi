"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DotsThreeVertical,
  DownloadSimple,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react";
import {
  deleteSeparationJob,
  renameSeparationJob,
  startSeparation,
} from "@/app/actions";
import ConfirmModal from "@/components/ConfirmModal";
import {
  ACCEPTED_AUDIO_EXT,
  MAX_UPLOAD_BYTES,
  STEM_LABELS,
  type JobStatus,
  type SeparationJob,
  type StemName,
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

const STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: "completed", label: "Completed" },
  { value: "processing", label: "Processing" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
];

type SortField = "created_at" | "original_name" | "duration_seconds";
type SortDir = "asc" | "desc";
type SortOption = { field: SortField; dir: SortDir; label: string };

const SORT_OPTIONS: SortOption[] = [
  { field: "created_at", dir: "desc", label: "Newest first" },
  { field: "created_at", dir: "asc", label: "Oldest first" },
  { field: "original_name", dir: "asc", label: "Name A → Z" },
  { field: "original_name", dir: "desc", label: "Name Z → A" },
  { field: "duration_seconds", dir: "desc", label: "Duration: long → short" },
  { field: "duration_seconds", dir: "asc", label: "Duration: short → long" },
];

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

  // Map of cover_art_path -> signed URL. Filled lazily as new jobs appear
  // (initial render + realtime updates when a music-gen completion triggers
  // an auto-cover). The JobRow looks up by path; missing = falls back to
  // the default thumbnail icon.
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});

  // Search / filter / sort.
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<JobStatus>>(new Set());
  const [sortIndex, setSortIndex] = useState(0); // index into SORT_OPTIONS

  const sort = SORT_OPTIONS[sortIndex];

  // Derived view — filtered + sorted. Cheap; only re-runs when inputs change.
  const visibleJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = jobs;
    if (q) {
      list = list.filter((j) => j.original_name.toLowerCase().includes(q));
    }
    if (statusFilter.size > 0) {
      list = list.filter((j) => statusFilter.has(j.status));
    }
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sort.field === "created_at") cmp = a.created_at.localeCompare(b.created_at);
      else if (sort.field === "original_name")
        cmp = a.original_name.localeCompare(b.original_name);
      else {
        // duration_seconds: nulls sort last regardless of direction.
        const ad = a.duration_seconds;
        const bd = b.duration_seconds;
        if (ad == null && bd == null) cmp = 0;
        else if (ad == null) return 1;
        else if (bd == null) return -1;
        else cmp = ad - bd;
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [jobs, query, statusFilter, sort.field, sort.dir]);

  const filtersActive = query.length > 0 || statusFilter.size > 0;

  // Sign cover URLs for any new cover_art_path we haven't seen yet. Runs on
  // initial mount and whenever the jobs list changes (e.g. a music-gen job
  // just got its auto-cover via the Inngest watcher).
  useEffect(() => {
    let cancelled = false;
    const newPaths = jobs
      .map((j) => j.cover_art_path)
      .filter((p): p is string => p !== null && !(p in coverUrls));
    if (newPaths.length === 0) return;

    (async () => {
      const entries: [string, string][] = [];
      for (const path of newPaths) {
        const { data } = await supabase.storage
          .from("stems")
          .createSignedUrl(path, 60 * 60);
        if (data?.signedUrl) entries.push([path, data.signedUrl]);
      }
      if (!cancelled && entries.length > 0) {
        setCoverUrls((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobs, coverUrls, supabase]);

  // Live job status updates.
  useEffect(() => {
    const channel = supabase
      .channel(`separation_jobs:${Math.random().toString(36).slice(2, 10)}`)
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

  const clearFilters = () => {
    setQuery("");
    setStatusFilter(new Set());
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
                {visibleJobs.length} of {jobs.length}{" "}
                {jobs.length === 1 ? "file" : "files"}
              </span>
            </h1>

            <div className="flex items-center gap-2">
              <div className="hidden md:block">
                <SearchInput value={query} onChange={setQuery} />
              </div>
              <FilterDropdown
                statusFilter={statusFilter}
                onChange={setStatusFilter}
              />
              <SortDropdown
                sortIndex={sortIndex}
                onChange={setSortIndex}
              />
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
            {visibleJobs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <p className="text-[14px] text-[#edeef0]">No matches.</p>
                <p className="text-[12px] text-[rgba(241,247,254,0.5)]">
                  Try a different search or clear filters.
                </p>
                {filtersActive && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-2 flex h-8 items-center rounded-full border border-[rgba(252,252,253,0.1)] px-3 text-[12px] text-[rgba(252,252,253,0.6)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <ul className="flex flex-col">
                {visibleJobs.map((job) => (
                  <li key={job.id}>
                    <JobRow
                      job={job}
                      coverUrl={
                        job.cover_art_path
                          ? coverUrls[job.cover_art_path] ?? null
                          : null
                      }
                      onDeleted={(id) =>
                        setJobs((prev) => prev.filter((j) => j.id !== id))
                      }
                      onRenamed={(id, name) =>
                        setJobs((prev) =>
                          prev.map((j) =>
                            j.id === id ? { ...j, original_name: name } : j,
                          ),
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
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

/* ---------- Search ---------- */

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search"
        className="w-full bg-transparent text-[13px] text-[#edeef0] outline-none placeholder:text-[rgba(241,247,254,0.5)]"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[rgba(252,252,253,0.1)] text-[rgba(252,252,253,0.6)] transition-colors hover:bg-[rgba(252,252,253,0.18)] hover:text-[#fcfcfd]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-2.5 w-2.5">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ---------- Filter dropdown ---------- */

function FilterDropdown({
  statusFilter,
  onChange,
}: {
  statusFilter: Set<JobStatus>;
  onChange: (next: Set<JobStatus>) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const toggle = (status: JobStatus) => {
    const next = new Set(statusFilter);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    onChange(next);
  };

  const active = statusFilter.size > 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Filter"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex size-9 items-center justify-center rounded-full border transition-colors ${
          active
            ? "border-[rgba(0,218,232,0.5)] bg-[rgba(0,218,232,0.08)] text-[#00dae8]"
            : "border-[rgba(252,252,253,0.1)] text-[rgba(241,247,254,0.71)] hover:bg-[rgba(252,252,253,0.05)] hover:text-white"
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
          <path d="M4 5h16M7 12h10M10 19h4" />
        </svg>
        {active && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[#00dae8] text-[9px] font-bold text-[#001316]">
            {statusFilter.size}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[44px] z-20 w-[200px] overflow-hidden rounded-[12px] border border-[rgba(252,252,253,0.1)] bg-[#0e0f11] p-1.5 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.6)]"
        >
          <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[1.5px] text-[rgba(252,252,253,0.3)]">
            Status
          </p>
          {STATUS_OPTIONS.map((opt) => {
            const checked = statusFilter.has(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[13px] text-[rgba(252,253,255,0.94)] transition-colors hover:bg-[rgba(252,252,253,0.05)]"
              >
                <span
                  aria-hidden
                  className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
                    checked
                      ? "border-[#00dae8] bg-[#00dae8] text-[#001316]"
                      : "border-[rgba(252,252,253,0.18)] bg-transparent"
                  }`}
                >
                  {checked && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-2.5 w-2.5">
                      <path d="m5 12 5 5L20 7" />
                    </svg>
                  )}
                </span>
                <span className="flex-1">{opt.label}</span>
              </button>
            );
          })}
          {statusFilter.size > 0 && (
            <button
              type="button"
              onClick={() => onChange(new Set())}
              className="mt-1 w-full rounded-[6px] px-2 py-1.5 text-left text-[12px] text-[rgba(252,252,253,0.6)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]"
            >
              Clear status filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Sort dropdown ---------- */

function SortDropdown({
  sortIndex,
  onChange,
}: {
  sortIndex: number;
  onChange: (i: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const customSort = sortIndex !== 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Sort"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex size-9 items-center justify-center rounded-full border transition-colors ${
          customSort
            ? "border-[rgba(0,218,232,0.5)] bg-[rgba(0,218,232,0.08)] text-[#00dae8]"
            : "border-[rgba(252,252,253,0.1)] text-[rgba(241,247,254,0.71)] hover:bg-[rgba(252,252,253,0.05)] hover:text-white"
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
          <path d="M7 4v16M3 8l4-4 4 4M17 20V4M21 16l-4 4-4-4" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[44px] z-20 w-[220px] overflow-hidden rounded-[12px] border border-[rgba(252,252,253,0.1)] bg-[#0e0f11] p-1.5 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.6)]"
        >
          <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[1.5px] text-[rgba(252,252,253,0.3)]">
            Sort by
          </p>
          {SORT_OPTIONS.map((opt, i) => {
            const checked = i === sortIndex;
            return (
              <button
                key={`${opt.field}-${opt.dir}`}
                type="button"
                onClick={() => {
                  onChange(i);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[13px] transition-colors ${
                  checked
                    ? "bg-[rgba(0,218,232,0.08)] text-[#00dae8]"
                    : "text-[rgba(252,253,255,0.94)] hover:bg-[rgba(252,252,253,0.05)]"
                }`}
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {checked && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3 w-3">
                      <path d="m5 12 5 5L20 7" />
                    </svg>
                  )}
                </span>
                <span className="flex-1">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Table ---------- */

const COL_CLASSES = {
  title: "flex-1 min-w-0 pr-4",
  created: "hidden md:block w-[140px] shrink-0",
  duration: "w-[80px] shrink-0",
  actions: "w-[44px] shrink-0 flex justify-end",
};

function TableHeader() {
  return (
    <div className="flex items-center px-4 py-3 text-[12px] uppercase tracking-[1px] text-[rgba(241,247,254,0.5)]">
      <span className={COL_CLASSES.title}>Title</span>
      <span className={COL_CLASSES.created}>Created</span>
      <span className={COL_CLASSES.duration}>Duration</span>
      <span className={COL_CLASSES.actions} aria-hidden></span>
    </div>
  );
}

function JobRow({
  job,
  coverUrl,
  onDeleted,
  onRenamed,
}: {
  job: SeparationJob;
  coverUrl: string | null;
  onDeleted: (id: string) => void;
  onRenamed: (id: string, name: string) => void;
}) {
  const inFlight = job.status === "pending" || job.status === "processing";
  const failed = job.status === "failed";
  // Cover only shows when the job is completed AND its AI art is signed —
  // an in-flight/failed cell stays as the status indicator so the user
  // doesn't lose the visual cue.
  const showCover = !inFlight && !failed && Boolean(coverUrl);

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(job.original_name);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => {
    setDraftName(job.original_name);
    setEditing(true);
  };
  const commitEdit = async () => {
    const next = draftName.trim();
    setEditing(false);
    if (!next || next === job.original_name) return;
    onRenamed(job.id, next);
    const r = await renameSeparationJob(job.id, next);
    if ("error" in r) setActionError(r.error);
  };
  const cancelEdit = () => {
    setDraftName(job.original_name);
    setEditing(false);
  };

  const confirmDelete = async () => {
    setConfirmOpen(false);
    onDeleted(job.id);
    const r = await deleteSeparationJob(job.id);
    if ("error" in r) setActionError(r.error);
  };

  const body = (
    <div
      className={`group/row relative flex flex-col rounded-[8px] px-4 py-3 transition-colors ${
        editing
          ? "bg-[rgba(252,252,253,0.04)]"
          : "hover:bg-[rgba(252,252,253,0.04)]"
      }`}
    >
      <div className="flex items-center">
        <div className={COL_CLASSES.title}>
          <div className="flex items-center gap-3">
            {showCover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl ?? undefined}
                alt=""
                aria-hidden
                className="size-9 shrink-0 rounded-[8px] object-cover"
              />
            ) : (
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
            )}
            <div className="min-w-0 flex-1">
              {editing ? (
                <input
                  ref={titleInputRef}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void commitEdit();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelEdit();
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  maxLength={80}
                  className="w-full bg-transparent text-[14px] text-[#edeef0] outline-none"
                />
              ) : (
                <p className="truncate text-[14px] text-[#edeef0]">
                  {job.original_name}
                </p>
              )}
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
        <span
          className={`${COL_CLASSES.created} text-[13px] text-[rgba(241,247,254,0.71)]`}
        >
          {formatCreated(job.created_at)}
        </span>
        <span
          className={`${COL_CLASSES.duration} text-[13px] text-[rgba(241,247,254,0.71)]`}
        >
          {formatDuration(job.duration_seconds)}
        </span>
        <div className={COL_CLASSES.actions}>
          <JobActionsMenu
            job={job}
            onRename={startEdit}
            onDelete={() => setConfirmOpen(true)}
          />
        </div>
      </div>
      {actionError && (
        <p className="mt-2 pl-12 text-[11.5px] text-[#ff8888]">{actionError}</p>
      )}
      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Delete this track?"
        description={
          <>
            This will permanently remove the track, its stems, and any cover
            art.
            <br />
            <span className="text-[rgba(252,252,253,0.85)]">
              {job.original_name}
            </span>
          </>
        }
        confirmLabel="Delete"
        destructive
      />
    </div>
  );

  if (job.status === "completed" && !editing) {
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

/* ---------- Job actions (3-dots) ---------- */

/**
 * Per-row actions menu: Rename · Download (with stem submenu) · Delete.
 * Click captures stopPropagation so the row's Link parent doesn't navigate.
 */
function JobActionsMenu({
  job,
  onRename,
  onDelete,
}: {
  job: SeparationJob;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setDownloadOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setDownloadOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const stemEntries = useMemo(() => {
    const out: { name: StemName; path: string }[] = [];
    if (!job.stems) return out;
    for (const [k, v] of Object.entries(job.stems)) {
      if (v) out.push({ name: k as StemName, path: v });
    }
    return out;
  }, [job.stems]);

  const canDownload = job.status === "completed" && stemEntries.length > 0;

  const downloadStem = async (path: string, label: string) => {
    const { data } = await supabase.storage
      .from("stems")
      .createSignedUrl(path, 60 * 60, {
        download: `${job.original_name.replace(/\.[^.]+$/, "")} - ${label}.mp3`,
      });
    if (data?.signedUrl) {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.rel = "noopener";
      a.click();
    }
  };

  const downloadAllZip = async () => {
    setBusy(true);
    try {
      // Sign every stem in one Storage round-trip, then fetch and zip
      // client-side. JSZip is loaded lazily so the library page bundle stays
      // lean for users who never trigger this action.
      const paths = stemEntries.map((s) => s.path);
      const { data: signed } = await supabase.storage
        .from("stems")
        .createSignedUrls(paths, 60 * 60);
      if (!signed) return;

      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const base = job.original_name.replace(/\.[^.]+$/, "");
      await Promise.all(
        signed.map(async (row, idx) => {
          if (!row.signedUrl) return;
          const stem = stemEntries[idx];
          const res = await fetch(row.signedUrl);
          if (!res.ok) return;
          const blob = await res.blob();
          zip.file(`${STEM_LABELS[stem.name] ?? stem.name}.mp3`, blob);
        }),
      );
      const out = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${base} - stems.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
      setDownloadOpen(false);
      setOpen(false);
    }
  };

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      className="relative"
    >
      <button
        type="button"
        aria-label="Track actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
          setDownloadOpen(false);
        }}
        className={`flex size-8 items-center justify-center rounded-full text-[rgba(252,252,253,0.55)] transition-colors hover:bg-[rgba(252,252,253,0.06)] hover:text-[#fcfcfd] ${
          open ? "bg-[rgba(252,252,253,0.06)] text-[#fcfcfd]" : ""
        }`}
      >
        <DotsThreeVertical weight="bold" className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-[10px] border border-[#212225] bg-[#1a1b1e] py-1 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5)]"
        >
          <ActionsMenuItem
            onClick={() => {
              setOpen(false);
              onRename();
            }}
            icon={<PencilSimple weight="fill" className="h-3.5 w-3.5" />}
            label="Rename"
          />
          {canDownload && (
            <div className="relative">
              <button
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={downloadOpen}
                onClick={() => setDownloadOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[13px] text-[rgba(241,247,254,0.85)] transition-colors hover:bg-[rgba(221,234,248,0.06)] hover:text-white"
              >
                <span className="flex items-center gap-2">
                  <DownloadSimple weight="fill" className="h-3.5 w-3.5" />
                  Download
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-3 w-3 text-[rgba(241,247,254,0.5)]"
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
              {downloadOpen && (
                <div
                  role="menu"
                  className="absolute right-full top-0 mr-1 w-48 overflow-hidden rounded-[10px] border border-[#212225] bg-[#1a1b1e] py-1 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5)]"
                >
                  <ActionsMenuItem
                    onClick={() => void downloadAllZip()}
                    label={busy ? "Zipping…" : "All stems (.zip)"}
                    disabled={busy}
                  />
                  <div className="my-1 h-px bg-[rgba(252,253,255,0.06)]" />
                  {stemEntries.map((stem) => (
                    <ActionsMenuItem
                      key={stem.name}
                      onClick={() => {
                        void downloadStem(
                          stem.path,
                          STEM_LABELS[stem.name] ?? stem.name,
                        );
                        setDownloadOpen(false);
                        setOpen(false);
                      }}
                      label={STEM_LABELS[stem.name] ?? stem.name}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          <ActionsMenuItem
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            icon={<Trash weight="fill" className="h-3.5 w-3.5" />}
            label="Delete"
            destructive
          />
        </div>
      )}
    </div>
  );
}

function ActionsMenuItem({
  onClick,
  icon,
  label,
  destructive,
  disabled,
}: {
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors disabled:opacity-50 ${
        destructive
          ? "text-[#ff8a8a] hover:bg-[rgba(255,93,93,0.10)] hover:text-[#ffaeae]"
          : "text-[rgba(241,247,254,0.85)] hover:bg-[rgba(221,234,248,0.06)] hover:text-white"
      }`}
    >
      {icon ?? <span className="size-3.5 shrink-0" />}
      {label}
    </button>
  );
}
