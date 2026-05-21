"use client";

import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { idbPersister } from "@/lib/idb-persister";
import { getQueryClient } from "@/lib/query-client";

// One week — long enough for a chat's data to stay fast across reloads,
// short enough that stale rows eventually get garbage-collected.
const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24 * 7;

export default function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: idbPersister,
        maxAge: PERSIST_MAX_AGE,
        // Only persist Muse-related queries — don't fill IDB with anything
        // else that might land in the cache (auth, etc.). Anchored on the
        // first key segment (see `museKeys`).
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.queryKey[0] === "muse",
        },
      }}
    >
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </PersistQueryClientProvider>
  );
}
