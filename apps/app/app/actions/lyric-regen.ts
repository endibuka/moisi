"use server";

import { generateText } from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT = `You are a songwriter helping refresh a working draft of lyrics.

The user has a draft they want a different take on. Produce a NEW set of lyrics covering the same theme and overall shape (section count, approximate line count per section, vibe) but with:

- Different imagery
- Fresh phrasings
- New rhyme choices
- A different angle on the same idea

Constraints (CRITICAL):
- Preserve section markers in square brackets: [Verse 1], [Chorus], [Bridge], [Pre-Chorus], [Outro]
- Blank line between sections
- Plain text only — no markdown, no asterisks, no quotes around lines
- Match the language of the draft (don't translate)
- Stay roughly the same length

Return ONLY the new lyrics text. No preamble, no closing remarks, no fences, no quotation marks, no Style: line.

Previous draft:
---
{LYRICS}
---`;

const MAX_LYRICS_LEN = 4000;

/**
 * Rewrites a working lyric draft via Gemini, returning fresh text in the
 * same shape. Called from the LyricsCard's Regenerate button so the
 * existing card updates in place — no new chat message, no second card.
 *
 * Auth-gated to signed-in users only. Input is capped to keep prompt
 * tokens bounded.
 */
export async function regenerateLyrics(
  existingLyrics: string,
): Promise<{ lyrics: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are not signed in." };

  const trimmed = existingLyrics.trim();
  if (!trimmed) return { error: "Nothing to regenerate yet." };
  if (trimmed.length > MAX_LYRICS_LEN) {
    return { error: `Lyrics too long to regenerate (max ${MAX_LYRICS_LEN}).` };
  }

  try {
    const next = await generateText(SYSTEM_PROMPT.replace("{LYRICS}", trimmed));
    return { lyrics: next.replace(/^```[a-z]*\n?|```$/gi, "").trim() };
  } catch (err) {
    console.error("[lyric-regen] failed:", err);
    return {
      error:
        err instanceof Error
          ? err.message
          : "Could not regenerate. Please try again.",
    };
  }
}
