"use server";

import { revalidatePath } from "next/cache";
import { generateApiKey, hashApiKey } from "@/lib/api-keys";
import { createClient } from "@/lib/supabase/server";

export type ApiKeySummary = {
  id: string;
  name: string;
  prefix: string;
  last_chars: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

/**
 * Mint a new key. The plaintext is returned ONCE — caller (UI) must surface
 * it to the user immediately, after which it's gone forever. Storage holds
 * only the hash + display affixes.
 */
export async function createApiKey(
  name: string,
): Promise<
  | { ok: true; key: { id: string; plaintext: string; lastChars: string } }
  | { error: string }
> {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) return { error: "Name is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { plaintext, hashed, prefix, lastChars } = generateApiKey();

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: user.id,
      name: trimmed,
      hashed_key: hashed,
      prefix,
      last_chars: lastChars,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    console.error("[api-keys] create error:", error);
    return { error: "Could not create the key. Please try again." };
  }

  revalidatePath("/", "layout");
  return { ok: true, key: { id: data.id, plaintext, lastChars } };
}

/** List the caller's keys (active and revoked, most-recent first). */
export async function listApiKeys(): Promise<ApiKeySummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select(
      "id, name, prefix, last_chars, last_used_at, created_at, revoked_at",
    )
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[api-keys] list error:", error);
    return [];
  }
  return (data ?? []) as ApiKeySummary[];
}

/** Soft-delete: stamps revoked_at. The key still exists for audit, but
 *  the partial unique index on hashed_key only covers non-revoked rows so
 *  the slot is free for future keys to take. */
export async function revokeApiKey(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[api-keys] revoke error:", error);
    return { error: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Server-side helper used by /api/v1/* routes to authenticate a request.
 * Looks up by SHA-256 hash, ignores revoked rows, returns the owning user
 * id + key id. Bumps `last_used_at` best-effort.
 *
 * Uses the request-scoped client so it doesn't need the service-role key —
 * RLS allows the row owner to read it, but since we're not yet logged in as
 * the owner at this point we use an unauthed client. Falls through to a
 * select via the hashed_key unique index which is publicly listed by RLS
 * via a permissive policy specifically for this purpose? No — we don't
 * have such a policy. We must use the service-role for lookup.
 *
 * SECURITY: this function should only be called from server-side route
 * handlers (api/v1/*). Never from the browser.
 */
export async function authenticateApiKey(plaintext: string): Promise<
  | { userId: string; keyId: string }
  | { error: "missing" | "malformed" | "invalid" | "revoked" }
> {
  // Late-imported to avoid loading the admin client unless an /api/v1/* route
  // is actually hit.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const hashed = hashApiKey(plaintext);
  const { data, error } = await admin
    .from("api_keys")
    .select("id, user_id, revoked_at")
    .eq("hashed_key", hashed)
    .maybeSingle<{ id: string; user_id: string; revoked_at: string | null }>();
  if (error || !data) return { error: "invalid" };
  if (data.revoked_at) return { error: "revoked" };

  // Best-effort timestamp bump — don't block the request on this.
  void admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { userId: data.user_id, keyId: data.id };
}
