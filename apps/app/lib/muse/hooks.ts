"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  deleteMuseConversation,
  fetchMuseConversation,
  fetchMuseConversations,
} from "@/app/(dashboard)/muse/actions";
import type { MuseConversationSummary } from "@/lib/muse/conversations";
import { museKeys } from "@/lib/muse/keys";

export { museKeys };

/** Sidebar chat list. */
export function useConversations() {
  return useQuery({
    queryKey: museKeys.conversations(),
    queryFn: () => fetchMuseConversations(),
  });
}

/** Single conversation with full messages. */
export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: museKeys.conversation(id ?? "none"),
    queryFn: () => (id ? fetchMuseConversation(id) : null),
    enabled: !!id,
  });
}

/**
 * Hover prefetch — when the user hovers a chat link in the sidebar, we kick
 * off the fetch so click-time is instant.
 */
export function usePrefetchConversation() {
  const qc = useQueryClient();
  return (id: string) => {
    void qc.prefetchQuery({
      queryKey: museKeys.conversation(id),
      queryFn: () => fetchMuseConversation(id),
      staleTime: 60 * 1000,
    });
  };
}

/**
 * Delete with optimistic update. The chat vanishes from the sidebar
 * immediately; if the server rejects, we roll back and refetch.
 */
export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMuseConversation(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: museKeys.conversations() });
      const prev = qc.getQueryData<MuseConversationSummary[]>(
        museKeys.conversations(),
      );
      qc.setQueryData<MuseConversationSummary[]>(
        museKeys.conversations(),
        (old) => (old ?? []).filter((c) => c.id !== id),
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(museKeys.conversations(), ctx.prev);
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: museKeys.conversations() });
    },
  });
}
