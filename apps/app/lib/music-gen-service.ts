import "server-only";

import { inngest } from "@/lib/inngest/client";
import { startRunpodMusicGen } from "@/lib/runpod";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Music-generation flow, factored out of the cookie-auth server action in
 * app/actions/music-gen.ts so /api/v1/songs can reuse it without going
 * through Next.js Server Actions (which require cookies).
 *
 * Stores the job in the same `separation_jobs` table as track-separation
 * jobs (with `job_type = "music_generation"`), so the same Inngest watcher
 * and library UI pick it up unchanged.
 *
 * Limits mirror the in-app action so the public API can't be used to bypass
 * the dashboard's guardrails.
 */
export type MusicGenInput = {
  userId: string;
  genre: string; // 4-500 chars
  lyrics?: string; // 0-4000 chars (optional → instrumental)
  nSegments?: number; // 1-6 (default 2). Each segment ~30 s of audio.
  title?: string; // optional display name, max 80 chars
};

const MIN_GENRE_LEN = 4;
const MAX_GENRE_LEN = 500;
const MAX_LYRICS_LEN = 4000;
const MIN_SEGMENTS = 1;
const MAX_SEGMENTS = 6;
const DEFAULT_SEGMENTS = 2;
const SECONDS_PER_SEGMENT = 30;

export async function generateMusicForUser(
  input: MusicGenInput,
): Promise<{ jobId: string } | { error: string }> {
  const genre = input.genre.trim();
  const lyrics = (input.lyrics ?? "").trim();
  const nSegments = Math.max(
    MIN_SEGMENTS,
    Math.min(MAX_SEGMENTS, Math.round(input.nSegments ?? DEFAULT_SEGMENTS)),
  );

  if (genre.length < MIN_GENRE_LEN) {
    return { error: "`genre` prompt is too short (min 4 chars)." };
  }
  if (genre.length > MAX_GENRE_LEN) {
    return { error: `\`genre\` prompt is too long (max ${MAX_GENRE_LEN}).` };
  }
  if (lyrics.length > MAX_LYRICS_LEN) {
    return { error: `\`lyrics\` too long (max ${MAX_LYRICS_LEN} chars).` };
  }

  // Display name: caller-provided title, else first non-marker line of
  // lyrics, else first 60 chars of the genre prompt.
  const lyricTitle = lyrics
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("["));
  const fallbackTitle =
    genre.length > 60 ? `${genre.slice(0, 57).trim()}…` : genre;
  const displayName =
    (input.title?.trim() && input.title.trim().slice(0, 80)) ||
    (lyricTitle && lyricTitle.slice(0, 80)) ||
    fallbackTitle;

  const approxDurationSeconds = nSegments * SECONDS_PER_SEGMENT;
  const admin = createAdminClient();

  const { data: job, error: insertError } = await admin
    .from("separation_jobs")
    .insert({
      user_id: input.userId,
      original_name: displayName,
      // `input_path` is NOT NULL on the table; music-gen jobs don't have a
      // real source file, so we record a synthetic prefix so it's still
      // user-scoped + unique.
      input_path: `musicgen/${input.userId}/${crypto.randomUUID()}`,
      job_type: "music_generation",
      prompt: genre,
      lyrics: lyrics || null,
      duration_seconds: approxDurationSeconds,
    })
    .select("id")
    .single<{ id: string }>();
  if (insertError || !job) {
    console.error("[music-gen-service] insert error:", insertError);
    return { error: "Could not create the music generation job." };
  }

  const fail = async (message: string) => {
    await admin
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
      output_prefix: `${input.userId}/${job.id}`,
      job_id: job.id,
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
      data: { jobId: job.id, runpodId, endpointKind: "music_gen" },
    });

    return { jobId: job.id };
  } catch (err) {
    console.error("[music-gen-service] RunPod start failed:", err);
    return fail(
      err instanceof Error
        ? err.message
        : "Could not start the music generation job.",
    );
  }
}
