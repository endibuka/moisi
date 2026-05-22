import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import MuseChat from "@/components/MuseChat";
import { getConversation } from "@/lib/muse/conversations";
import { museKeys } from "@/lib/muse/keys";
import { getQueryClient } from "@/lib/query-client";
import { getProxyUser } from "@/lib/supabase/auth";

type SearchParams = Promise<{ c?: string }>;

export default async function MusePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const queryClient = getQueryClient();

  // Read user (from headers, zero network) and the route's `?c=` param in
  // parallel with the conversation prefetch — none of these depend on each
  // other.
  const [user, { c: conversationId }] = await Promise.all([
    getProxyUser(),
    searchParams,
  ]);
  const userId = user?.id ?? "";

  // Server-prefetch the specific conversation into the TanStack Query cache
  // so direct loads / reloads have data in the first paint. Client-side nav
  // from the sidebar hits a warm cache (hover prefetch + IDB persistence)
  // and never blocks on this round-trip.
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
