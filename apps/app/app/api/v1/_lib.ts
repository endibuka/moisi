import "server-only";

import type { NextRequest } from "next/server";
import { authenticateApiKey } from "@/app/actions/api-keys";
import { API_KEY_PREFIX, looksLikeApiKey } from "@/lib/api-keys";

/**
 * Public API helpers shared by all /api/v1/* routes:
 *
 *   - `requireAuth(req)` extracts + validates the API key, returns the user
 *     id or a Response (401) the handler should return immediately.
 *   - `jsonError(status, code, message)` produces the consistent error
 *     envelope documented in docs/errors.mdx.
 *   - `jsonOk(body, init?)` for success responses.
 *
 * The error shape is deliberately Stripe-flavored: `{ error: { code, message } }`.
 * Clients can switch on `error.code`; humans read `error.message`.
 */
export type ApiErrorCode =
  | "missing_api_key"
  | "invalid_api_key"
  | "revoked_api_key"
  | "invalid_request"
  | "forbidden"
  | "not_found"
  | "internal_error";

export function jsonOk(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export function jsonError(
  status: number,
  code: ApiErrorCode,
  message: string,
): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Returns `{ userId }` on success or a Response the caller should propagate.
 *
 * Accepts the key from either:
 *   - `Authorization: Bearer mk_live_...`
 *   - `X-Api-Key: mk_live_...`  (some HTTP clients are awkward with Bearer)
 */
export async function requireAuth(
  req: NextRequest,
): Promise<{ userId: string; keyId: string } | { fail: Response }> {
  const bearer = req.headers.get("authorization");
  let token: string | null = null;
  if (bearer?.toLowerCase().startsWith("bearer ")) {
    token = bearer.slice("bearer ".length).trim();
  } else {
    token = req.headers.get("x-api-key");
  }

  if (!token) {
    return {
      fail: jsonError(
        401,
        "missing_api_key",
        `Missing API key. Send "Authorization: Bearer ${API_KEY_PREFIX}…" or "X-Api-Key: ${API_KEY_PREFIX}…".`,
      ),
    };
  }
  if (!looksLikeApiKey(token)) {
    return {
      fail: jsonError(
        401,
        "invalid_api_key",
        `API key is malformed. Expected the format "${API_KEY_PREFIX}<64 hex chars>".`,
      ),
    };
  }

  const result = await authenticateApiKey(token);
  if ("error" in result) {
    if (result.error === "revoked") {
      return {
        fail: jsonError(
          401,
          "revoked_api_key",
          "This API key has been revoked. Create a new one in Settings → API.",
        ),
      };
    }
    return {
      fail: jsonError(401, "invalid_api_key", "API key is invalid."),
    };
  }
  return { userId: result.userId, keyId: result.keyId };
}
