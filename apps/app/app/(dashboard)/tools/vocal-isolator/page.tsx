import ToolPage from "@/components/tools/ToolPage";
import VocalIsolationFlow from "@/components/tools/VocalIsolationFlow";
import type { LibraryItem } from "@/components/tools/AudioSourcePicker";
import { createClient } from "@/lib/supabase/server";

export default async function VocalIsolatorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: libraryRows } = await supabase
    .from("separation_jobs")
    .select("id, original_name, input_path")
    .eq("user_id", user?.id ?? "")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(20);

  const library: LibraryItem[] = (libraryRows ?? []) as LibraryItem[];

  return (
    <ToolPage
      eyebrow="Tool"
      title="Vocal Isolator"
      subtitle="Pull a clean vocal out of any track in about a minute. Upload a new song or pick one from your library — the result lands as a job you can play and mix."
    >
      <VocalIsolationFlow
        userId={user?.id ?? ""}
        library={library}
        mode="vocal"
      />
    </ToolPage>
  );
}
