"use server";

import { startRunpodSeparation } from "@/lib/runpod";
import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";
import type { StemName } from "@/lib/separation";

// Mirror of separation-service: music_generation has its own flow.
type StemSplitJobType = "separation" | "vocal_isolation";

type StartResult = { jobId?: string; error?: string };

/**
 * Persist client-computed waveform peaks back to the job row so subsequent
 * page loads can render WaveSurfer instantly without re-fetching audio.
 *
 * Peaks shape: { [stem]: number[][] } — one number[] per audio channel.
 */
export async function saveWaveformPeaks(
  jobId: string,
  peaks: Partial<Record<StemName, number[][]>>,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // RLS already restricts updates to the owner; the update is a no-op for
  // anyone else.
  const { error } = await supabase
    .from("separation_jobs")
    .update({ waveform_peaks: peaks })
    .eq("id", jobId);
  if (error) {
    console.error("[waveform] saveWaveformPeaks error:", error);
    return { error: error.message };
  }
  return { ok: true };
}

/**
 * Creates a separation job for an already-uploaded file and queues it on
 * RunPod. `inputPath` is the path in the `uploads` storage bucket
 * (the browser uploads the file directly before calling this).
 */
export async function startSeparation(
  inputPath: string,
  originalName: string,
  durationSeconds: number | null = null,
  jobType: StemSplitJobType = "separation",
): Promise<StartResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are not signed in." };

  // The uploaded file must live in the caller's own folder.
  if (!inputPath.startsWith(`${user.id}/`)) {
    return { error: "Invalid upload path." };
  }

  const { data: job, error: insertError } = await supabase
    .from("separation_jobs")
    .insert({
      user_id: user.id,
      original_name: originalName,
      input_path: inputPath,
      duration_seconds: durationSeconds,
      job_type: jobType,
    })
    .select("id")
    .single();
  if (insertError || !job) {
    return { error: "Could not create the separation job." };
  }

  const fail = async (message: string) => {
    await supabase
      .from("separation_jobs")
      .update({ status: "failed", error: message })
      .eq("id", job.id);
    return { error: message };
  };

  // Signed URL the GPU worker uses to download the original audio.
  const { data: signed } = await supabase.storage
    .from("uploads")
    .createSignedUrl(inputPath, 60 * 60);
  if (!signed) return fail("Could not prepare the audio file.");

  try {
    const runpodId = await startRunpodSeparation({
      audio_url: signed.signedUrl,
      output_prefix: `${user.id}/${job.id}`,
      job_id: job.id,
      job_type: jobType,
    });

    await supabase
      .from("separation_jobs")
      .update({
        status: "processing",
        runpod_id: runpodId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    // Kick off the per-job watcher. Inngest will poll RunPod until the job
    // reaches a terminal state and write the row; the webhook is now a
    // best-effort fast path, not the single point of failure.
    await inngest.send({
      name: "app/separation.queued",
      data: { jobId: job.id, runpodId, endpointKind: "separation" },
    });

    return { jobId: job.id };
  } catch (err) {
    console.error("RunPod start failed:", err);
    return fail("Could not start the GPU separation job.");
  }
}

/**
 * Vocal Isolator + Karaoke share the same 2-stem fast path. Thin wrapper so
 * the calling UIs don't need to know about the underlying job_type plumbing.
 */
export async function startVocalIsolation(
  inputPath: string,
  originalName: string,
  durationSeconds: number | null = null,
): Promise<StartResult> {
  return startSeparation(
    inputPath,
    originalName,
    durationSeconds,
    "vocal_isolation",
  );
}
