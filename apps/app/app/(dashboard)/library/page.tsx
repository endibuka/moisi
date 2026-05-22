import Workspace from "@/components/Workspace";
import type { SeparationJob } from "@/lib/separation";
import { getProxyUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function Library() {
  const supabase = await createClient();

  // Run user-from-headers + jobs query in parallel. user is needed only as a
  // prop for Workspace (queries are scoped by RLS).
  const [user, { data: jobs }] = await Promise.all([
    getProxyUser(),
    supabase
      .from("separation_jobs")
      .select(
        "id,status,original_name,input_path,stems,error,created_at,duration_seconds,cover_art_path",
      )
      .order("created_at", { ascending: false }),
  ]);

  return (
    <Workspace
      userId={user?.id ?? ""}
      initialJobs={(jobs as SeparationJob[]) ?? []}
    />
  );
}
