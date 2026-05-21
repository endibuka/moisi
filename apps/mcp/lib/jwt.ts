import { SignJWT, jwtVerify } from "jose";
import { getIssuer, getJwtSecret } from "./env";

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

export type AccessTokenClaims = {
  sub: string; // user_id
  client_id: string;
  scope: string;
  exp: number;
  iat: number;
  iss: string;
  aud: string; // the resource (us)
};

/** Sign an MCP access token for a user. */
export async function signAccessToken(
  userId: string,
  clientId: string,
  scope = "mcp:read mcp:write",
): Promise<string> {
  const issuer = getIssuer();
  return await new SignJWT({ client_id: clientId, scope })
    .setProtectedHeader({ alg: "HS256", typ: "at+jwt" })
    .setSubject(userId)
    .setIssuer(issuer)
    .setAudience(issuer)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenClaims> {
  const issuer = getIssuer();
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    issuer,
    audience: issuer,
  });
  if (typeof payload.sub !== "string" || typeof payload.client_id !== "string") {
    throw new Error("Malformed access token");
  }
  return payload as AccessTokenClaims;
}

export const accessTokenTtl = ACCESS_TOKEN_TTL_SECONDS;
