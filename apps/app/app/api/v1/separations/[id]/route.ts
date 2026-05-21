import type { NextRequest } from "next/server";
import { jsonError, jsonOk, requireAuth } from "@/app/api/v1/_lib";
import { STEM_NAMES, type StemName } from "@/lib/separation";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /v1/separations/{id}
 *
 * Returns the job. If the job is `completed`, the response also includes a
 * `stem_urls` object — signed download URLs (1h TTL) for each stem the job
 * produced. Poll this endpoint until `status === "completed"`.
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
      "id, user_id, status, original_name, input_path, stems, cover_art_path, error, created_at, updated_at, duration_seconds, job_type",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[v1/separations/:id] error:", error);
    return jsonError(500, "internal_error", "Could not load the job.");
  }
  if (!job) return jsonError(404, "not_found", "Separation not found.");
  // Key-based auth bypasses RLS, so enforce ownership in code.
  if (job.user_id !== auth.userId) {
    return jsonError(404, "not_found", "Separation not found.");
  }

  // For completed jobs, batch-sign the stem URLs so the caller gets
  // everything they need in one response.
  let stemUrls: Partial<Record<StemName, string>> | null = null;
  if (job.status === "completed" && job.stems) {
    const stemMap = job.stems as Partial<Record<StemName, string>>;
    const pathToName = new Map<string, StemName>();
    const paths: string[] = [];
    for (const name of STEM_NAMES) {
      const p = stemMap[name];
      if (p) {
        paths.push(p);
        pathToName.set(p, name);
      }
    }
    if (paths.length) {
      const { data: signed } = await admin.storage
        .from("stems")
        .createSignedUrls(paths, 60 * 60);
      stemUrls = {};
      for (const row of signed ?? []) {
        const name = row.path ? pathToName.get(row.path) : undefined;
        if (name) stemUrls[name] = row.signedUrl ?? undefined;
      }
    }
  }

  // Cover art is optional. If a path is set, mint a fresh signed URL.
  let coverArtUrl: string | null = null;
  if (job.cover_art_path) {
    const { data: signed } = await admin.storage
      .from("stems")
      .createSignedUrl(job.cover_art_path, 60 * 60);
    coverArtUrl = signed?.signedUrl ?? null;
  }

  // Strip user_id from the public response shape — it's an internal field
  // and we don't echo it back to API clients.
  const publicFields = { ...job };
  delete (publicFields as { user_id?: string }).user_id;
  return jsonOk({
    ...publicFields,
    stem_urls: stemUrls,
    cover_art_url: coverArtUrl,
  });
}
