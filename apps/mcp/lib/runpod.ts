import { getRunpodEnv } from "./env";

const RUNPOD_BASE = "https://api.runpod.ai/v2";

export type SeparationInput = {
  audio_url: string;
  output_prefix: string;
  job_id: string;
};

export async function startRunpodSeparation(
  input: SeparationInput,
): Promise<string> {
  const { endpoint, apiKey } = getRunpodEnv();
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
