import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import QueryProvider from "@/components/QueryProvider";
import Sidebar, { type SidebarJob } from "@/components/Sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { listConversations } from "@/lib/muse/conversations";
import { museKeys } from "@/lib/muse/keys";
import { getQueryClient } from "@/lib/query-client";
import { getProxyUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Shared shell for every authenticated page: sidebar on the left, scrollable
 * main on the right. proxy.ts gates authentication before this ever renders,
 * so user is effectively non-null inside the group.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // User comes from proxy.ts via request headers — zero network call.
  const user = await getProxyUser();

  const userName =
    user?.name || user?.email?.split("@")[0] || "User";

  const supabase = await createClient();
  const queryClient = getQueryClient();

  // Run both fetches in parallel: the sidebar's recent-jobs slice and the
  // server-prefetch of the muse conversation list. Previously sequential —
  // now they share one round-trip window.
  const [recentJobsResult] = await Promise.all([
    supabase
      .from("separation_jobs")
      .select("id, original_name, status, cover_art_path")
      .order("created_at", { ascending: false })
      .limit(5),
    queryClient.prefetchQuery({
      queryKey: museKeys.conversations(),
      queryFn: () => listConversations(50),
    }),
  ]);

  // For rows with a cover, mint short-lived signed URLs server-side so the
  // sidebar can render <img> directly without a per-row Supabase round-trip
  // in the browser. Failures degrade silently to the default MusicNotes icon.
  type RawRow = {
    id: string;
    original_name: string;
    status: SidebarJob["status"];
    cover_art_path: string | null;
  };
  const rawJobs = (recentJobsResult.data as RawRow[] | null) ?? [];
  const withCovers = await Promise.all(
    rawJobs.map(async (row): Promise<SidebarJob> => {
      if (!row.cover_art_path) {
        return {
          id: row.id,
          original_name: row.original_name,
          status: row.status,
          cover_url: null,
        };
      }
      const { data: signed } = await supabase.storage
        .from("stems")
        .createSignedUrl(row.cover_art_path, 60 * 60);
      return {
        id: row.id,
        original_name: row.original_name,
        status: row.status,
        cover_url: signed?.signedUrl ?? null,
      };
    }),
  );

  return (
    <QueryProvider>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <div className="flex h-screen overflow-hidden bg-[#0c0c0e] text-[#edeef0]">
          <Sidebar
            userName={userName}
            userEmail={user?.email ?? ""}
            recentJobs={withCovers}
          />
          <main className="relative flex-1 overflow-hidden">
            <ScrollArea className="h-full">{children}</ScrollArea>
          </main>
        </div>
      </HydrationBoundary>
    </QueryProvider>
  );
}
