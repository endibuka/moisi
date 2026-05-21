/**
 * Resolves the MCP server's public origin (the OAuth issuer). In dev we fall
 * back to localhost:3002; in prod the URL is fixed via MCP_ISSUER so OAuth
 * metadata is stable across deploys.
 */
export function getIssuer(): string {
  return (
    process.env.MCP_ISSUER?.replace(/\/$/, "") || "http://localhost:3002"
  );
}

/**
 * HS256 signing secret for access tokens. Required in production; in dev a
 * deterministic fallback is used so re-mounts don't invalidate tokens.
 */
export function getJwtSecret(): Uint8Array {
  const raw =
    process.env.MCP_JWT_SECRET ||
    "dev-only-mcp-jwt-secret-do-not-use-in-production-please";
  return new TextEncoder().encode(raw);
}

/**
 * Supabase service-role key — required so the MCP server can read/write the
 * `separation_jobs` table on behalf of an authenticated user (RLS bypassed,
 * we filter by user_id from the access-token claims).
 */
export function getSupabaseEnv() {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for the MCP server.",
    );
  }
  return { url: url.replace(/\/$/, ""), serviceKey };
}

export function getRunpodEnv() {
  const endpoint = process.env.RUNPOD_ENDPOINT_ID;
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!endpoint || !apiKey) {
    throw new Error(
      "RUNPOD_ENDPOINT_ID and RUNPOD_API_KEY must be set for the MCP server.",
    );
  }
  return { endpoint, apiKey };
}

/**
 * YuE music-generation endpoint. Separate env var so the MCP can target the
 * music-gen worker independently of the separation one. RUNPOD_API_KEY is
 * shared across endpoints.
 */
export function getYueEnv() {
  const endpoint = process.env.RUNPOD_YUE_ENDPOINT_ID;
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!endpoint || !apiKey) {
    throw new Error(
      "RUNPOD_YUE_ENDPOINT_ID and RUNPOD_API_KEY must be set for the music-gen tool.",
    );
  }
  return { endpoint, apiKey };
}

/**
 * Gemini API key for the cover-art tool. Same env var as the main app.
 */
export function getGeminiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY must be set for the cover-art tool.");
  }
  return key;
}

export function getAppOrigin(): string {
  // Where /oauth/authorize sends the user when they need to log in. Default
  // is the local main Next app; in prod set MOISI_APP_ORIGIN to the deployed
  // dashboard URL.
  return (
    process.env.MOISI_APP_ORIGIN?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}
