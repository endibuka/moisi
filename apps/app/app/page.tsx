import Sidebar from "@/components/Sidebar";
import Workspace from "@/components/Workspace";
import type { SeparationJob } from "@/lib/separation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "User";

  const { data: jobs } = await supabase
    .from("separation_jobs")
    .select("id,status,original_name,input_path,stems,error,created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex h-screen overflow-hidden bg-[#0c0c0e] text-[#edeef0]">
      <Sidebar userName={userName} userEmail={user?.email ?? ""} />
      <main className="relative flex-1 overflow-y-auto">
        <Workspace
          userId={user?.id ?? ""}
          initialJobs={(jobs as SeparationJob[]) ?? []}
        />
      </main>
    </div>
  );
}
