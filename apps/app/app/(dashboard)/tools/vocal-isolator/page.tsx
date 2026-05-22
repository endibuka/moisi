import ToolPage from "@/components/tools/ToolPage";
import VocalIsolationFlow, {
  type VocalIsolationJob,
} from "@/components/tools/VocalIsolationFlow";
import type { LibraryItem } from "@/components/tools/AudioSourcePicker";
import type { StemPaths } from "@/lib/separation";
import { getProxyUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function VocalIsolatorPage() {
  const supabase = await createClient();
  const user = await getProxyUser();
  const userId = user?.id ?? "";

  // Library: only show real uploaded sources (full separations and prior
  // vocal isolations). music_generation rows use synthetic input_paths that
  // can't be re-fed to the GPU worker.
  // Recent runs of *this* tool — drives live status + inline playback once a
  // job lands. We pull a few extras so the user can replay prior results.
  // Both queries run in parallel since they're independent.
  const [{ data: libraryRows }, { data: jobRows }] = await Promise.all([
    supabase
      .from("separation_jobs")
      .select("id, original_name, input_path")
      .eq("user_id", userId)
      .in("job_type", ["separation", "vocal_isolation"])
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("separation_jobs")
      .select(
        "id, status, original_name, stems, error, created_at, duration_seconds",
      )
      .eq("user_id", userId)
      .eq("job_type", "vocal_isolation")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const library: LibraryItem[] = (libraryRows ?? []) as LibraryItem[];
  const initialJobs: VocalIsolationJob[] = (jobRows ?? []).map((r) => ({
    id: r.id as string,
    status: r.status as VocalIsolationJob["status"],
    original_name: r.original_name as string,
    stems: (r.stems as StemPaths | null) ?? null,
    error: (r.error as string | null) ?? null,
    created_at: r.created_at as string,
    duration_seconds: (r.duration_seconds as number | null) ?? null,
  }));

  return (
    <ToolPage
      eyebrow="Tool"
      title="Vocal Isolator"
      subtitle="Pull a clean vocal out of any track in about a minute. Upload a new song or pick one from your library — the result lands as a job you can play and mix."
    >
      <VocalIsolationFlow
        userId={userId}
        library={library}
        initialJobs={initialJobs}
        mode="vocal"
      />
    </ToolPage>
  );
}
