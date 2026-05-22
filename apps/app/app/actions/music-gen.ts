"use server";

import { inngest } from "@/lib/inngest/client";
import { startRunpodMusicGen } from "@/lib/runpod";
import { createClient } from "@/lib/supabase/server";

type Result = { jobId?: string; error?: string };

/**
 * Queue a YuE music-generation job. Reuses `separation_jobs` with
 * job_type='music_generation' so the Inngest watcher + dashboard pick it up
 * unchanged. The generated track lands at
 * `stems/{user_id}/{job_id}/generated.mp3`.
 *
 * - `genre`   — style description (required). Stored in the `prompt` column.
 * - `lyrics`  — structured lyrics with [verse]/[chorus] markers (optional).
 *               Stored in the new `lyrics` column. Empty => instrumental.
 * - `nSegments` — how many ~30 s segments to generate (1-6).
 */
export async function generateMusic(input: {
  genre: string;
  lyrics?: string;
  nSegments?: number;
  title?: string;
}): Promise<Result> {
  const genre = input.genre.trim();
  const lyrics = (input.lyrics ?? "").trim();
  const nSegments = Math.max(1, Math.min(6, Math.round(input.nSegments ?? 2)));

  if (genre.length < 4) return { error: "Style / genre prompt is too short." };
  if (genre.length > 500) return { error: "Style / genre prompt is too long (max 500)." };
  if (lyrics.length > 4000) return { error: "Lyrics too long (max 4000 chars)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are not signed in." };

  // Display name: user-supplied title, else first line of lyrics, else
  // the first ~60 chars of the genre prompt.
  const lyricTitle = lyrics
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("["));
  const fallbackTitle = genre.length > 60 ? `${genre.slice(0, 57).trim()}…` : genre;
  const displayName =
    (input.title?.trim() && input.title.trim().slice(0, 80)) ||
    (lyricTitle && lyricTitle.slice(0, 80)) ||
    fallbackTitle;

  // YuE songs are ~30 s per segment; record an approximate duration so the
  // library / row UI has a number to show before generation finishes.
  const approxDurationSeconds = nSegments * 30;

  const { data: job, error: insertError } = await supabase
    .from("separation_jobs")
    .insert({
      user_id: user.id,
      original_name: displayName,
      input_path: `musicgen/${user.id}/${crypto.randomUUID()}`,
      job_type: "music_generation",
      prompt: genre,
      lyrics: lyrics || null,
      duration_seconds: approxDurationSeconds,
    })
    .select("id")
    .single();
  if (insertError || !job) {
    return { error: insertError?.message ?? "Could not create the job." };
  }

  const fail = async (message: string) => {
    await supabase
      .from("separation_jobs")
      .update({ status: "failed", error: message })
      .eq("id", job.id);
    return { error: message };
  };

  try {
    const runpodId = await startRunpodMusicGen({
      genre,
      lyrics,
      n_segments: nSegments,
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

    await inngest.send({
      name: "app/separation.queued",
      data: { jobId: job.id, runpodId, endpointKind: "music_gen" },
    });

    return { jobId: job.id };
  } catch (err) {
    console.error("YuE RunPod start failed:", err);
    return fail(
      err instanceof Error
        ? err.message
        : "Could not start the music generation job.",
    );
  }
}

const MAX_NAME_LEN = 80;

/** Rename a generated track. RLS already restricts updates to the owner. */
export async function renameMusicJob(
  jobId: string,
  newName: string,
): Promise<{ ok: true } | { error: string }> {
  const name = newName.trim().slice(0, MAX_NAME_LEN);
  if (!name) return { error: "Name cannot be empty." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are not signed in." };

  const { error } = await supabase
    .from("separation_jobs")
    .update({ original_name: name })
    .eq("id", jobId);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Delete a generated track. We remove the job row first (RLS-scoped) and
 * then best-effort clean up the generated mp3 + cover art from Storage. If
 * the row delete fails we bail; if the storage cleanup fails we still
 * succeed so the user isn't stuck with a phantom row.
 */
export async function deleteMusicJob(
  jobId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are not signed in." };

  const { data: job } = await supabase
    .from("separation_jobs")
    .select("stems, cover_art_path")
    .eq("id", jobId)
    .maybeSingle();

  const paths: string[] = [];
  const stems = (job?.stems ?? null) as { audio?: string } | null;
  if (stems?.audio) paths.push(stems.audio);
  if (job?.cover_art_path) paths.push(job.cover_art_path as string);

  const { error: deleteError } = await supabase
    .from("separation_jobs")
    .delete()
    .eq("id", jobId);
  if (deleteError) return { error: deleteError.message };

  if (paths.length > 0) {
    await supabase.storage.from("stems").remove(paths);
  }
  return { ok: true };
}
