import ToolPage from "@/components/tools/ToolPage";
import CoverArtFlow from "@/components/tools/CoverArtFlow";
import type { LibraryItem } from "@/components/tools/AudioSourcePicker";
import { createClient } from "@/lib/supabase/server";

export default async function CoverArtPage() {
  const supabase = await createClient();

  // RLS on separation_jobs already scopes rows to auth.uid, so no user_id
  // filter needed here — one round-trip, no auth precondition.
  const { data: libraryRows } = await supabase
    .from("separation_jobs")
    .select("id, original_name, input_path, cover_art_path")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <ToolPage
      eyebrow="Tool"
      title="Cover Art"
      subtitle="Generate Spotify-style cover art for any track in your library. Pick a song, optionally describe the mood, hit Generate."
    >
      <CoverArtFlow library={(libraryRows ?? []) as LibraryItem[]} />
    </ToolPage>
  );
}
