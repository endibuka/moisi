import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import PageTransition from "@/components/PageTransition";
import QueryProvider from "@/components/QueryProvider";
import Sidebar, { type SidebarJob } from "@/components/Sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { listConversations } from "@/lib/muse/conversations";
import { museKeys } from "@/lib/muse/keys";
import { getQueryClient } from "@/lib/query-client";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "User";

  // Top 5 of the user's most-recent jobs — surfaces the Library section in
  // the sidebar with real data so it never reads as empty.
  const { data: recentJobs } = await supabase
    .from("separation_jobs")
    .select("id, original_name, status")
    .order("created_at", { ascending: false })
    .limit(5);

  // Server-prefetch the muse conversation list into TanStack Query so the
  // sidebar renders with data on the first paint (no spinner) and the cache
  // is warm for instant subsequent renders.
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: museKeys.conversations(),
    queryFn: () => listConversations(50),
  });

  return (
    <QueryProvider>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <div className="flex h-screen overflow-hidden bg-[#0c0c0e] text-[#edeef0]">
          <Sidebar
            userName={userName}
            userEmail={user?.email ?? ""}
            recentJobs={(recentJobs as SidebarJob[]) ?? []}
          />
          <main className="relative flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <PageTransition>{children}</PageTransition>
            </ScrollArea>
          </main>
        </div>
      </HydrationBoundary>
    </QueryProvider>
  );
}
