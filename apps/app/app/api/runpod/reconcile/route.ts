import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRunpodJobStatus, type RunpodStatusResponse } from "@/lib/runpod";

// Anything not terminal for this long is force-failed.
const STALE_MS = 10 * 60 * 1000;

type JobRow = {
  id: string;
  status: "pending" | "processing";
  runpod_id: string | null;
  updated_at: string;
};

/**
 * Sweeps `separation_jobs` rows that never reached a terminal status and
 * reconciles them against RunPod. Triggered by Vercel cron every minute
 * so failures land in our DB even when the webhook can't reach us (tunnel
 * down, dev server stopped, RunPod retries exhausted). A hard 10-minute
 * cutoff catches anything RunPod has also lost track of.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 500 },
    );
  }

  // Vercel cron sends `Authorization: Bearer <CRON_SECRET>`. We also accept
  // the same secret via ?token= for manual triggers (curl, dashboard button).
  const auth = request.headers.get("authorization");
  const token = request.nextUrl.searchParams.get("token");
  if (auth !== `Bearer ${secret}` && token !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - STALE_MS).toISOString();
  const nowIso = () => new Date().toISOString();

  const { data: jobs, error: fetchError } = await admin
    .from("separation_jobs")
    .select("id, status, runpod_id, updated_at")
    .in("status", ["pending", "processing"])
    .returns<JobRow[]>();
  if (fetchError) {
    console.error("Reconcile fetch failed:", fetchError);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }

  const summary = { checked: 0, completed: 0, failed: 0, still_running: 0 };

  for (const job of jobs ?? []) {
    summary.checked += 1;

    // No runpod_id means the action crashed between insert and enqueue.
    // Wait out the cutoff in case it's still mid-flight, then fail.
    if (!job.runpod_id) {
      if (job.updated_at < cutoff) {
        await admin
          .from("separation_jobs")
          .update({
            status: "failed",
            error: "Job never reached the GPU worker (timeout).",
            updated_at: nowIso(),
          })
          .eq("id", job.id);
        summary.failed += 1;
      } else {
        summary.still_running += 1;
      }
      continue;
    }

    let live: RunpodStatusResponse;
    try {
      live = await getRunpodJobStatus(job.runpod_id);
    } catch (err) {
      // Transient RunPod API failure — leave the row alone and try again
      // next tick. The hard cutoff will eventually catch a truly dead job.
      console.error(`Reconcile status check failed for ${job.id}:`, err);
      summary.still_running += 1;
      continue;
    }

    if (live.status === "COMPLETED" && live.output?.stems) {
      await admin
        .from("separation_jobs")
        .update({
          status: "completed",
          stems: live.output.stems,
          updated_at: nowIso(),
        })
        .eq("id", job.id);
      summary.completed += 1;
      continue;
    }

    if (
      live.status === "FAILED" ||
      live.status === "CANCELLED" ||
      live.status === "TIMED_OUT"
    ) {
      await admin
        .from("separation_jobs")
        .update({
          status: "failed",
          error:
            typeof live.error === "string" && live.error.length > 0
              ? live.error
              : `Separation ${live.status.toLowerCase()} on the GPU worker.`,
          updated_at: nowIso(),
        })
        .eq("id", job.id);
      summary.failed += 1;
      continue;
    }

    // Still queued or in progress on RunPod — fail it ourselves once it
    // exceeds the cutoff (RunPod's execution timeout is 600s, so a healthy
    // job has finished well before this fires).
    if (job.updated_at < cutoff) {
      await admin
        .from("separation_jobs")
        .update({
          status: "failed",
          error: `Job exceeded ${STALE_MS / 60000}-minute cutoff (RunPod status: ${live.status}).`,
          updated_at: nowIso(),
        })
        .eq("id", job.id);
      summary.failed += 1;
    } else {
      summary.still_running += 1;
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}
