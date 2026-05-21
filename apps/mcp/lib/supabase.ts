import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/**
 * Service-role Supabase client. Bypasses RLS — never expose to a browser.
 * The MCP server calls this with the authenticated user_id (from the access
 * token claims) so it filters per-user manually.
 */
export function createAdminClient() {
  const { url, serviceKey } = getSupabaseEnv();
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
