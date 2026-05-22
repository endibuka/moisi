import type { CookieOptions } from "@supabase/ssr";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Routes reachable without an authenticated session. */
const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/api", // API routes handle their own auth (e.g. the RunPod webhook token)
];

const isPublic = (pathname: string) =>
  PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

/**
 * Refreshes the Supabase session on every request and guards routes.
 * Runs from `proxy.ts` (the Next.js 16 successor to middleware).
 *
 * After validating the JWT once here, we forward the verified user info to
 * downstream RSCs via request headers (`x-user-*`). This lets layouts/pages
 * read the user without each re-issuing a `supabase.auth.getUser()` network
 * call — the biggest hidden cost on every navigation.
 */
export async function updateSession(request: NextRequest) {
  // Start from the incoming request headers, but strip any client-supplied
  // forwarded-user headers so a malicious request can't spoof identity.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-user-id");
  requestHeaders.delete("x-user-email");
  requestHeaders.delete("x-user-name");

  // Cookies Supabase wants to set during session refresh — applied after we
  // construct the final response with the updated headers.
  const cookiesToSet: {
    name: string;
    value: string;
    options?: CookieOptions;
  }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          for (const { name, value, options } of toSet) {
            request.cookies.set(name, value);
            cookiesToSet.push({ name, value, options });
          }
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Unauthenticated users may only see public (auth) routes.
  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated users should not sit on the entry auth pages.
  if (
    user &&
    ["/login", "/signup", "/forgot-password"].some((p) => pathname === p)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Forward the verified user to RSCs. encodeURIComponent so non-ASCII names
  // (emoji, unicode) survive HTTP header encoding; the helper decodes.
  if (user) {
    requestHeaders.set("x-user-id", user.id);
    requestHeaders.set("x-user-email", user.email ?? "");
    const fullName =
      (user.user_metadata?.full_name as string | undefined) ?? "";
    requestHeaders.set("x-user-name", encodeURIComponent(fullName));
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  for (const { name, value, options } of cookiesToSet) {
    response.cookies.set(name, value, options);
  }
  return response;
}
