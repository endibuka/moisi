/**
 * Minimal Gemini image-generation client. Hits the Generative Language REST
 * API directly — keeps us off any SDK and is easy to swap to Vertex AI later.
 *
 * Requires GEMINI_API_KEY (from https://aistudio.google.com/apikey).
 */

const MODEL = "gemini-2.5-flash-image";

type Part =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type GenerateContentResponse = {
  candidates?: Array<{ content?: { parts?: Part[] } }>;
  error?: { message?: string };
};

/**
 * Generate a single image from a text prompt. Returns the raw bytes + mime
 * type so the caller decides where to put them (Supabase Storage, etc.).
 */
export async function generateImage(
  prompt: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API ${res.status}: ${text}`);
  }
  const json = (await res.json()) as GenerateContentResponse;
  if (json.error) {
    throw new Error(`Gemini API error: ${json.error.message ?? "unknown"}`);
  }

  const parts = json.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if ("inlineData" in part) {
      const { mimeType, data } = part.inlineData;
      return { bytes: base64ToBytes(data), mimeType };
    }
  }
  throw new Error("Gemini returned no image data.");
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * Compose the prompt for a Spotify-style square cover. The song title gives
 * the model thematic context; the user prompt fine-tunes mood/style.
 */
export function buildCoverArtPrompt({
  songTitle,
  userPrompt,
}: {
  songTitle: string;
  userPrompt?: string;
}): string {
  const base =
    `Album cover art in the style of modern Spotify singles. ` +
    `Square 1:1 composition, professional, evocative, no text or letters anywhere in the image. ` +
    `The song is titled "${songTitle.replace(/"/g, '\\"')}".`;
  const extras = userPrompt?.trim()
    ? ` Mood / style direction from the artist: ${userPrompt.trim()}.`
    : "";
  return base + extras;
}
