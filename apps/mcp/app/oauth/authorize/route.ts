import { type NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/oauth-store";
import { getIssuer } from "@/lib/env";
import { createSupabaseServer } from "@/lib/supabase-server";

/**
 * OAuth 2.1 authorization endpoint.
 *
 * Required query params:
 *   response_type=code, client_id, redirect_uri,
 *   code_challenge, code_challenge_method=S256, state, [scope]
 *
 * Auth handled by the MCP server itself (not the main app) — Supabase cookies
 * live on the MCP origin, set by /oauth/login. Cross-origin cookie sharing
 * with the main app doesn't work on `*.run.app` / `*.vercel.app` subdomains
 * (Public Suffix List), so this server is fully self-contained.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const response_type = sp.get("response_type");
  const client_id = sp.get("client_id");
  const redirect_uri = sp.get("redirect_uri");
  const code_challenge = sp.get("code_challenge");
  const code_challenge_method = sp.get("code_challenge_method");
  const state = sp.get("state") ?? "";
  const scope = sp.get("scope") ?? "mcp:read mcp:write";

  if (response_type !== "code") {
    return errorRedirect(redirect_uri, state, "unsupported_response_type",
      "Only response_type=code is supported.");
  }
  if (!client_id) return badRequest("client_id is required.");
  if (!redirect_uri) return badRequest("redirect_uri is required.");
  if (!code_challenge || code_challenge_method !== "S256") {
    return errorRedirect(redirect_uri, state, "invalid_request",
      "PKCE required: code_challenge + code_challenge_method=S256.");
  }

  const client = await getClient(client_id);
  if (!client) {
    return errorRedirect(redirect_uri, state, "unauthorized_client",
      "Unknown client_id. Register via /oauth/register first.");
  }
  if (!client.redirect_uris.includes(redirect_uri)) {
    return badRequest("redirect_uri is not registered for this client.");
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Build redirects off the public issuer, not request.url: behind Cloud Run
  // (and similar proxies) request.url resolves to the internal bind address
  // (https://0.0.0.0:8080), which the browser can't reach.
  const origin = getIssuer();

  if (!user) {
    // Bounce to our own login page; it'll come back here with the same query.
    const next = `${request.nextUrl.pathname}?${sp.toString()}`;
    const login = new URL("/oauth/login", origin);
    login.searchParams.set("next", next);
    return NextResponse.redirect(login);
  }

  // Logged in — go to the consent page which finalises the code grant.
  const consent = new URL("/oauth/consent", origin);
  sp.forEach((v, k) => consent.searchParams.set(k, v));
  consent.searchParams.set("scope", scope);
  return NextResponse.redirect(consent);
}

function badRequest(msg: string) {
  return NextResponse.json(
    { error: "invalid_request", error_description: msg },
    { status: 400 },
  );
}

function errorRedirect(
  redirect_uri: string | null,
  state: string,
  error: string,
  error_description: string,
) {
  if (!redirect_uri) return badRequest(error_description);
  const u = new URL(redirect_uri);
  u.searchParams.set("error", error);
  u.searchParams.set("error_description", error_description);
  if (state) u.searchParams.set("state", state);
  return NextResponse.redirect(u);
}
