import MusicGenFlow from "@/components/tools/MusicGenFlow";
import { createClient } from "@/lib/supabase/server";

export type MusicGenJob = {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  original_name: string;
  prompt: string | null;
  lyrics: string | null;
  duration_seconds: number | null;
  stems: { audio?: string } | null;
  cover_art_path: string | null;
  error: string | null;
  created_at: string;
};

export default async function MusicGeneratorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: jobsRaw } = await supabase
    .from("separation_jobs")
    .select(
      "id, status, original_name, prompt, lyrics, duration_seconds, stems, cover_art_path, error, created_at",
    )
    .eq("user_id", user?.id ?? "")
    .eq("job_type", "music_generation")
    .order("created_at", { ascending: false })
    .limit(50);

  const jobs = (jobsRaw ?? []) as MusicGenJob[];

  // Pre-sign cover-art URLs (one Storage batch round-trip).
  const coverPaths = jobs.flatMap((j) =>
    j.cover_art_path ? [j.cover_art_path] : [],
  );
  const coverUrlByPath: Record<string, string> = {};
  if (coverPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("stems")
      .createSignedUrls(coverPaths, 60 * 60);
    for (const row of signed ?? []) {
      if (row.path && row.signedUrl) coverUrlByPath[row.path] = row.signedUrl;
    }
  }

  const userName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Workspace";

  return (
    <MusicGenFlow
      userId={user?.id ?? ""}
      workspaceName={userName}
      jobs={jobs}
      coverUrlByPath={coverUrlByPath}
    />
  );
}
