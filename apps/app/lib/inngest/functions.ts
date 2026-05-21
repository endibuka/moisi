import { inngest } from "./client";
import { generateCoverArtForUser } from "@/lib/cover-art-service";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  endpointKindForJobType,
  getRunpodJobStatus,
  type RunpodEndpointKind,
  type RunpodStatusResponse,
  type TrackAnalysis,
} from "@/lib/runpod";

// Watcher polls RunPod every ~20s; budget per kind:
//   separation  — 15 min (3-stage Mel-Roformer + Demucs + MDX23C + DeEcho on
//                 a typical 3-5 min song; RunPod hard-limits worker runtime
//                 at 900s anyway).
//   music_gen   — 25 min (YuE cold start pulls a ~30 GB image and loads a
//                 7B + 1B LM pair on first job; 6-segment songs push 8-12 min
//                 of pure inference on top).
const POLL_INTERVAL = "20s";
const MAX_POLLS_BY_KIND: Record<RunpodEndpointKind, number> = {
  separation: 45,
  music_gen: 75,
};
const STALE_MS_BY_KIND: Record<RunpodEndpointKind, number> = {
  separation: 15 * 60 * 1000,
  music_gen: 25 * 60 * 1000,
};

const nowIso = () => new Date().toISOString();

type TerminalUpdate =
  | {
      kind: "completed";
      stems: Record<string, string>;
      analysis?: TrackAnalysis;
    }
  | { kind: "failed"; error: string };

async function writeTerminal(jobId: string, update: TerminalUpdate) {
  const admin = createAdminClient();
  const payload =
    update.kind === "completed"
      ? {
          status: "completed" as const,
          stems: update.stems,
          // Worker may omit analysis on librosa failure — only set the column
          // when we actually have data, never blow away an existing value.
          ...(update.analysis ? { analysis: update.analysis } : {}),
          updated_at: nowIso(),
        }
      : { status: "failed" as const, error: update.error, updated_at: nowIso() };
  await admin.from("separation_jobs").update(payload).eq("id", jobId);
}

function terminalFromStatus(live: RunpodStatusResponse): TerminalUpdate | null {
  if (live.status === "COMPLETED" && live.output?.stems) {
    return {
      kind: "completed",
      stems: live.output.stems,
      analysis: live.output.analysis,
    };
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
    const endpointKind: RunpodEndpointKind = event.data.endpointKind ?? "separation";
    const maxPolls = MAX_POLLS_BY_KIND[endpointKind];

    for (let i = 0; i < maxPolls; i++) {
      await step.sleep(`wait-${i}`, i === 0 ? "10s" : POLL_INTERVAL);

      const live = await step.run(`status-${i}`, () =>
        getRunpodJobStatus(runpodId, endpointKind),
      );

      const terminal = terminalFromStatus(live);
      if (terminal) {
        await step.run(`write-${i}`, () => writeTerminal(jobId, terminal));
        // Music-gen tracks get an auto-cover so the library row isn't a blank
        // gradient. Fire-and-forget — the dedicated function below handles
        // failures + retries independently of this watcher's lifecycle.
        if (
          terminal.kind === "completed" &&
          endpointKind === "music_gen"
        ) {
          await step.sendEvent(`cover-${i}`, {
            name: "app/cover.requested",
            data: { jobId },
          });
        }
        return { result: terminal.kind, attempts: i + 1, status: live.status };
      }
    }

    const budgetMin = Math.round((maxPolls * 20) / 60);
    await step.run("write-timeout", () =>
      writeTerminal(jobId, {
        kind: "failed",
        error: `Watcher exceeded ${budgetMin}-minute cutoff with no terminal RunPod status.`,
      }),
    );
    return { result: "timeout", attempts: maxPolls };
  },
);

