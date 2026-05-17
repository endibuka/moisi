const RUNPOD_BASE = "https://api.runpod.ai/v2";

export type SeparationInput = {
  audio_url: string;
  output_prefix: string;
  job_id: string;
};

/**
 * Queues a separation job on the RunPod serverless endpoint and returns the
 * RunPod job id. RunPod reports completion by POSTing to `webhookUrl`.
 */
export async function startRunpodSeparation(
  input: SeparationInput,
  webhookUrl: string,
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
    body: JSON.stringify({ input, webhook: webhookUrl }),
  });

  if (!res.ok) {
    throw new Error(`RunPod /run failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("RunPod /run returned no job id.");
  return data.id;
}
