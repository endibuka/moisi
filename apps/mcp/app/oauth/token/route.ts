import { NextResponse, type NextRequest } from "next/server";
import { consumeCode } from "@/lib/oauth-store";
import { accessTokenTtl, signAccessToken } from "@/lib/jwt";

/**
 * OAuth 2.1 token endpoint.
 * Supports grant_type=authorization_code with PKCE only. No client secret —
 * MCP clients are public (mobile / desktop / agents).
 */
export async function POST(request: NextRequest) {
  const params = await readParams(request);
  if (!params) return tokenError("invalid_request", "Could not parse request body.");

  const {
    grant_type,
    code,
    redirect_uri,
    client_id,
    code_verifier,
  } = params;

  if (grant_type !== "authorization_code") {
    return tokenError("unsupported_grant_type", "Only authorization_code is supported.");
  }
  if (!code || !redirect_uri || !client_id || !code_verifier) {
    return tokenError("invalid_request",
      "code, redirect_uri, client_id, and code_verifier are required.");
  }

  const record = await consumeCode(code);
  if (!record) return tokenError("invalid_grant", "Authorization code is invalid or expired.");
  if (record.client_id !== client_id) {
    return tokenError("invalid_grant", "client_id does not match the authorization code.");
  }
  if (record.redirect_uri !== redirect_uri) {
    return tokenError("invalid_grant", "redirect_uri does not match.");
  }

  // PKCE: S256(code_verifier) must equal the original code_challenge.
  const challenge = await s256(code_verifier);
  if (challenge !== record.code_challenge) {
    return tokenError("invalid_grant", "PKCE verification failed.");
  }

  const access_token = await signAccessToken(record.user_id, client_id, record.scope);
  return NextResponse.json(
    {
      access_token,
      token_type: "Bearer",
      expires_in: accessTokenTtl,
      scope: record.scope,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

export function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

/* ---- helpers ---- */

type TokenParams = {
  grant_type?: string;
  code?: string;
  redirect_uri?: string;
  client_id?: string;
  code_verifier?: string;
};

async function readParams(request: NextRequest): Promise<TokenParams | null> {
  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      return Object.fromEntries(params.entries()) as TokenParams;
    }
    if (contentType.includes("application/json")) {
      return (await request.json()) as TokenParams;
    }
  } catch {
    return null;
  }
  return null;
}

function tokenError(error: string, error_description: string) {
  return NextResponse.json(
    { error, error_description },
    {
      status: 400,
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

/** Base64url-encoded SHA-256 of `verifier` — the RFC 7636 transformation. */
async function s256(verifier: string): Promise<string> {
  const buf = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  let b64 = "";
  const bytes = new Uint8Array(hash);
  for (let i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i]);
  return btoa(b64)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
