import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import MuseChat from "@/components/MuseChat";
import { getConversation } from "@/lib/muse/conversations";
import { museKeys } from "@/lib/muse/keys";
import { getQueryClient } from "@/lib/query-client";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ c?: string }>;

export default async function MusePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? "";

  const { c: conversationId } = await searchParams;

  // Server-prefetch the specific conversation into the TanStack Query cache
  // so direct loads / reloads have data in the first paint. Client-side nav
  // from the sidebar hits a warm cache (hover prefetch + IDB persistence)
  // and never blocks on this round-trip.
  const queryClient = getQueryClient();
  if (conversationId) {
    await queryClient.prefetchQuery({
      queryKey: museKeys.conversation(conversationId),
      queryFn: () => getConversation(conversationId),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MuseChat userId={userId} conversationId={conversationId} />
    </HydrationBoundary>
  );
}
