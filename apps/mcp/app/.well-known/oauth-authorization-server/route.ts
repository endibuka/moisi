import { NextResponse } from "next/server";
import { getIssuer } from "@/lib/env";

/**
 * RFC 8414: OAuth 2.0 Authorization Server Metadata.
 * Declares our endpoints, supported flows, and PKCE requirement so MCP clients
 * can drive the auth dance without any out-of-band config.
 */
export function GET() {
  const issuer = getIssuer();
  return NextResponse.json(
    {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      registration_endpoint: `${issuer}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["mcp:read", "mcp:write"],
      service_documentation: `${issuer}/`,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
