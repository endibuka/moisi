import { inngest } from "./inngest";
import { startRunpodMusicGen } from "./runpod";
import { createAdminClient } from "./supabase";

/**
 * Music-gen flow for the MCP server. Mirrors apps/app/lib/music-gen-service.ts:
 * inserts a `separation_jobs` row with job_type='music_generation', kicks off
 * YuE on RunPod, then sends `app/separation.queued` with endpointKind so the
 * main app's Inngest watcher picks it up and polls the right endpoint. The
 * watcher also triggers auto-cover-art on completion — same flow as in-app.
 */
const MIN_GENRE_LEN = 4;
const MAX_GENRE_LEN = 500;
const MAX_LYRICS_LEN = 4000;
const MIN_SEGMENTS = 1;
const MAX_SEGMENTS = 6;
const DEFAULT_SEGMENTS = 2;
const SECONDS_PER_SEGMENT = 30;

export type MusicGenInput = {
  userId: string;
  genre: string;
  lyrics?: string;
  nSegments?: number;
  title?: string;
};

export type MusicGenResult =
  | { ok: true; jobId: string; runpodId: string; durationEstimate: number }
  | { error: string };

export async function generateMusic(
  input: MusicGenInput,
): Promise<MusicGenResult> {
  const genre = input.genre.trim();
  const lyrics = (input.lyrics ?? "").trim();
  const nSegments = Math.max(
    MIN_SEGMENTS,
    Math.min(MAX_SEGMENTS, Math.round(input.nSegments ?? DEFAULT_SEGMENTS)),
  );

  if (genre.length < MIN_GENRE_LEN) {
    return { error: "`genre` is too short (min 4 chars)." };
  }
  if (genre.length > MAX_GENRE_LEN) {
    return { error: `\`genre\` is too long (max ${MAX_GENRE_LEN}).` };
  }
  if (lyrics.length > MAX_LYRICS_LEN) {
    return { error: `\`lyrics\` is too long (max ${MAX_LYRICS_LEN}).` };
  }

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
      input_path: `musicgen/${input.userId}/${crypto.randomUUID()}`,
      job_type: "music_generation",
      prompt: genre,
      lyrics: lyrics || null,
      duration_seconds: approxDurationSeconds,
    })
    .select("id")
    .single<{ id: string }>();
  if (insertError || !job) {
    return { error: insertError?.message ?? "Could not create the job." };
  }

  const fail = async (message: string): Promise<MusicGenResult> => {
    await admin
      .from("separation_jobs")
      .update({ status: "failed", error: message })
      .eq("id", job.id);
    return { error: message };
  };

  let runpodId: string;
  try {
    runpodId = await startRunpodMusicGen({
      genre,
      lyrics,
      n_segments: nSegments,
      output_prefix: `${input.userId}/${job.id}`,
      job_id: job.id,
    });
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "RunPod /run failed.",
    );
  }

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

  return {
    ok: true,
    jobId: job.id,
    runpodId,
    durationEstimate: approxDurationSeconds,
  };
}
