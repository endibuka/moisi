"use server";

import { buildCoverArtPrompt, generateImage } from "@/lib/gemini";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type MuseLibraryItem = {
  id: string;
  title: string;
  jobType: "separation" | "vocal_isolation" | "music_generation";
  coverArtPath: string | null;
  createdAt: string;
};

/**
 * List the signed-in user's recent library items so the cover-art agent can
 * offer them as targets when the user says "make a cover for that lo-fi
 * track" without naming a specific id. Capped at the 20 most-recent rows —
 * the agent fuzzy-matches by title from there.
 */
export async function museListLibrary(): Promise<
  { items: MuseLibraryItem[] } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are not signed in." };

  const { data, error } = await supabase
    .from("separation_jobs")
    .select("id, original_name, job_type, cover_art_path, created_at, status")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return { error: error.message };

  const items: MuseLibraryItem[] = (data ?? [])
    .filter((row) => row.status !== "failed")
    .map((row) => ({
      id: row.id as string,
      title: (row.original_name as string) ?? "Untitled",
      jobType: row.job_type as MuseLibraryItem["jobType"],
      coverArtPath: (row.cover_art_path as string | null) ?? null,
      createdAt: row.created_at as string,
    }));

  return { items };
}

type CreateInput = {
  /** Style / mood direction for Gemini. */
  prompt: string;
  /** Display title shown on the card. Falls back to the linked job's name or "Cover Art". */
  title?: string | null;
  /** When set, the generated image gets linked back to that job's `cover_art_path`. */
  libraryJobId?: string | null;
};

type CreateResult =
  | { ok: true; signedUrl: string; path: string; title: string; libraryJobId?: string }
  | { error: string };

/**
 * Generate a cover with Gemini and store it in the `stems` bucket.
 *
 * Two flavors:
 *   - With `libraryJobId`: links the new image to that job (same as the
 *     dedicated Cover Art tool — appears on the track row).
 *   - Without: standalone "muse cover" at `{userId}/muse-covers/{uuid}.png`.
 *     Useful when the user wants concept art that isn't tied to a track yet.
 */
export async function museCreateCoverArt(
  input: CreateInput,
): Promise<CreateResult> {
  const prompt = (input.prompt ?? "").trim();
  if (prompt.length < 3) return { error: "Prompt is too short." };
  if (prompt.length > 1000) return { error: "Prompt is too long (max 1000)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are not signed in." };

  // Resolve title + storage path. Linked covers go under the job's folder so
  // they stay co-located with audio output; standalone covers live under a
  // per-user `muse-covers/` prefix.
  let title = (input.title ?? "").trim();
  let storageFolder: string;
  let jobToLink: string | null = null;

  if (input.libraryJobId) {
    const { data: job, error: jobErr } = await supabase
      .from("separation_jobs")
      .select("id, original_name, user_id")
      .eq("id", input.libraryJobId)
      .maybeSingle();
    if (jobErr || !job) return { error: "Track not found." };
    if (job.user_id !== user.id) return { error: "Not your track." };
    if (!title) title = (job.original_name as string) ?? "Cover Art";
    storageFolder = `${user.id}/${job.id}`;
    jobToLink = job.id as string;
  } else {
    if (!title) title = "Cover Art";
    storageFolder = `${user.id}/muse-covers`;
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
    console.error("[muse-cover] Gemini failed:", err);
    return {
      error: err instanceof Error ? err.message : "Could not generate cover art.",
    };
  }

  // Persist + link via the service-role client. Wrapped so a misconfigured
  // server (e.g. missing SUPABASE_SERVICE_ROLE_KEY) surfaces as a tool error
  // the agent can relay, not an uncaught 500.
  try {
    const admin = createAdminClient();
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
      .createSignedUrl(path, 60 * 60 * 24); // 24h — chat history may reload
    if (!signed) {
      return { error: "Generated, but could not sign a preview URL." };
    }

    return {
      ok: true,
      signedUrl: signed.signedUrl,
      path,
      title,
      libraryJobId: jobToLink ?? undefined,
    };
  } catch (err) {
    console.error("[muse-cover] save step threw:", err);
    return {
      error: err instanceof Error ? err.message : "Could not save cover art.",
    };
  }
}
