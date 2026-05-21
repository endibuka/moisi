import type { NextRequest } from "next/server";
import { jsonError, jsonOk, requireAuth } from "@/app/api/v1/_lib";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /v1/songs/{id}
 *
 * Returns a music-generation job by id. When `status === "completed"` the
 * response includes `audio_url` — a signed URL (1h TTL) for the generated
 * track. Refresh by calling this endpoint again.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if ("fail" in auth) return auth.fail;

  const { id } = await ctx.params;
  if (!id) return jsonError(400, "invalid_request", "Job id is required.");

  const admin = createAdminClient();
  const { data: job, error } = await admin
    .from("separation_jobs")
    .select(
      "id, user_id, status, original_name, prompt, lyrics, stems, cover_art_path, error, created_at, updated_at, duration_seconds, job_type",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[v1/songs/:id] error:", error);
    return jsonError(500, "internal_error", "Could not load the job.");
  }
  if (!job) return jsonError(404, "not_found", "Song not found.");
  if (job.user_id !== auth.userId) {
    return jsonError(404, "not_found", "Song not found.");
  }
  if (job.job_type !== "music_generation") {
    // Wrong endpoint — caller should use /v1/separations/{id}. Return 404
    // so the boundary between the two resources is clean.
    return jsonError(404, "not_found", "Song not found.");
  }

  // Generated track lives at `stems/{user_id}/{job_id}/generated.mp3`. The
  // worker writes it into the `stems` jsonb as `{ generated: "<path>" }`.
  let audioUrl: string | null = null;
  if (job.status === "completed" && job.stems) {
    const stemMap = job.stems as Record<string, string>;
    const path = stemMap.generated ?? stemMap.mp3 ?? stemMap.audio;
    if (path) {
      const { data: signed } = await admin.storage
        .from("stems")
        .createSignedUrl(path, 60 * 60);
      audioUrl = signed?.signedUrl ?? null;
    }
  }

  let coverArtUrl: string | null = null;
  if (job.cover_art_path) {
    const { data: signed } = await admin.storage
      .from("stems")
      .createSignedUrl(job.cover_art_path, 60 * 60);
    coverArtUrl = signed?.signedUrl ?? null;
  }

  const publicFields = { ...job };
  delete (publicFields as { user_id?: string }).user_id;
  return jsonOk({
    ...publicFields,
    audio_url: audioUrl,
    cover_art_url: coverArtUrl,
  });
}
