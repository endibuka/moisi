import "server-only";

import { inngest } from "@/lib/inngest/client";
import { startRunpodSeparation } from "@/lib/runpod";
import { createAdminClient } from "@/lib/supabase/admin";

// Music generation has its own RunPod endpoint + flow — only the two
// audio-in-audio-out job types share this service.
type StemSplitJobType = "separation" | "vocal_isolation";

/**
 * Shared "start a separation job" logic, factored out of the cookie-auth
 * server action in app/actions.ts so the public /api/v1/* surface can reuse
 * it without going through Next.js Server Actions (which require cookies).
 *
 * Takes `userId` explicitly — caller is responsible for authenticating
 * (either via session cookie or API key) before invoking this.
 *
 * Uses the service-role client so it works regardless of how the caller
 * authenticated. RLS is enforced implicitly by passing the verified userId
 * into every write.
 */
export async function startSeparationForUser(args: {
  userId: string;
  inputPath: string;
  originalName: string;
  durationSeconds: number | null;
  jobType?: StemSplitJobType;
}): Promise<{ jobId: string } | { error: string }> {
  const {
    userId,
    inputPath,
    originalName,
    durationSeconds,
    jobType = "separation",
  } = args;

  // Defence-in-depth: the upload must live in the caller's own folder. This
  // matches the server action's check and prevents a key holder from
  // referencing someone else's storage path.
  if (!inputPath.startsWith(`${userId}/`)) {
    return { error: "Invalid upload path." };
  }

  const admin = createAdminClient();

  const { data: job, error: insertError } = await admin
    .from("separation_jobs")
    .insert({
      user_id: userId,
      original_name: originalName,
      input_path: inputPath,
      duration_seconds: durationSeconds,
      job_type: jobType,
    })
    .select("id")
    .single<{ id: string }>();
  if (insertError || !job) {
    console.error("[separation-service] insert error:", insertError);
    return { error: "Could not create the separation job." };
  }

  const fail = async (message: string) => {
    await admin
      .from("separation_jobs")
      .update({ status: "failed", error: message })
      .eq("id", job.id);
    return { error: message };
  };

  const { data: signed } = await admin.storage
    .from("uploads")
    .createSignedUrl(inputPath, 60 * 60);
  if (!signed) return fail("Could not prepare the audio file.");

  try {
    const runpodId = await startRunpodSeparation({
      audio_url: signed.signedUrl,
      output_prefix: `${userId}/${job.id}`,
      job_id: job.id,
      job_type: jobType,
    });

    await admin
      .from("separation_jobs")
      .update({
        status: "processing",
        runpod_id: runpodId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    await inngest.send({
      name: "app/separation.queued",
      data: { jobId: job.id, runpodId },
    });

    return { jobId: job.id };
  } catch (err) {
    console.error("[separation-service] RunPod start failed:", err);
    return fail("Could not start the GPU separation job.");
  }
}
