import type { NextRequest } from "next/server";
import { jsonError, jsonOk, requireAuth } from "@/app/api/v1/_lib";
import { startSeparationForUser } from "@/lib/separation-service";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Music generation has its own RunPod endpoint + flow and is not exposed via
// the public separation API yet.
type StemSplitJobType = "separation" | "vocal_isolation";
const ALLOWED_JOB_TYPES: StemSplitJobType[] = [
  "separation",
  "vocal_isolation",
];

/**
 * POST /v1/separations
 *
 * Body:
 *   {
 *     "inputPath": "uploads/<uuid>/<file>",   // from POST /v1/uploads
 *     "originalName": "song.mp3",
 *     "durationSeconds"?: number,
 *     "jobType"?: "separation" | "vocal_isolation"
 *   }
 *
 * Returns the created job in the same shape as GET /v1/separations/{id}.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("fail" in auth) return auth.fail;

  let body: {
    inputPath?: string;
    originalName?: string;
    durationSeconds?: number;
    jobType?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "invalid_request", "Body must be valid JSON.");
  }

  if (!body.inputPath?.trim()) {
    return jsonError(400, "invalid_request", "`inputPath` is required.");
  }
  if (!body.originalName?.trim()) {
    return jsonError(400, "invalid_request", "`originalName` is required.");
  }
  if (
    body.jobType &&
    !ALLOWED_JOB_TYPES.includes(body.jobType as StemSplitJobType)
  ) {
    return jsonError(
      400,
      "invalid_request",
      `\`jobType\` must be one of: ${ALLOWED_JOB_TYPES.join(", ")}.`,
    );
  }

  const result = await startSeparationForUser({
    userId: auth.userId,
    inputPath: body.inputPath.trim(),
    originalName: body.originalName.trim(),
    durationSeconds:
      typeof body.durationSeconds === "number" ? body.durationSeconds : null,
    jobType: (body.jobType as StemSplitJobType | undefined) ?? "separation",
  });

  if ("error" in result) {
    return jsonError(400, "invalid_request", result.error);
  }

  // Return the full job row so callers don't need a follow-up GET.
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("separation_jobs")
    .select(
      "id, status, original_name, input_path, stems, error, created_at, updated_at, duration_seconds, job_type",
    )
    .eq("id", result.jobId)
    .single();

  return jsonOk(job, { status: 201 });
}

/**
 * GET /v1/separations?limit=50&cursor=<created_at>
 *
 * Lists the caller's jobs, newest first. Cursor pagination via created_at —
 * pass `cursor` from the previous response's `next_cursor` to get the next page.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("fail" in auth) return auth.fail;

  const url = new URL(req.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1),
    100,
  );
  const cursor = url.searchParams.get("cursor");

  const admin = createAdminClient();
  let query = admin
    .from("separation_jobs")
    .select(
      "id, status, original_name, input_path, stems, error, created_at, updated_at, duration_seconds, job_type",
    )
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(limit + 1); // fetch one extra to detect if there's a next page

  if (cursor) query = query.lt("created_at", cursor);

  const { data, error } = await query;
  if (error) {
    console.error("[v1/separations] list error:", error);
    return jsonError(500, "internal_error", "Could not list separations.");
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].created_at : null;

  return jsonOk({ data: items, next_cursor: nextCursor });
}
