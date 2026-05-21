import "server-only";

import { buildCoverArtPrompt, generateImage } from "@/lib/gemini";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cover-art generation factored out of the cookie-auth server action in
 * app/actions/cover-art.ts so /api/v1/cover-art can reuse it. Takes the
 * verified `userId` explicitly and uses the service-role client throughout.
 *
 * Stores the image to the same `stems` bucket as audio output and links
 * the path on the parent `separation_jobs` row (`cover_art_path`).
 */
export type CoverArtResult =
  | { ok: true; path: string; signedUrl: string }
  | { error: string; status?: number };

export async function generateCoverArtForUser(args: {
  userId: string;
  jobId: string;
  userPrompt?: string | null;
}): Promise<CoverArtResult> {
  const admin = createAdminClient();

  const { data: job, error: jobError } = await admin
    .from("separation_jobs")
    .select("id, original_name, user_id")
    .eq("id", args.jobId)
    .maybeSingle<{ id: string; original_name: string; user_id: string }>();
  if (jobError) {
    console.error("[cover-art-service] job lookup error:", jobError);
    return { error: "Could not load the job.", status: 500 };
  }
  if (!job) return { error: "Track not found.", status: 404 };
  // Key-auth bypasses RLS; enforce ownership here.
  if (job.user_id !== args.userId) {
    return { error: "Track not found.", status: 404 };
  }

  let bytes: Uint8Array;
  let mimeType: string;
  try {
    const out = await generateImage(
      buildCoverArtPrompt({
        songTitle: job.original_name,
        userPrompt: args.userPrompt?.trim() || undefined,
      }),
    );
    bytes = out.bytes;
    mimeType = out.mimeType;
  } catch (err) {
    console.error("[cover-art-service] Gemini failed:", err);
    return {
      error:
        err instanceof Error ? err.message : "Could not generate cover art.",
      status: 502,
    };
  }

  const ext = mimeType === "image/jpeg" ? "jpg" : "png";
  const path = `${job.user_id}/${job.id}/cover-art-${Date.now()}.${ext}`;
  const { error: uploadError } = await admin.storage
    .from("stems")
    .upload(path, bytes, { contentType: mimeType, upsert: true });
  if (uploadError) {
    console.error("[cover-art-service] storage upload failed:", uploadError);
    return {
      error: `Could not save cover art: ${uploadError.message}`,
      status: 500,
    };
  }

  const { error: updateError } = await admin
    .from("separation_jobs")
    .update({ cover_art_path: path })
    .eq("id", job.id);
  if (updateError) {
    console.error("[cover-art-service] db update failed:", updateError);
    return {
      error: `Saved image but couldn't link it: ${updateError.message}`,
      status: 500,
    };
  }

  const { data: signed, error: signError } = await admin.storage
    .from("stems")
    .createSignedUrl(path, 60 * 60);
  if (signError || !signed) {
    return {
      error: "Generated, but could not sign a preview URL.",
      status: 500,
    };
  }

  return { ok: true, path, signedUrl: signed.signedUrl };
}
