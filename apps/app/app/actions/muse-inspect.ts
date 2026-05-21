"use server";

import type { TrackAnalysis } from "@/lib/runpod";
import { createClient } from "@/lib/supabase/server";

export type TrackInspection = {
  id: string;
  title: string;
  jobType: "separation" | "vocal_isolation" | "music_generation";
  durationSeconds: number | null;
  status: string;
  /** Available stem names (for separation/vocal_isolation), keys of stems object. */
  stems: string[];
  /** For music_generation: the style prompt the user gave. */
  prompt: string | null;
  /** For music_generation: structured lyrics if they exist. */
  lyrics: string | null;
  /** Whether the row has cover art. */
  hasCover: boolean;
  /** librosa-derived features, null if the track pre-dates analysis or it failed. */
  analysis: TrackAnalysis | null;
};

type Result = { inspection: TrackInspection } | { error: string };

/**
 * Fetch everything the agent needs to talk about a track: BPM/key/loudness
 * from `analysis`, what stems exist, whether it has a cover, and the
 * prompt/lyrics for AI-generated tracks. RLS scopes the read to the
 * signed-in user automatically.
 */
export async function museInspectTrack(jobId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are not signed in." };

  const { data, error } = await supabase
    .from("separation_jobs")
    .select(
      "id, original_name, job_type, status, duration_seconds, stems, prompt, lyrics, cover_art_path, analysis",
    )
    .eq("id", jobId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Track not found." };

  const stems =
    data.stems && typeof data.stems === "object"
      ? Object.keys(data.stems as Record<string, unknown>)
      : [];

  const inspection: TrackInspection = {
    id: data.id as string,
    title: (data.original_name as string) ?? "Untitled",
    jobType: data.job_type as TrackInspection["jobType"],
    durationSeconds: (data.duration_seconds as number | null) ?? null,
    status: (data.status as string) ?? "unknown",
    stems,
    prompt: (data.prompt as string | null) ?? null,
    lyrics: (data.lyrics as string | null) ?? null,
    hasCover: Boolean(data.cover_art_path),
    analysis: (data.analysis as TrackAnalysis | null) ?? null,
  };

  return { inspection };
}
