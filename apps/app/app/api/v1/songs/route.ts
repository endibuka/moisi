import type { NextRequest } from "next/server";
import { jsonError, jsonOk, requireAuth } from "@/app/api/v1/_lib";
import { generateMusicForUser } from "@/lib/music-gen-service";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * POST /v1/songs
 *
 * Body:
 *   {
 *     "genre":   string (4-500 chars, required) — style / genre prompt
 *     "lyrics":  string (0-4000 chars, optional) — empty / omitted = instrumental
 *     "nSegments"?: number (1-6, default 2) — each segment ~30 s
 *     "title"?: string (max 80 chars) — display name
 *   }
 *
 * Returns the created job (status `pending`/`processing`). Poll
 * GET /v1/songs/{id} until `status === "completed"`.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("fail" in auth) return auth.fail;

  let body: {
    genre?: string;
    lyrics?: string;
    nSegments?: number;
    title?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "invalid_request", "Body must be valid JSON.");
  }

  if (typeof body.genre !== "string" || !body.genre.trim()) {
    return jsonError(400, "invalid_request", "`genre` is required.");
  }
  if (body.lyrics !== undefined && typeof body.lyrics !== "string") {
    return jsonError(
      400,
      "invalid_request",
      "`lyrics` must be a string if provided.",
    );
  }
  if (body.nSegments !== undefined && typeof body.nSegments !== "number") {
    return jsonError(
      400,
      "invalid_request",
      "`nSegments` must be a number if provided.",
    );
  }

  const result = await generateMusicForUser({
    userId: auth.userId,
    genre: body.genre,
    lyrics: body.lyrics,
    nSegments: body.nSegments,
    title: body.title,
  });
  if ("error" in result) {
    return jsonError(400, "invalid_request", result.error);
  }

  const admin = createAdminClient();
  const { data: job } = await admin
    .from("separation_jobs")
    .select(
      "id, status, original_name, prompt, lyrics, error, created_at, updated_at, duration_seconds, job_type",
    )
    .eq("id", result.jobId)
    .single();

  return jsonOk(job, { status: 201 });
}

/**
 * GET /v1/songs?limit=50&cursor=<created_at>
 *
 * Lists the caller's generated songs, newest first. Same cursor model as
 * GET /v1/separations.
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
      "id, status, original_name, prompt, lyrics, stems, error, created_at, updated_at, duration_seconds, job_type",
    )
    .eq("user_id", auth.userId)
    .eq("job_type", "music_generation")
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) query = query.lt("created_at", cursor);

  const { data, error } = await query;
  if (error) {
    console.error("[v1/songs] list error:", error);
    return jsonError(500, "internal_error", "Could not list songs.");
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].created_at : null;

  return jsonOk({ data: items, next_cursor: nextCursor });
}
