"use client";

import { del, get, set } from "idb-keyval";
import type {
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client";

/**
 * IndexedDB-backed TanStack Query persister.
 *
 * Why IDB and not localStorage:
 *   - Larger quota (~50MB+ vs ~5MB)
 *   - Async, non-blocking writes (localStorage blocks the main thread)
 *   - Survives the cache eviction LS sometimes hits on mobile
 *
 * idb-keyval is a tiny wrapper around IndexedDB's quirky API. Reads/writes
 * are throttled internally by TanStack Query's persister so we're not
 * hitting IDB on every keystroke.
 */
const IDB_KEY = "moisi.query-cache";

export const idbPersister: Persister = {
  persistClient: async (client) => {
    try {
      await set(IDB_KEY, client);
    } catch {
      // Quota exceeded, browser disabled IDB, private mode — silently drop.
    }
  },
  restoreClient: async () => {
    try {
      return (await get<PersistedClient>(IDB_KEY)) ?? undefined;
    } catch {
      return undefined;
    }
  },
  removeClient: async () => {
    try {
      await del(IDB_KEY);
    } catch {
      // ignore
    }
  },
};
