import Workspace from "@/components/Workspace";
import type { SeparationJob } from "@/lib/separation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: jobs } = await supabase
    .from("separation_jobs")
    .select(
      "id,status,original_name,input_path,stems,error,created_at,duration_seconds",
    )
    .order("created_at", { ascending: false });

  return (
    <Workspace
      userId={user?.id ?? ""}
      initialJobs={(jobs as SeparationJob[]) ?? []}
    />
  );
}
