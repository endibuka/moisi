import "server-only";

import { headers } from "next/headers";

export type ProxyUser = {
  id: string;
  email: string;
  /** `user_metadata.full_name` if present, else "". */
  name: string;
};

/**
 * Returns the user already verified by `proxy.ts` for this request. proxy.ts
 * validates the JWT once and forwards `id` / `email` / `name` via request
 * headers, so this is a zero-network read — RSCs no longer pay for redundant
 * `supabase.auth.getUser()` calls on every navigation.
 *
 * Inside the `(dashboard)` group the proxy guarantees a user, so this is
 * effectively non-null there. Returns `null` only on routes the proxy lets
 * through unauthenticated.
 */
export async function getProxyUser(): Promise<ProxyUser | null> {
  const h = await headers();
  const id = h.get("x-user-id");
  if (!id) return null;
  return {
    id,
    email: h.get("x-user-email") ?? "",
    name: decodeURIComponent(h.get("x-user-name") ?? ""),
  };
}
