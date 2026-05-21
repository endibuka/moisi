"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildCoverArtPrompt, generateImage } from "@/lib/gemini";

type Result =
  | { ok: true; path: string; signedUrl: string }
  | { error: string };

/**
 * Generate cover art for one of the user's library jobs using Gemini, then
 * persist the image to Supabase Storage and link it back to the row.
 *
 * Storage path: `stems/{user_id}/{job_id}/cover-art-{timestamp}.png`. Same
 * `stems` bucket as audio output — keeps RLS policies + signing logic
 * consistent.
 */
export async function generateCoverArt(
  jobId: string,
  userPrompt: string | null,
): Promise<Result> {
  // Verify the user owns the job (RLS would also catch this, but we want a
  // clean error response, not a silent empty update).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are not signed in." };

  const { data: job, error: jobError } = await supabase
    .from("separation_jobs")
    .select("id, original_name, user_id")
    .eq("id", jobId)
    .maybeSingle();
  if (jobError || !job) return { error: "Track not found." };
  if (job.user_id !== user.id) return { error: "Not your track." };

  // Call Gemini.
  let bytes: Uint8Array;
  let mimeType: string;
  try {
    const out = await generateImage(
      buildCoverArtPrompt({
        songTitle: job.original_name,
        userPrompt: userPrompt ?? undefined,
      }),
    );
    bytes = out.bytes;
    mimeType = out.mimeType;
  } catch (err) {
    console.error("[cover-art] Gemini failed:", err);
    return {
      error:
        err instanceof Error ? err.message : "Could not generate cover art.",
    };
  }

  // Upload via the service-role client so RLS doesn't block the write.
  const admin = createAdminClient();
  const ext = mimeType === "image/jpeg" ? "jpg" : "png";
  const path = `${job.user_id}/${job.id}/cover-art-${Date.now()}.${ext}`;
  // Supabase Storage's upload accepts Blob in the browser SDK; on the server
  // it accepts Uint8Array directly via the Node Storage client.
  const { error: uploadError } = await admin.storage
    .from("stems")
    .upload(path, bytes, { contentType: mimeType, upsert: true });
  if (uploadError) {
    console.error("[cover-art] storage upload failed:", uploadError);
    return { error: `Could not save cover art: ${uploadError.message}` };
  }

  // Record the path on the job row.
  const { error: updateError } = await admin
    .from("separation_jobs")
    .update({ cover_art_path: path })
    .eq("id", job.id);
  if (updateError) {
    console.error("[cover-art] db update failed:", updateError);
    return { error: `Saved image but couldn't link it: ${updateError.message}` };
  }

  // Return a short-lived signed URL so the UI can show the result immediately.
  const { data: signed, error: signError } = await admin.storage
    .from("stems")
    .createSignedUrl(path, 60 * 60);
  if (signError || !signed) {
    return { error: "Generated, but could not sign a preview URL." };
  }

  return { ok: true, path, signedUrl: signed.signedUrl };
}