type StuckRow = {
  id: string;
  runpod_id: string | null;
  updated_at: string;
  job_type: string | null;
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
    // Pull every in-flight job past the SHORTER of the two budgets, then
    // filter to each row's own per-kind cutoff below — keeps the SQL simple
    // while still respecting the longer music-gen budget.
    const minStaleMs = Math.min(
      STALE_MS_BY_KIND.separation,
      STALE_MS_BY_KIND.music_gen,
    );
    const cutoff = new Date(Date.now() - minStaleMs).toISOString();

    const candidates = await step.run("fetch-stuck", async () => {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("separation_jobs")
        .select("id, runpod_id, updated_at, job_type")
        .in("status", ["pending", "processing"])
        .lt("updated_at", cutoff)
        .returns<StuckRow[]>();
      if (error) throw new Error(`fetch stuck failed: ${error.message}`);
      return data ?? [];
    });

    const now = Date.now();
    const stuck = candidates.filter((row) => {
      const kind = endpointKindForJobType(row.job_type);
      const age = now - new Date(row.updated_at).getTime();
      return age >= STALE_MS_BY_KIND[kind];
    });

    if (stuck.length === 0) return { checked: 0, completed: 0, failed: 0 };

    let completed = 0;
    let failed = 0;

    for (const row of stuck) {
      const live = await step.run(`status-${row.id}`, async () => {
        if (!row.runpod_id) return null;
        try {
          return await getRunpodJobStatus(
            row.runpod_id,
            endpointKindForJobType(row.job_type),
          );
        } catch {
          return null;
        }
      });

      const update: TerminalUpdate = (() => {
        const terminal = live ? terminalFromStatus(live) : null;
        if (terminal) return terminal;
        const cutoffMin = Math.round(
          STALE_MS_BY_KIND[endpointKindForJobType(row.job_type)] / 60000,
        );
        return {
          kind: "failed",
          error: row.runpod_id
            ? `Job stalled past ${cutoffMin}-minute cutoff (RunPod status: ${live?.status ?? "unknown"}).`
            : "Job never reached the GPU worker (timeout).",
        };
      })();

      await step.run(`write-${row.id}`, () => writeTerminal(row.id, update));
      if (update.kind === "completed") {
        completed += 1;
        // Same auto-cover hook the watcher uses, in case the reconciler is
        // the path that wrote `completed` (rare: watcher missed it).
        if (endpointKindForJobType(row.job_type) === "music_gen") {
          await step.sendEvent(`cover-${row.id}`, {
            name: "app/cover.requested",
            data: { jobId: row.id },
          });
        }
      } else {
        failed += 1;
      }
    }

    return { checked: stuck.length, completed, failed };
  },
);

/**
 * Auto-generate a cover for a freshly-completed music-gen track. The user's
 * style prompt is the perfect raw material for Gemini, so we feed it back as
 * the cover prompt and link the result to the row. Failures are logged but
 * NEVER bubble up — a missing cover is a cosmetic regression, not a song one.
 */
export const generateMusicGenCover = inngest.createFunction(
  {
    id: "generate-music-gen-cover",
    name: "Auto-generate cover art for music-gen track",
    // One cover per job; if the event fires twice (watcher + reconciler race)
    // the second call no-ops at Inngest's idempotency layer.
    idempotency: "event.data.jobId",
    retries: 1,
  },
  { event: "app/cover.requested" },
  async ({ event, step }) => {
    const { jobId } = event.data;

    const job = await step.run("fetch-job", async () => {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("separation_jobs")
        .select("id, user_id, prompt, cover_art_path, status")
        .eq("id", jobId)
        .maybeSingle();
      if (error) throw new Error(`fetch-job failed: ${error.message}`);
      return data;
    });

    if (!job) return { skipped: "job-not-found" };
    if (job.status !== "completed") return { skipped: "not-completed" };
    if (job.cover_art_path) return { skipped: "already-has-cover" };

    const result = await step.run("generate", () =>
      generateCoverArtForUser({
        userId: job.user_id,
        jobId: job.id,
        // Reuse the music-gen style prompt as the cover prompt — the user
        // already described the mood/genre, so we get a thematically-aligned
        // image without asking for input again.
        userPrompt: job.prompt ?? null,
      }),
    );

    if ("error" in result) {
      // Non-fatal — leave the row coverless and move on.
      console.error("[auto-cover] generation failed:", result.error);
      return { ok: false, error: result.error };
    }
    return { ok: true, path: result.path };
  },
);

export const functions = [
  watchSeparationJob,
  reconcileStuckJobs,
  generateMusicGenCover,
];
