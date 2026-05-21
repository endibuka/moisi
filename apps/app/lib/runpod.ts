const RUNPOD_BASE = "https://api.runpod.ai/v2";

/**
 * Which RunPod endpoint a job lives on. Music-gen runs on YuE, everything
 * else (separation, vocal-isolation) on the audio-separator endpoint. The
 * Inngest watcher needs this to know which endpoint to /status against —
 * polling the wrong endpoint returns 404 and jobs hang as "processing".
 */
export type RunpodEndpointKind = "separation" | "music_gen";

function endpointIdFor(kind: RunpodEndpointKind): string {
  const envVar =
    kind === "music_gen" ? "RUNPOD_YUE_ENDPOINT_ID" : "RUNPOD_ENDPOINT_ID";
  const value = process.env[envVar];
  if (!value) {
    throw new Error(`${envVar} is not configured.`);
  }
  return value;
}

function endpointKindForJobType(
  jobType: string | undefined | null,
): RunpodEndpointKind {
  return jobType === "music_generation" ? "music_gen" : "separation";
}

export type SeparationInput = {
  audio_url: string;
  output_prefix: string;
  job_id: string;
  /** Worker branches on this. Default 'separation' (7 stems);
      'vocal_isolation' is the 2-stem fast path. */
  job_type?: "separation" | "vocal_isolation";
};

export type YueInput = {
  genre: string;
  lyrics: string;
  n_segments: number;
  output_prefix: string;
  job_id: string;
};

/**
 * Queue a YuE music-generation job. YuE accepts a genre prompt + (optionally
 * empty) structured lyrics and generates a multi-minute song with vocals.
 */
export async function startRunpodMusicGen(input: YueInput): Promise<string> {
  const endpoint = process.env.RUNPOD_YUE_ENDPOINT_ID;
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!endpoint || !apiKey) {
    throw new Error(
      "RUNPOD_YUE_ENDPOINT_ID + RUNPOD_API_KEY must be set to use Music Generator.",
    );
  }
  const res = await fetch(`${RUNPOD_BASE}/${endpoint}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) {
    throw new Error(`RunPod /run failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("RunPod /run returned no job id.");
  return data.id;
}

/**
 * Queues a separation job on the RunPod serverless endpoint and returns the
 * RunPod job id. Completion is tracked by the Inngest `watchSeparationJob`
 * function polling `/status`; we no longer rely on a RunPod webhook.
 */
export async function startRunpodSeparation(
  input: SeparationInput,
): Promise<string> {
  const endpoint = process.env.RUNPOD_ENDPOINT_ID;
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!endpoint || !apiKey) {
    throw new Error("RunPod env vars are not configured.");
  }

  const res = await fetch(`${RUNPOD_BASE}/${endpoint}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input }),
  });

  if (!res.ok) {
    throw new Error(`RunPod /run failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("RunPod /run returned no job id.");
  return data.id;
}

export type RunpodStatus =
  | "IN_QUEUE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "TIMED_OUT";

export type TrackAnalysis = {
  bpm: number | null;
  key: string;
  mode: "major" | "minor";
  duration_seconds: number;
  loudness_db: number;
  spectral_centroid_hz: number;
  energy: number;
};

export type RunpodStatusResponse = {
  id: string;
  status: RunpodStatus;
  output?: {
    job_id?: string;
    stems?: Record<string, string>;
    analysis?: TrackAnalysis;
  } | null;
  error?: string;
};

/**
 * Poll RunPod for the live status of a previously-queued job. `kind` MUST
 * match the endpoint the job was originally queued on — RunPod scopes job
 * ids per endpoint, so a wrong endpoint just returns 404. Both producers
 * (separation + music-gen) attach the kind to the Inngest event so the
 * watcher knows which to pass here.
 */
export async function getRunpodJobStatus(
  runpodId: string,
  kind: RunpodEndpointKind,
): Promise<RunpodStatusResponse> {
  const endpoint = endpointIdFor(kind);
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!apiKey) {
    throw new Error("RUNPOD_API_KEY is not configured.");
  }

  const res = await fetch(`${RUNPOD_BASE}/${endpoint}/status/${runpodId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`RunPod /status failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as RunpodStatusResponse;
}

export { endpointKindForJobType };
