"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { startSeparation } from "@/app/actions";
import {
  ACCEPTED_AUDIO_EXT,
  MAX_UPLOAD_BYTES,
  type SeparationJob,
} from "@/lib/separation";
import { createClient } from "@/lib/supabase/client";
import StemMixer from "./StemMixer";
import UploadEmptyState from "./UploadEmptyState";

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
  const fileInput = useRef<HTMLInputElement>(null);

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

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

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
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${userId}/${crypto.randomUUID()}/${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(path, file, { contentType: file.type || undefined });
      if (uploadError) throw new Error(uploadError.message);

      const result = await startSeparation(path, file.name);
      if (result.error) throw new Error(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const hiddenInput = (
    <input
      ref={fileInput}
      type="file"
      accept={ACCEPTED_AUDIO_EXT.join(",")}
      onChange={handleFile}
      className="hidden"
    />
  );

  if (jobs.length === 0) {
    return (
      <div className="h-full">
        {hiddenInput}
        <UploadEmptyState onUpload={pickFile} uploading={uploading} />
        {error && (
          <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[13px] text-[#ff6b6b]">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[720px] px-6 py-10">
      {hiddenInput}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[22px] text-[rgba(252,253,255,0.94)]">Library</h1>
        <button
          type="button"
          onClick={pickFile}
          disabled={uploading}
          className="flex h-9 items-center gap-2 rounded-[8px] bg-[#00dae8] px-4 text-[13px] font-medium text-[#001316] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload song"}
        </button>
      </div>

      {error && (
        <p className="mb-4 text-[13px] text-[#ff6b6b]">{error}</p>
      )}

      <div className="flex flex-col gap-3">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}

function JobCard({ job }: { job: SeparationJob }) {
  return (
    <div className="rounded-[12px] border border-[#212225] bg-[#111113] p-4">
      <div className="flex items-center gap-3">
        <span className="truncate text-[14px] text-[#edeef0]">
          {job.original_name}
        </span>
        <StatusBadge status={job.status} />
      </div>

      {(job.status === "pending" || job.status === "processing") && (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-[rgba(241,247,254,0.71)]">
          <span className="size-3.5 animate-spin rounded-full border-2 border-[rgba(241,247,254,0.2)] border-t-[#00dae8]" />
          Separating stems… this can take a minute.
        </p>
      )}

      {job.status === "failed" && (
        <p className="mt-3 text-[13px] text-[#ff6b6b]">
          {job.error ?? "Separation failed."}
        </p>
      )}

      {job.status === "completed" && job.stems && (
        <div className="mt-4">
          <StemMixer stems={job.stems} />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: SeparationJob["status"] }) {
  const styles: Record<SeparationJob["status"], string> = {
    pending: "bg-[rgba(222,238,255,0.08)] text-[rgba(241,247,255,0.71)]",
    processing: "bg-[rgba(222,238,255,0.08)] text-[rgba(241,247,255,0.71)]",
    completed: "bg-[rgba(10,255,167,0.12)] text-[#0affa7]",
    failed: "bg-[rgba(255,107,107,0.12)] text-[#ff6b6b]",
  };
  return (
    <span
      className={`ml-auto shrink-0 rounded-[4px] px-2 py-0.5 text-[11px] capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}
