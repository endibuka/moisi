import type { NextRequest } from "next/server";
import { jsonError, jsonOk, requireAuth } from "@/app/api/v1/_lib";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * POST /v1/uploads
 *
 * Body: { filename: string }
 * Returns: { path, uploadUrl, expiresAt }
 *
 * The client PUTs the audio file directly to `uploadUrl`, then passes the
 * returned `path` to POST /v1/separations.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("fail" in auth) return auth.fail;

  let body: { filename?: string };
  try {
    body = (await req.json()) as { filename?: string };
  } catch {
    return jsonError(400, "invalid_request", "Body must be valid JSON.");
  }

  const filename = body.filename?.trim();
  if (!filename) {
    return jsonError(400, "invalid_request", "`filename` is required.");
  }

  const safeName = filename.replace(/[^\w.\-]+/g, "_");
  const path = `${auth.userId}/${crypto.randomUUID()}/${safeName}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("uploads")
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[v1/uploads] error:", error);
    return jsonError(
      500,
      "internal_error",
      "Could not create a signed upload URL.",
    );
  }

  return jsonOk({
    path,
    uploadUrl: data.signedUrl,
    token: data.token,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
}
