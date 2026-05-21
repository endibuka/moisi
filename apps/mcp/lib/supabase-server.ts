import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

/**
 * Supabase SSR client for the MCP origin. Reads/writes auth cookies attached
 * to *this* host (e.g. mcp.moisi.app or localhost:3002), independent of the
 * main app's session — which is necessary because `.run.app` and `.vercel.app`
 * subdomains can't share cookies (both are on the Public Suffix List).
 *
 * The user signs in via /oauth/login on the MCP server itself; Supabase sets
 * its session cookies on this origin, and /oauth/authorize + /oauth/consent
 * see the session via this client.
 */
export async function createSupabaseServer() {
  const { url } = getSupabaseEnv();
  // Modern Supabase naming is "publishable" key; fall back to the legacy
  // "anon" naming so both env layouts work.
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required for the MCP auth flow.",
    );
  }
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies — ignore. Server Actions and
          // Route Handlers, which actually need to set cookies, can.
        }
      },
    },
  });
}
