/**
 * Stateless, HMAC-signed identity handoff between the Moisi dashboard and this
 * MCP OAuth server.
 *
 * The two apps run on different origins (and in prod on different Public-Suffix
 * subdomains), so they can't share the Supabase session cookie. Instead the
 * dashboard — where the user is already signed in — mints a short-lived token
 * proving who the user is, and we verify it here with the same shared secret.
 * No DB, no network round-trip. Keep this file byte-identical to the dashboard
 * copy at apps/app/lib/mcp-handoff.ts.
 */

const TTL_SECONDS = 300; // 5 min — long enough to bounce through login, no more.

export type HandoffPayload = {
  sub: string; // Supabase user id
  email: string;
  exp: number; // unix seconds
};

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signHandoff(
  secret: string,
  identity: { sub: string; email: string },
): Promise<string> {
  const payload: HandoffPayload = {
    sub: identity.sub,
    email: identity.email,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = b64url(await hmac(secret, body));
  return `${body}.${sig}`;
}

export async function verifyHandoff(
  secret: string,
  token: string,
): Promise<HandoffPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = await hmac(secret, body);
  if (!timingSafeEqual(b64urlDecode(sig), expected)) return null;

  let payload: HandoffPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
  } catch {
    return null;
  }
  if (typeof payload.sub !== "string" || typeof payload.exp !== "number") {
    return null;
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
