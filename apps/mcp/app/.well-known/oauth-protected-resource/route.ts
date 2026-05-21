import { NextResponse } from "next/server";
import { getIssuer } from "@/lib/env";

/**
 * RFC 9728: OAuth 2.0 Protected Resource Metadata.
 * The MCP client fetches this on the first 401 to learn where to authorize.
 */
export function GET() {
  const issuer = getIssuer();
  return NextResponse.json(
    {
      resource: issuer,
      authorization_servers: [issuer],
      bearer_methods_supported: ["header"],
      scopes_supported: ["mcp:read", "mcp:write"],
      resource_documentation: `${issuer}/`,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
