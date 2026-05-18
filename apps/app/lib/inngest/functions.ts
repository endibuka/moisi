import { inngest } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRunpodJobStatus, type RunpodStatusResponse } from "@/lib/runpod";

// Watcher polls RunPod every ~20s for ~15 min; if no terminal status arrives
// in that window the row is force-failed (worker is dead / RunPod lost it).
// 15 min covers the 3-stage pipeline (Mel-Roformer + Demucs + MDX23C + DeEcho)
// for typical 3-5 min songs with comfortable headroom on RunPod's 900s limit.
const POLL_INTERVAL = "20s";
const MAX_POLLS = 45;
const STALE_MS = 15 * 60 * 1000;

const nowIso = () => new Date().toISOString();

type TerminalUpdate =
  | { kind: "completed"; stems: Record<string, string> }
  | { kind: "failed"; error: string };

async function writeTerminal(jobId: string, update: TerminalUpdate) {
  const admin = createAdminClient();
  const payload =
    update.kind === "completed"
      ? { status: "completed" as const, stems: update.stems, updated_at: nowIso() }
      : { status: "failed" as const, error: update.error, updated_at: nowIso() };
  await admin.from("separation_jobs").update(payload).eq("id", jobId);
}

function terminalFromStatus(live: RunpodStatusResponse): TerminalUpdate | null {
  if (live.status === "COMPLETED" && live.output?.stems) {
    return { kind: "completed", stems: live.output.stems };
  }
  if (
    live.status === "FAILED" ||
    live.status === "CANCELLED" ||
    live.status === "TIMED_OUT"
  ) {
    return {
      kind: "failed",
      error:
        typeof live.error === "string" && live.error.length > 0
          ? live.error
          : `Separation ${live.status.toLowerCase()} on the GPU worker.`,
    };
  }
  return null;
}

/**
 * Per-job watcher. Triggered by `app/separation.queued` from the server action
 * that enqueues a separation. Polls RunPod until the job reaches a terminal
 * state, then writes the row. Inngest steps are durable: if Inngest restarts
 * or the function crashes, completed steps are replayed from cache.
 */
export const watchSeparationJob = inngest.createFunction(
  {
    id: "watch-separation-job",
    name: "Watch RunPod separation job",
    // The event itself is the natural dedup key; one watcher per job id.
    idempotency: "event.data.jobId",
    retries: 2,
  },
  { event: "app/separation.queued" },
  async ({ event, step }) => {
    const { jobId, runpodId } = event.data;

    for (let i = 0; i < MAX_POLLS; i++) {
      await step.sleep(`wait-${i}`, i === 0 ? "10s" : POLL_INTERVAL);

      const live = await step.run(`status-${i}`, () =>
        getRunpodJobStatus(runpodId),
      );

      const terminal = terminalFromStatus(live);
      if (terminal) {
        await step.run(`write-${i}`, () => writeTerminal(jobId, terminal));
        return { result: terminal.kind, attempts: i + 1, status: live.status };
      }
    }

    // No terminal status in ~10 minutes — give up.
    await step.run("write-timeout", () =>
      writeTerminal(jobId, {
        kind: "failed",
        error: "Watcher exceeded 10-minute cutoff with no terminal RunPod status.",
      }),
    );
    return { result: "timeout", attempts: MAX_POLLS };
  },
);

type StuckRow = {
  id: string;
  runpod_id: string | null;
  updated_at: string;
};

/**
 * Safety-net cron. Sweeps rows the per-job watcher somehow missed (the watcher
 * could have failed in a way Inngest's retries couldn't recover, or a row was
 * inserted before Inngest was wired up). Runs every 5 min; cheap when there's
 * nothing to do.
 */
export const reconcileStuckJobs = inngest.createFunction(
  { id: "reconcile-stuck-jobs", name: "Reconcile stuck separation jobs" },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    const cutoff = new Date(Date.now() - STALE_MS).toISOString();

    const stuck = await step.run("fetch-stuck", async () => {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("separation_jobs")
        .select("id, runpod_id, updated_at")
        .in("status", ["pending", "processing"])
        .lt("updated_at", cutoff)
        .returns<StuckRow[]>();
      if (error) throw new Error(`fetch stuck failed: ${error.message}`);
      return data ?? [];
    });

    if (stuck.length === 0) return { checked: 0, completed: 0, failed: 0 };

    let completed = 0;
    let failed = 0;

    for (const row of stuck) {
      const live = await step.run(`status-${row.id}`, async () => {
        if (!row.runpod_id) return null;
        try {
          return await getRunpodJobStatus(row.runpod_id);
        } catch {
          return null;
        }
      });

      const update: TerminalUpdate = (() => {
        const terminal = live ? terminalFromStatus(live) : null;
        if (terminal) return terminal;
        return {
          kind: "failed",
          error: row.runpod_id
            ? `Job stalled past ${STALE_MS / 60000}-minute cutoff (RunPod status: ${live?.status ?? "unknown"}).`
            : "Job never reached the GPU worker (timeout).",
        };
      })();

      await step.run(`write-${row.id}`, () => writeTerminal(row.id, update));
      if (update.kind === "completed") completed += 1;
      else failed += 1;
    }

    return { checked: stuck.length, completed, failed };
  },
);

export const functions = [watchSeparationJob, reconcileStuckJobs];
