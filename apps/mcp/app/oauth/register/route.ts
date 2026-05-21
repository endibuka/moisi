import { NextResponse, type NextRequest } from "next/server";
import { registerClient } from "@/lib/oauth-store";

/**
 * RFC 7591: Dynamic Client Registration.
 * Auto-approves any registration request — typical for personal MCP servers.
 * For a multi-tenant deployment, gate this with a registration token or admin
 * approval flow.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("invalid_client_metadata", "Body must be JSON.");
  }

  const meta = body as {
    redirect_uris?: unknown;
    client_name?: unknown;
  };

  if (!Array.isArray(meta.redirect_uris) || meta.redirect_uris.length === 0) {
    return badRequest("invalid_redirect_uri", "redirect_uris is required.");
  }
  const redirects = meta.redirect_uris.filter(
    (u): u is string => typeof u === "string" && u.length > 0,
  );
  if (redirects.length === 0) {
    return badRequest("invalid_redirect_uri", "redirect_uris must be non-empty strings.");
  }

  const client = await registerClient({
    client_name: typeof meta.client_name === "string" ? meta.client_name : undefined,
    redirect_uris: redirects,
  });

  return NextResponse.json(
    {
      client_id: client.client_id,
      client_id_issued_at: Math.floor(client.registered_at / 1000),
      redirect_uris: client.redirect_uris,
      client_name: client.client_name,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
    },
    { status: 201, headers: { "Access-Control-Allow-Origin": "*" } },
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

function badRequest(error: string, error_description: string) {
  return NextResponse.json({ error, error_description }, { status: 400 });
}
