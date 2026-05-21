/**
 * TanStack Query keys for the muse cache. Lives in its own module (no
 * "use client") so server components can import it for prefetch/invalidation
 * without tripping the React Server Component boundary on a client module.
 */
export const museKeys = {
  conversations: () => ["muse", "conversations"] as const,
  conversation: (id: string) => ["muse", "conversation", id] as const,
};
