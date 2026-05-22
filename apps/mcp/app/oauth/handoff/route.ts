import { type NextRequest, NextResponse } from "next/server";
import { getHandoffSecret, getIssuer } from "@/lib/env";
import { verifyHandoff } from "@/lib/handoff";

/**
 * Landing point for the dashboard → MCP identity handoff. The dashboard
 * redirects here with a signed `handoff` token (see /oauth/authorize). We
 * verify it, stash it in a short-lived httpOnly cookie on *this* origin, and
 * forward to the consent screen with a clean URL (token kept out of history).
 * The consent page reads the cookie to learn who the user is — no MCP-origin
 * password login required.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const origin = getIssuer();
  const token = sp.get("handoff");

  // Build the consent URL carrying the original OAuth params (minus the token).
  const consent = new URL("/oauth/consent", origin);
  sp.forEach((v, k) => {
    if (k !== "handoff") consent.searchParams.set(k, v);
  });

  // Missing or bad/expired token: fall back to the MCP password login as a
  // safety net. The happy path never reaches this.
  if (!token || !(await verifyHandoff(getHandoffSecret(), token))) {
    const login = new URL("/oauth/login", origin);
    login.searchParams.set("next", `/oauth/consent?${consent.searchParams}`);
    return NextResponse.redirect(login);
  }

  const res = NextResponse.redirect(consent);
  res.cookies.set("mcp_handoff", token, {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
  return res;
}
