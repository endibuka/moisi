"use server";

import { startRunpodSeparation } from "@/lib/runpod";
import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";

type StartResult = { jobId?: string; error?: string };

/**
 * Creates a separation job for an already-uploaded file and queues it on
 * RunPod. `inputPath` is the path in the `uploads` storage bucket
 * (the browser uploads the file directly before calling this).
 */
export async function startSeparation(
  inputPath: string,
  originalName: string,
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
      data: { jobId: job.id, runpodId },
    });

    return { jobId: job.id };
  } catch (err) {
    console.error("RunPod start failed:", err);
    return fail("Could not start the GPU separation job.");
  }
}
