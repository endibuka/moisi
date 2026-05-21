import { startRunpodSeparation } from "./runpod";
import { createAdminClient } from "./supabase";

type ToolContext = { userId: string };

type Tool = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  handler: (input: any, ctx: ToolContext) => Promise<unknown>;
};

/* ---- tool: start_separation ---- */

const startSeparation: Tool = {
  name: "start_separation",
  description:
    "Submit an audio file (by signed URL) to the GPU worker for stem separation. " +
    "Returns a job_id you can poll with get_job_status. Pipeline: " +
    "Mel-Roformer + htdemucs_6s + MDX23C + DeEcho-DeReverb.",
  inputSchema: {
    type: "object",
    properties: {
      audio_url: {
        type: "string",
        description:
          "HTTPS URL the GPU worker can download (signed Supabase URL or any public audio).",
      },
      original_name: {
        type: "string",
        description: "Display name for the track (e.g. 'My Song.mp3').",
      },
    },
    required: ["audio_url", "original_name"],
    additionalProperties: false,
  },
  handler: async (input, ctx) => {
    const audio_url = String(input.audio_url);
    const original_name = String(input.original_name);
    const admin = createAdminClient();

    // 1. Insert the job row so we have an id to echo back to the worker.
    const { data: job, error } = await admin
      .from("separation_jobs")
      .insert({
        user_id: ctx.userId,
        original_name,
        input_path: `mcp/${audio_url}`,
      })
      .select("id")
      .single();
    if (error || !job) {
      throw new Error(
        `Could not create job: ${error?.message ?? "insert returned no row"}`,
      );
    }

    // 2. Hand it to RunPod.
    const runpodId = await startRunpodSeparation({
      audio_url,
      output_prefix: `${ctx.userId}/${job.id}`,
      job_id: job.id,
    });

    // 3. Flip the row to processing so the watcher (or webhook) can pick it up.
    await admin
      .from("separation_jobs")
      .update({
        status: "processing",
        runpod_id: runpodId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return { job_id: job.id, runpod_id: runpodId, status: "processing" };
  },
};

/* ---- tool: list_jobs ---- */

const listJobs: Tool = {
  name: "list_jobs",
  description:
    "List the authenticated user's recent stem-separation jobs, newest first.",
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "integer",
        description: "How many jobs to return (1-50, default 10).",
        minimum: 1,
        maximum: 50,
      },
      status: {
        type: "string",
        enum: ["pending", "processing", "completed", "failed"],
        description: "Optional filter on job status.",
      },
    },
    additionalProperties: false,
  },
  handler: async (input, ctx) => {
    const limit = Math.min(50, Math.max(1, Number(input?.limit ?? 10)));
    const admin = createAdminClient();
    let q = admin
      .from("separation_jobs")
      .select("id, status, original_name, error, created_at, duration_seconds")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (input?.status) q = q.eq("status", String(input.status));
    const { data, error } = await q;
    if (error) throw new Error(`list_jobs query failed: ${error.message}`);
    return { jobs: data ?? [] };
  },
};

/* ---- tool: get_job_status ---- */

const getJobStatus: Tool = {
  name: "get_job_status",
  description:
    "Look up one job by id. Includes status, stems map (if completed), and any error message.",
  inputSchema: {
    type: "object",
    properties: {
      job_id: { type: "string", description: "UUID of the separation_jobs row." },
    },
    required: ["job_id"],
    additionalProperties: false,
  },
  handler: async (input, ctx) => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("separation_jobs")
      .select("*")
      .eq("id", String(input.job_id))
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (error) throw new Error(`get_job_status failed: ${error.message}`);
    if (!data) throw new Error(`Job ${input.job_id} not found`);
    return data;
  },
};

/* ---- tool: get_stem_url ---- */

const STEM_NAMES = [
  "vocals",
  "vocals_acapella",
  "drums",
  "bass",
  "guitar",
  "piano",
  "other",
] as const;

const getStemUrl: Tool = {
  name: "get_stem_url",
  description:
    "Get a short-lived signed URL for one stem of a completed job. Valid for ~1 hour.",
  inputSchema: {
    type: "object",
    properties: {
      job_id: { type: "string", description: "UUID of the completed job." },
      stem: {
        type: "string",
        enum: [...STEM_NAMES],
        description: "Which stem to fetch.",
      },
    },
    required: ["job_id", "stem"],
    additionalProperties: false,
  },
  handler: async (input, ctx) => {
    const admin = createAdminClient();
    const { data: job, error } = await admin
      .from("separation_jobs")
      .select("id, status, stems, user_id")
      .eq("id", String(input.job_id))
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (error) throw new Error(`lookup failed: ${error.message}`);
    if (!job) throw new Error(`Job ${input.job_id} not found`);
    if (job.status !== "completed" || !job.stems) {
      throw new Error(
        `Job is ${job.status}; stems are only available once status='completed'.`,
      );
    }
    const stems = job.stems as Record<string, string | undefined>;
    const path = stems[String(input.stem)];
    if (!path) throw new Error(`Stem '${input.stem}' is not present on this job.`);
    const { data: signed, error: signError } = await admin.storage
      .from("stems")
      .createSignedUrl(path, 60 * 60);
    if (signError || !signed) {
      throw new Error(`Could not sign stem URL: ${signError?.message ?? "unknown"}`);
    }
    return { stem: input.stem, url: signed.signedUrl, expires_in: 3600 };
  },
};

export const TOOLS: Tool[] = [
  startSeparation,
  listJobs,
  getJobStatus,
  getStemUrl,
];

export function findTool(name: string): Tool | undefined {
  return TOOLS.find((t) => t.name === name);
}
