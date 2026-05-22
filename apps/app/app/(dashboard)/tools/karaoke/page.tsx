import ToolPage from "@/components/tools/ToolPage";
import VocalIsolationFlow, {
  type VocalIsolationJob,
} from "@/components/tools/VocalIsolationFlow";
import type { LibraryItem } from "@/components/tools/AudioSourcePicker";
import type { StemPaths } from "@/lib/separation";
import { getProxyUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function KaraokePage() {
  const supabase = await createClient();
  const user = await getProxyUser();
  const userId = user?.id ?? "";

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
      title="Karaoke Maker"
      subtitle="Strip the vocals out and keep everything else. Upload a new track or pick one from your library."
    >
      <VocalIsolationFlow
        userId={userId}
        library={library}
        initialJobs={initialJobs}
        mode="karaoke"
      />
    </ToolPage>
  );
}
