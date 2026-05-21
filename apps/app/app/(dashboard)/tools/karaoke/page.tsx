import ToolPage from "@/components/tools/ToolPage";
import VocalIsolationFlow from "@/components/tools/VocalIsolationFlow";
import type { LibraryItem } from "@/components/tools/AudioSourcePicker";
import { createClient } from "@/lib/supabase/server";

export default async function KaraokePage() {
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
      title="Karaoke Maker"
      subtitle="Strip the vocals out and keep everything else. Upload a new track or pick one from your library."
    >
      <VocalIsolationFlow
        userId={user?.id ?? ""}
        library={library}
        mode="karaoke"
      />
    </ToolPage>
  );
}
