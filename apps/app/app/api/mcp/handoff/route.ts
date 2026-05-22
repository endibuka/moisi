import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signHandoff } from "@/lib/mcp-handoff";

/**
 * Dashboard side of the MCP identity handoff. The MCP OAuth server redirects
 * the user here (with a `return` URL pointing back at itself) when it has no
 * session of its own. Because the user is already signed into the dashboard,
 * we can mint a short-lived signed token proving their identity and bounce them
 * straight back — no second password prompt on the MCP origin.
 *
 * If the user isn't signed into the dashboard either, we chain through the
 * normal /login and come right back here to finish the handoff.
 */

const MCP_ISSUER = (process.env.MCP_ISSUER || "http://localhost:3002").replace(
  /\/$/,
  "",
);
const SECRET =
  process.env.MCP_HANDOFF_SECRET ||
  "dev-only-mcp-handoff-secret-do-not-use-in-production-please";

export async function GET(request: NextRequest) {
  const returnParam = request.nextUrl.searchParams.get("return");
  if (!returnParam) {
    return NextResponse.json({ error: "missing return" }, { status: 400 });
  }

  // Only ever hand a signed identity token back to our own MCP server — never
  // an arbitrary URL an attacker could supply.
  let returnUrl: URL;
  try {
    returnUrl = new URL(returnParam);
  } catch {
    return NextResponse.json({ error: "invalid return" }, { status: 400 });
  }
  if (
    returnUrl.origin !== MCP_ISSUER ||
    !returnUrl.pathname.startsWith("/oauth/")
  ) {
    return NextResponse.json({ error: "untrusted return" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Not signed into the dashboard either — send them through normal login,
    // then straight back here (same URL) to complete the handoff.
    const self = new URL(request.url);
    const login = new URL("/login", request.url);
    login.searchParams.set("next", self.pathname + self.search);
    return NextResponse.redirect(login);
  }

  const token = await signHandoff(SECRET, {
    sub: user.id,
    email: user.email ?? "",
  });
  returnUrl.searchParams.set("handoff", token);
  return NextResponse.redirect(returnUrl);
}
