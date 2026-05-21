/**
 * QueryClient factory. The pattern (per TanStack docs for App Router):
 *
 *   - Server: new client per request (so requests don't share cache across
 *     users / leak state across SSR passes).
 *   - Browser: one singleton (so client navigations keep the cache warm).
 *
 * Defaults are tuned for a chat app: stay-fresh for a beat, then refetch in
 * background on focus/reconnect.
 */
import { QueryClient, isServer } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Treat data as fresh for 60s — within that window cached views render
        // instantly with no spinner; after that we refetch in background.
        staleTime: 60 * 1000,
        // gcTime must be ≥ persister maxAge (7d) so cached rows aren't
        // evicted before persistence kicks in. Browser-only memory cost is
        // small — entries are evicted from IDB by the persister's TTL.
        gcTime: 1000 * 60 * 60 * 24 * 7,
        refetchOnWindowFocus: true,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (isServer) {
    // Per-request client on the server.
    return makeQueryClient();
  }
  // Singleton on the browser.
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
