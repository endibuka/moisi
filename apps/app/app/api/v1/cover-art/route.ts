import type { NextRequest } from "next/server";
import { jsonError, jsonOk, requireAuth } from "@/app/api/v1/_lib";
import { generateCoverArtForUser } from "@/lib/cover-art-service";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /v1/cover-art
 *
 * Body:
 *   {
 *     "jobId": string,         // an existing separation OR song job
 *     "prompt"?: string        // optional creative direction (mood, palette, motifs)
 *   }
 *
 * Generates a cover image for the referenced job, uploads it to storage,
 * links the path to the job row's `cover_art_path`, and returns a signed
 * URL (1h TTL).
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("fail" in auth) return auth.fail;

  let body: { jobId?: string; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "invalid_request", "Body must be valid JSON.");
  }
  if (typeof body.jobId !== "string" || !body.jobId.trim()) {
    return jsonError(400, "invalid_request", "`jobId` is required.");
  }
  if (body.prompt !== undefined && typeof body.prompt !== "string") {
    return jsonError(
      400,
      "invalid_request",
      "`prompt` must be a string if provided.",
    );
  }
  if (body.prompt && body.prompt.length > 500) {
    return jsonError(
      400,
      "invalid_request",
      "`prompt` is too long (max 500 chars).",
    );
  }

  const result = await generateCoverArtForUser({
    userId: auth.userId,
    jobId: body.jobId.trim(),
    userPrompt: body.prompt ?? null,
  });

  if (!("ok" in result)) {
    const status = result.status ?? 500;
    const code =
      status === 404
        ? "not_found"
        : status >= 500
          ? "internal_error"
          : "invalid_request";
    return jsonError(status, code, result.error);
  }

  return jsonOk(
    {
      jobId: body.jobId.trim(),
      path: result.path,
      url: result.signedUrl,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    { status: 201 },
  );
}
