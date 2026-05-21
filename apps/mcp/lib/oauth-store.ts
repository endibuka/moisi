import { createAdminClient } from "./supabase";

/**
 * OAuth state persistence. Backed by the Supabase project so the MCP server
 * works correctly across multiple Cloud Run instances (or any horizontally
 * scaled serverless platform). Previous in-memory implementation worked in
 * dev but lost state on every cold start in prod.
 *
 * Tables (see migration 0004_mcp_oauth.sql):
 *   - mcp_oauth_clients   (dynamically registered clients)
 *   - mcp_oauth_codes     (one-shot authorization codes, ~10 min TTL)
 */

export type RegisteredClient = {
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
  registered_at: number; // ms epoch
};

type AuthorizationCodeRow = {
  code: string;
  client_id: string;
  redirect_uri: string;
  user_id: string;
  code_challenge: string;
  scope: string;
  expires_at: string; // ISO
  used: boolean;
};

const CODE_TTL_MS = 10 * 60 * 1000;

/* ---- clients (DCR) ---- */

export async function registerClient(input: {
  client_name?: string;
  redirect_uris: string[];
}): Promise<RegisteredClient> {
  const admin = createAdminClient();
  const client_id = `mcp_${crypto.randomUUID()}`;
  const { data, error } = await admin
    .from("mcp_oauth_clients")
    .insert({
      client_id,
      client_name: input.client_name ?? null,
      redirect_uris: input.redirect_uris,
    })
    .select("client_id, client_name, redirect_uris, registered_at")
    .single();
  if (error || !data) {
    throw new Error(`registerClient failed: ${error?.message ?? "no row"}`);
  }
  return {
    client_id: data.client_id,
    client_name: data.client_name,
    redirect_uris: data.redirect_uris,
    registered_at: new Date(data.registered_at).getTime(),
  };
}

export async function getClient(
  client_id: string,
): Promise<RegisteredClient | undefined> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mcp_oauth_clients")
    .select("client_id, client_name, redirect_uris, registered_at")
    .eq("client_id", client_id)
    .maybeSingle();
  if (error || !data) return undefined;
  return {
    client_id: data.client_id,
    client_name: data.client_name,
    redirect_uris: data.redirect_uris,
    registered_at: new Date(data.registered_at).getTime(),
  };
}

/* ---- authorization codes ---- */

export async function createCode(input: {
  client_id: string;
  redirect_uri: string;
  user_id: string;
  code_challenge: string;
  scope: string;
}): Promise<string> {
  const admin = createAdminClient();
  const code = `mcp_code_${crypto.randomUUID().replace(/-/g, "")}`;
  const expires_at = new Date(Date.now() + CODE_TTL_MS).toISOString();

  // Opportunistic GC — keeps the table bounded without a cron job.
  void admin
    .from("mcp_oauth_codes")
    .delete()
    .or(`used.eq.true,expires_at.lt.${new Date().toISOString()}`);

  const { error } = await admin.from("mcp_oauth_codes").insert({
    code,
    client_id: input.client_id,
    redirect_uri: input.redirect_uri,
    user_id: input.user_id,
    code_challenge: input.code_challenge,
    code_challenge_method: "S256",
    scope: input.scope,
    expires_at,
    used: false,
  });
  if (error) throw new Error(`createCode failed: ${error.message}`);
  return code;
}

/**
 * Atomic single-use: flips `used = true` and returns the row only if it was
 * still false and unexpired. Concurrent token requests can't both consume the
 * same code because the UPDATE is filtered on `used = false`.
 */
export async function consumeCode(
  code: string,
): Promise<AuthorizationCodeRow | undefined> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mcp_oauth_codes")
    .update({ used: true })
    .eq("code", code)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .select(
      "code, client_id, redirect_uri, user_id, code_challenge, scope, expires_at, used",
    )
    .maybeSingle();
  if (error || !data) return undefined;
  return data as AuthorizationCodeRow;
}
