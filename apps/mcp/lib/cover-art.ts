import { buildCoverArtPrompt, generateImage } from "./gemini";
import { createAdminClient } from "./supabase";

/**
 * Cover-art generation for the MCP server. Two modes:
 *
 *   - `libraryJobId` set → cover gets attached to that track (same path as
 *     the in-app Cover Art tool; updates `separation_jobs.cover_art_path`).
 *   - `libraryJobId` null → standalone "concept" cover stored at
 *     `{userId}/muse-covers/cover-art-*.png`, not linked to any row.
 *
 * Service-role Supabase client throughout; we filter by userId manually
 * because RLS is bypassed.
 */
export type CoverArtResult =
  | { ok: true; path: string; signedUrl: string; title: string }
  | { error: string };

export async function generateCoverArt(args: {
  userId: string;
  prompt: string;
  title?: string | null;
  libraryJobId?: string | null;
}): Promise<CoverArtResult> {
  const prompt = (args.prompt ?? "").trim();
  if (prompt.length < 3) return { error: "Prompt is too short." };
  if (prompt.length > 1000) return { error: "Prompt is too long (max 1000)." };

  const admin = createAdminClient();

  let title = (args.title ?? "").trim();
  let storageFolder: string;
  let jobToLink: string | null = null;

  if (args.libraryJobId) {
    const { data: job, error: jobErr } = await admin
      .from("separation_jobs")
      .select("id, original_name, user_id")
      .eq("id", args.libraryJobId)
      .maybeSingle<{ id: string; original_name: string; user_id: string }>();
    if (jobErr) return { error: jobErr.message };
    if (!job) return { error: "Track not found." };
    if (job.user_id !== args.userId) return { error: "Track not found." };
    if (!title) title = job.original_name ?? "Cover Art";
    storageFolder = `${args.userId}/${job.id}`;
    jobToLink = job.id;
  } else {
    if (!title) title = "Cover Art";
    storageFolder = `${args.userId}/muse-covers`;
  }

  let bytes: Uint8Array;
  let mimeType: string;
  try {
    const out = await generateImage(
      buildCoverArtPrompt({ songTitle: title, userPrompt: prompt }),
    );
    bytes = out.bytes;
    mimeType = out.mimeType;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gemini call failed.",
    };
  }

  const ext = mimeType === "image/jpeg" ? "jpg" : "png";
  const path = `${storageFolder}/cover-art-${Date.now()}.${ext}`;
  const { error: uploadError } = await admin.storage
    .from("stems")
    .upload(path, bytes, { contentType: mimeType, upsert: true });
  if (uploadError) {
    return { error: `Could not save cover art: ${uploadError.message}` };
  }

  if (jobToLink) {
    await admin
      .from("separation_jobs")
      .update({ cover_art_path: path })
      .eq("id", jobToLink);
  }

  const { data: signed } = await admin.storage
    .from("stems")
    .createSignedUrl(path, 60 * 60 * 24);
  if (!signed) {
    return { error: "Generated, but could not sign a preview URL." };
  }

  return { ok: true, path, signedUrl: signed.signedUrl, title };
}
