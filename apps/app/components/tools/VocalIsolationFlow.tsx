"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { startVocalIsolation } from "@/app/actions";
import AudioSourcePicker, { type LibraryItem } from "./AudioSourcePicker";
import { createClient } from "@/lib/supabase/client";

/** Reads the audio's duration from a File without uploading it. */
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
    a.onloadedmetadata = () =>
      done(Number.isFinite(a.duration) ? a.duration : null);
    a.onerror = () => done(null);
  });
}

/**
 * Vocal Isolator + Karaoke share this flow — both submit a 2-stem
 * `vocal_isolation` job. Source can be a fresh upload or a track already
 * in the user's library (reuses the existing `input_path`, no re-upload).
 */
export default function VocalIsolationFlow({
  userId,
  library,
  mode,
}: {
  userId: string;
  library: LibraryItem[];
  mode: "vocal" | "karaoke";
}) {
  const supabase = useMemo(() => createClient(), []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ jobId: string } | null>(null);

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
      setSubmitted({ jobId: result.jobId });
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
      setSubmitted({ jobId: result.jobId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit job.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    const copy =
      mode === "vocal"
        ? "Vocal extraction queued — the result lands on your job in ~60 s."
        : "Karaoke version queued — the instrumental lands on your job in ~60 s.";
    return (
      <div className="rounded-[20px] border border-[rgba(252,252,253,0.1)] bg-[rgba(252,252,253,0.03)] p-8">
        <p className="text-[15px] font-medium text-[#fcfcfd]">On its way.</p>
        <p className="mt-1 text-[13px] text-[rgba(252,252,253,0.6)]">{copy}</p>
        <div className="mt-5 flex gap-2">
          <Link
            href={`/track/${submitted.jobId}`}
            className="flex h-9 items-center rounded-full bg-[#00dae8] px-4 text-[13px] font-medium text-[#001316] transition-opacity hover:opacity-90"
          >
            Open job
          </Link>
          <button
            type="button"
            onClick={() => {
              setSubmitted(null);
              setError(null);
            }}
            className="flex h-9 items-center rounded-full border border-[rgba(252,252,253,0.1)] px-4 text-[13px] text-[rgba(252,252,253,0.6)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]"
          >
            Run another
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <AudioSourcePicker
        mode="audio"
        library={library}
        onUpload={onUpload}
        onPickLibrary={onPickLibrary}
        uploading={submitting}
        uploadError={error}
      />
      <p className="mt-6 text-[12px] leading-relaxed text-[rgba(252,252,253,0.5)]">
        Powered by the same Mel-Roformer pipeline as Track Separation — but
        only the vocal / instrumental split runs, so it's roughly 3× faster.
      </p>
    </>
  );
}
