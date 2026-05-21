import { getRunpodEnv, getYueEnv } from "./env";

const RUNPOD_BASE = "https://api.runpod.ai/v2";

export type SeparationInput = {
  audio_url: string;
  output_prefix: string;
  job_id: string;
};

export type YueInput = {
  genre: string;
  lyrics: string;
  n_segments: number;
  output_prefix: string;
  job_id: string;
};

async function postRun(
  endpoint: string,
  apiKey: string,
  input: unknown,
): Promise<string> {
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

export async function startRunpodSeparation(
  input: SeparationInput,
): Promise<string> {
  const { endpoint, apiKey } = getRunpodEnv();
  return postRun(endpoint, apiKey, input);
}

export async function startRunpodMusicGen(input: YueInput): Promise<string> {
  const { endpoint, apiKey } = getYueEnv();
  return postRun(endpoint, apiKey, input);
}
