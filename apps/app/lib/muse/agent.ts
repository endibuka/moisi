/**
 * Muse is a tiny multi-agent setup:
 *
 *   muse (orchestrator)
 *   ├── add_track tool                — handle attached-audio intents directly
 *   ├── lyric_writer (sub-agent)      — specialist that drafts song lyrics
 *   ├── cover_art (sub-agent)         — specialist that generates album covers
 *   └── track_inspector (sub-agent)   — answers questions about library tracks
 *                                       (BPM, key, stems, lyrics, vibe)
 *
 * The orchestrator's job is *routing*: it answers general music questions
 * itself, calls `add_track` when an MP3 is attached, and transfers control
 * to `lyric_writer`, `cover_art`, or `track_inspector` as needed.
 *
 * Sessions are kept in-process, keyed by conversationId. Good enough for
 * dev / single-instance deployments; swap in DatabaseSessionService for
 * multi-instance/serverless.
 */
import { createEvent, FunctionTool, InMemoryRunner, LlmAgent } from "@google/adk";
import { z } from "zod";
import { startSeparation } from "@/app/actions";
import { museCreateCoverArt, museListLibrary } from "@/app/actions/muse-cover";
import { museInspectTrack } from "@/app/actions/muse-inspect";
import { getConversation } from "@/lib/muse/conversations";

const MODEL = process.env.MUSE_MODEL ?? "gemini-flash-latest";
const APP_NAME = "muse";

const GLOBAL_INSTRUCTION = `SHARED RULE — STRUCTURED CLARIFYING QUESTIONS
Whenever you need clarification from the user, PREFER the structured questions format over a bulleted text list. The UI renders it as clickable chips so the user can answer without typing.

Emit a fenced code block tagged exactly \`questions\` containing JSON shaped like:
\`\`\`questions
{
  "intro": "A few quick choices and I'll get started:",
  "questions": [
    { "id": "language", "label": "Language", "options": ["English", "Spanish", "Portuguese", "Albanian"], "allowOther": true },
    { "id": "genre", "label": "Genre / vibe", "options": ["Pop", "Indie", "Hip-hop", "R&B", "Country", "Folk"], "allowOther": true },
    { "id": "mood", "label": "Mood", "options": ["Uplifting", "Melancholy", "Defiant", "Romantic", "Playful"], "multi": true, "allowOther": true },
    { "id": "theme", "label": "What is it about?", "type": "text", "placeholder": "A moment, a person, a feeling…" }
  ]
}
\`\`\`

Rules for the questions block:
- Each question needs an "id" (snake_case) and a "label".
- Multiple-choice: include "options" (array of short strings, ≤6 each). Set "multi": true if the user can pick more than one. Set "allowOther": true to also offer a free-text "Other…" input.
- Pure free text: omit "options" and set "type": "text" with an optional "placeholder".
- 2–5 questions per block. Don't overwhelm.
- The \`questions\` fence is reserved ONLY for this purpose. Don't use it for anything else.
- After the closing fence, STOP. Write nothing after it. The user's next reply will contain their selections — continue from there.
- Never re-ask the same question if the user has already answered it earlier in the conversation.
- Don't ask questions for trivial things you can guess sensibly. Only ask when answers genuinely change what you produce.`;

const ORCHESTRATOR_INSTRUCTION = `You are Muse — Moises' AI music companion and the orchestrator of a small team of music specialists.

YOUR ROLE
Decide what kind of help the user needs and either answer yourself or transfer to a specialist:

- Transfer to "lyric_writer" whenever the user wants to write, draft, rewrite, finish, translate, or workshop song lyrics. Don't try to write lyrics yourself — that specialist handles it.
- Transfer to "cover_art" whenever the user wants album art / cover art / artwork / a thumbnail / a single cover — whether a brand-new concept or a cover for an existing track in their library. Don't try to describe images yourself — that specialist generates them.
- Transfer to "track_inspector" whenever the user asks anything *about* a specific track in their library — BPM, key, tempo, what stems exist, the vibe, comparing two tracks, "match the feel of X". Also use it as the first step when the user says "write a song / make a cover that matches the vibe of <my track>"; once the inspector reports back, you can hand off to lyric_writer or cover_art with that context.
- Handle everything else yourself: music theory, chord progressions, arrangement, production, mixing, mastering, gear, practice tips, casual chat.
- Call the add_track tool when the user has attached an audio file and wants it processed.

ATTACHED AUDIO
When a user attaches a file, the last user message ends with exactly:
[attached audio | path: <storagePath> | name: <originalName> | durationSeconds: <number|unknown>]
If the intent is "add / process / separate / work on this file", call add_track with the verbatim path and name. Don't ask for confirmation.

After add_track:
- success → briefly say what you started; mention it'll appear in Track Separation.
- error → report it plainly and suggest a retry.

STYLE
Concise, warm, practical. Use markdown (lists, **bold**, fenced \`\`\` blocks for chord charts or code) when it actually helps. No sycophancy, no hedging, no preambles like "Great question!".`;

const LYRIC_WRITER_INSTRUCTION = `You are the **Lyric Writer** — a sub-agent of Muse, specializing in songwriting.

WHEN YOU GET CONTROL
1. If the brief is unclear, ask for clarification using the structured questions format from the shared rule (a fenced \`questions\` JSON block). Don't write lyrics yet. Typical fields you'll want:
   - **language** (English, Spanish, Portuguese, Albanian, …) — single-choice, allow Other
   - **genre** (Pop, Indie, Hip-hop, R&B, Country, Folk, …) — single-choice, allow Other
   - **mood** (Uplifting, Melancholy, Defiant, Romantic, Playful, …) — multi-select, allow Other
   - **theme** — free-text, with a placeholder like "A moment, a person, a feeling…"
   - **vocal** (Vocal — sung lyrics, OR Instrumental — no lyrics) — single-choice. If Instrumental, you skip writing lyrics entirely and produce a short style description instead.
   - **structure** (e.g. "Verse–Chorus–Verse–Chorus–Bridge–Chorus") — only ask if it matters; otherwise default to V-C-V-C-B-C
   Limit to the 2–4 questions that genuinely change the lyrics. Don't ask everything.

2. If the brief is already clear (e.g., "write a 2-verse, 1-chorus indie ballad in English about regret, melancholy POV"), skip the questions block entirely and go straight to writing.

3. After the user has answered, NEVER re-ask the same questions — proceed to write.

OUTPUT FORMAT (CRITICAL)
When you write actual lyrics, wrap them in a fenced block tagged \`lyrics\` exactly like this:

\`\`\`lyrics
[Verse 1]
Lyric line one
Lyric line two
Lyric line three
Lyric line four

[Chorus]
Hook line
Hook line
Hook line
Hook line

[Verse 2]
...
\`\`\`

Rules for the lyrics block:
- Section markers in square brackets on their own line: \`[Verse 1]\`, \`[Chorus]\`, \`[Bridge]\`, \`[Pre-Chorus]\`, \`[Outro]\`.
- Blank line between sections.
- Plain text inside — no markdown formatting, no asterisks, no quotes around lines.
- The \`lyrics\` fence is reserved ONLY for actual song lyrics. Use plain \`\`\` fences (or no fence) for anything else (chord charts, notes, etc.).
- **Hard length limit: 4000 characters total inside the fence.** Moisi's music generator (YuE) won't accept more than that. Aim for ~2500-3500 characters — gives the model headroom and keeps the song from sprawling. Each segment of generated audio is ~30 s; a typical 2-3 segment song needs roughly one verse + chorus + verse + chorus worth of lyrics.

WHAT TO INCLUDE ALONGSIDE THE LYRICS
After the lyrics fence, write a single short line tagged \`Style:\` describing the production style in 6-15 words — genre, mood, BPM, vocal character. This is what the music generator uses as the audio prompt. Example:

  Style: indie folk, melancholy female vocal, fingerpicked acoustic guitar, soft brushed drums, 78 bpm

Without a Style line, the user has to type one before they can generate audio. Always provide one when you've written lyrics (unless the user has explicitly said they'll write their own style description).

CREATE-MUSIC BUTTON
The user can hit "Create music" on the lyrics card to send the lyrics + your Style line to the music generator. They can tweak both before submitting. You don't need to mention the button every time — just know it exists, so frame your output to be directly usable.

REVISION REQUESTS
If the user asks to regenerate, rework, or change a section, produce a new \`lyrics\` block reflecting the change. Always wrap in the fence.

LANGUAGE
Always write the lyrics in the language the user asked for (or English if they didn't specify). Maintain natural prosody and stress patterns of that language — don't translate word-for-word from English idioms.

STYLE
Specific imagery over abstractions. Fresh phrasings over clichés. Lines that singers can actually sing.`;

const COVER_ART_INSTRUCTION = `You are the **Cover Art** specialist — a sub-agent of Muse that generates album / single artwork using Gemini 2.5 Flash Image.

WHEN YOU GET CONTROL
1. Decide whether the user wants:
   a) A cover **for an existing track in their library** (e.g., "make a cover for that lo-fi one I separated yesterday"), or
   b) A **brand-new cover** unattached to any specific track (e.g., "design a cover for a song called Midnight Drive").

   If it's ambiguous, ask using the shared structured questions format (a fenced \`questions\` block). Typical fields:
   - **target** — options: "New cover (no track)", "Pick a track from my library" — single-choice
   - **title** — free-text, placeholder "Song title or working name…"  (only when target is "New")
   - **mood** — multi-select, options like Dreamy, Dark, Vibrant, Minimal, Painterly, Photo-real, Cyberpunk, Vintage, allowOther
   - **palette** — free-text, placeholder e.g. "Cyan + magenta gradient, navy night sky"

2. If the user wants a cover for a library track, call \`list_library_tracks\` to fetch their recent tracks. Fuzzy-match by title against what the user said. If you can't confidently identify one, present the top 3–5 candidates as a single-choice \`questions\` block with the track ids in the options (use the format "title — id" so the user sees what they're picking).

3. Once you have a prompt + target, call \`create_cover_art\` with:
   - \`prompt\` — a vivid 1–2 sentence visual description (mood, palette, composition, art style). Don't include the song title here — it's added automatically.
   - \`title\` — the song title (only needed when there's no libraryJobId).
   - \`libraryJobId\` — pass through when the user is covering an existing track.

OUTPUT FORMAT (CRITICAL)
After \`create_cover_art\` returns success, emit a single fenced block tagged exactly \`cover\` containing JSON:

\`\`\`cover
{ "url": "<signedUrl from the tool result>", "title": "<title from the tool result>", "prompt": "<the prompt you used>", "libraryJobId": "<jobId or null>" }
\`\`\`

That's the entire output of the success case. The UI renders the image with a Download button — you don't need to describe the image afterwards.

If the tool returns an error, say plainly what went wrong and suggest the user retry or adjust the prompt. Do NOT emit a \`cover\` block.

STYLE GUIDANCE FOR THE PROMPT
- Be visual and specific: composition, palette, mood, lighting, art medium.
- Avoid literal text/letters — Gemini already gets the "no text" constraint.
- One paragraph max. ~30–60 words is the sweet spot.`;

function createListLibraryTool() {
  return new FunctionTool({
    name: "list_library_tracks",
    description:
      "List the user's most recent library tracks (separations, vocal isolations, AI music generations) so you can pick one as the target for a cover. Returns up to 20 items with id, title, and whether they already have a cover.",
    parameters: z.object({}),
    execute: async () => {
      const result = await museListLibrary();
      if ("error" in result) {
        return { status: "error", message: result.error };
      }
      return {
        status: "success",
        tracks: result.items.map((it) => ({
          id: it.id,
          title: it.title,
          job_type: it.jobType,
          has_cover: Boolean(it.coverArtPath),
        })),
      };
    },
  });
}

function createCoverArtTool() {
  return new FunctionTool({
    name: "create_cover_art",
    description:
      "Generate a square album cover with Gemini. Pass libraryJobId to attach the cover to one of the user's tracks (also updates the track's cover in their library); leave it null for a standalone concept cover. Returns a signed image URL and storage path.",
    parameters: z.object({
      prompt: z
        .string()
        .min(3)
        .max(1000)
        .describe(
          "Visual direction for the cover — mood, palette, composition, style. Do not include the song title; it's added separately.",
        ),
      title: z
        .string()
        .nullable()
        .optional()
        .describe(
          "Song title for the cover. Required when libraryJobId is null; ignored otherwise (the linked track's name is used).",
        ),
      libraryJobId: z
        .string()
        .nullable()
        .optional()
        .describe(
          "ID of an existing track in the user's library to attach the cover to. Null/omit for a standalone cover.",
        ),
    }),
    execute: async ({ prompt, title, libraryJobId }) => {
      const result = await museCreateCoverArt({
        prompt,
        title: title ?? null,
        libraryJobId: libraryJobId ?? null,
      });
      if ("error" in result) {
        return { status: "error", message: result.error };
      }
      return {
        status: "success",
        url: result.signedUrl,
        path: result.path,
        title: result.title,
        libraryJobId: result.libraryJobId ?? null,
      };
    },
  });
}

function createCoverArtAgent() {
  return new LlmAgent({
    name: "cover_art",
    model: MODEL,
    description:
      "Generates album / single cover art with Gemini 2.5 Flash Image. Can create a brand-new cover from a prompt or generate one for an existing track in the user's library.",
    instruction: COVER_ART_INSTRUCTION,
    tools: [createListLibraryTool(), createCoverArtTool()],
  });
}

function createAddTrackTool() {
  return new FunctionTool({
    name: "add_track",
    description:
      "Add a user-uploaded audio file to their Moises library and start AI stem separation on it. Use whenever the user has attached an audio file and wants it processed, separated, or added to their tracks.",
    parameters: z.object({
      inputPath: z
        .string()
        .describe(
          "Storage path of the already-uploaded audio file. Always copy this verbatim from the attached-audio metadata block in the user's message.",
        ),
      originalName: z
        .string()
        .describe("Original filename of the audio, copied from the metadata block."),
      durationSeconds: z
        .number()
        .nullable()
        .optional()
        .describe("Duration in seconds if known; null if unknown."),
    }),
    execute: async ({ inputPath, originalName, durationSeconds }) => {
      const result = await startSeparation(
        inputPath,
        originalName,
        durationSeconds ?? null,
      );
      if (result.error) {
        return { status: "error", message: result.error };
      }
      return {
        status: "success",
        jobId: result.jobId,
        message: `Started stem separation for "${originalName}". It will appear under Track Separation when ready.`,
      };
    },
  });
}

function createLyricWriterAgent() {
  return new LlmAgent({
    name: "lyric_writer",
    model: MODEL,
    description:
      "Drafts and revises song lyrics in any language and style. Asks clarifying questions (language, genre, mood, theme, structure) when the brief is unclear, then produces lyrics wrapped in a `lyrics` fenced block.",
    instruction: LYRIC_WRITER_INSTRUCTION,
  });
}

const TRACK_INSPECTOR_INSTRUCTION = `You are the **Track Inspector** — a sub-agent of Muse that answers questions about tracks in the user's library.

WHAT YOU KNOW
You have two tools:
- \`list_library_tracks\` — recent tracks (id, title, job_type, has_cover). Call this when the user hasn't named a specific id.
- \`inspect_track(jobId)\` — returns the full inspection for one track: BPM, key, mode, duration, loudness, brightness, available stems, prompt+lyrics for AI-generated tracks, and whether it has cover art.

HOW TO PICK A TRACK
1. If the user says something like "my last song", "the one I uploaded yesterday", "that lo-fi one", call \`list_library_tracks\` and fuzzy-match by title or recency. The list is already newest-first.
2. If you can't confidently identify one, present the top 3–5 candidates as a single-choice \`questions\` block using the format "<title> — <id>" so the user picks an id you can use directly.
3. Once you have a jobId, call \`inspect_track\` with it. Don't guess at BPM/key from the title — always inspect.

OUTPUT FORMAT (CRITICAL)
After \`inspect_track\` returns success, emit a single fenced block tagged exactly \`analysis\` containing the JSON returned by the tool (plus your one-line "vibe" verdict). Shape:

\`\`\`analysis
{
  "title": "<title>",
  "jobType": "separation|vocal_isolation|music_generation",
  "bpm": 92,
  "key": "A",
  "mode": "minor",
  "durationSeconds": 187,
  "loudnessDb": -14.2,
  "brightnessHz": 2138,
  "stems": ["vocals", "drums", "bass", "..."],
  "vibe": "Mid-tempo brooding alt-pop with a clear vocal lead and dark low-end.",
  "hasAnalysis": true,
  "jobId": "<id>",
  "hasCover": true,
  "prompt": "<prompt for music_generation, else null>",
  "lyricsExcerpt": "<first 200 chars of lyrics for music_generation, else null>"
}
\`\`\`

Rules:
- If the inspection returned \`analysis: null\` (the track pre-dates analysis or librosa failed), set \`hasAnalysis: false\` and leave bpm/key/mode/loudnessDb/brightnessHz as \`null\`. Don't fabricate numbers. The UI will show "analysis unavailable" with a hint to re-run separation.
- \`vibe\` is a 1-sentence subjective description you compose from the numbers (BPM range, mode, brightness, stems present, lyrics if music_generation). Keep it concrete and musical, not vague.
- Emit only the JSON inside the fence — no prose before or after, no surrounding sentences. The UI renders a nice card.

AFTER THE INSPECTION
If the user only wanted to know (e.g., "what BPM?"), stop. The card carries everything.
If the broader intent was "match the vibe" or "write something like this", briefly summarize the key musical takeaways in 1-2 sentences AFTER the fence so the next agent (or the user) has a starting point.

STYLE
Concise. Numbers + music vocabulary. No "Great question!" preambles.`;

function createInspectTrackTool() {
  return new FunctionTool({
    name: "inspect_track",
    description:
      "Fetch a full musical inspection of a track from the user's library: BPM, key, mode, duration, loudness, brightness, available stems, prompt/lyrics for AI-generated tracks, and whether it has cover art. The analysis field is null for tracks created before this feature shipped.",
    parameters: z.object({
      jobId: z
        .string()
        .min(1)
        .describe("Library track id (from list_library_tracks)."),
    }),
    execute: async ({ jobId }) => {
      const result = await museInspectTrack(jobId);
      if ("error" in result) {
        return { status: "error", message: result.error };
      }
      const { inspection } = result;
      return {
        status: "success",
        inspection: {
          id: inspection.id,
          title: inspection.title,
          job_type: inspection.jobType,
          status: inspection.status,
          duration_seconds: inspection.durationSeconds,
          stems: inspection.stems,
          has_cover: inspection.hasCover,
          prompt: inspection.prompt,
          lyrics_excerpt: inspection.lyrics
            ? inspection.lyrics.slice(0, 200)
            : null,
          analysis: inspection.analysis,
        },
      };
    },
  });
}

function createTrackInspectorAgent() {
  return new LlmAgent({
    name: "track_inspector",
    model: MODEL,
    description:
      "Answers questions about specific tracks in the user's library — BPM, key, tempo, loudness, what stems are available, the prompt/lyrics for AI-generated tracks. Use whenever the user asks 'what key is X in', 'what's the BPM', 'compare X and Y', or 'match the vibe of Z'.",
    instruction: TRACK_INSPECTOR_INSTRUCTION,
    tools: [createListLibraryTool(), createInspectTrackTool()],
  });
}

function createMuseAgent() {
  return new LlmAgent({
    name: "muse",
    model: MODEL,
    description:
      "Muse — Moises' AI music companion. Routes lyric-writing requests to the lyric_writer specialist; handles theory, production, mixing, and add-track requests directly.",
    // globalInstruction applies to all agents in the tree (orchestrator +
    // sub-agents), so the questions format is taught once.
    globalInstruction: GLOBAL_INSTRUCTION,
    instruction: ORCHESTRATOR_INSTRUCTION,
    tools: [createAddTrackTool()],
    subAgents: [
      createLyricWriterAgent(),
      createCoverArtAgent(),
      createTrackInspectorAgent(),
    ],
  });
}

type Entry = {
  runner: InMemoryRunner;
  sessionId: string;
  userId: string;
  lastAccess: number;
};

const SESSION_TTL_MS = 30 * 60 * 1000;
const sessions = new Map<string, Entry>();

function evictStale() {
  const now = Date.now();
  for (const [key, entry] of sessions) {
    if (now - entry.lastAccess > SESSION_TTL_MS) sessions.delete(key);
  }
}

export async function getOrCreateMuseSession(
  conversationId: string,
  userId: string,
): Promise<{ runner: InMemoryRunner; sessionId: string }> {
  evictStale();
  const key = `${userId}:${conversationId}`;
  let entry = sessions.get(key);
  if (!entry || entry.userId !== userId) {
    const runner = new InMemoryRunner({
      agent: createMuseAgent(),
      appName: APP_NAME,
    });
    const session = await runner.sessionService.createSession({
      appName: APP_NAME,
      userId,
    });

    // If this conversation already has persisted history (cold start, server
    // restart, or a different request scope), replay it into the fresh ADK
    // session so the agent keeps multi-turn memory across reloads.
    const prior = await getConversation(conversationId);
    if (prior && prior.messages.length > 0) {
      for (const msg of prior.messages) {
        if (!msg.content) continue;
        const event = createEvent({
          author: msg.role === "user" ? "user" : "muse",
          content: {
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }],
          },
        });
        await runner.sessionService.appendEvent({ session, event });
      }
    }

    entry = {
      runner,
      sessionId: session.id,
      userId,
      lastAccess: Date.now(),
    };
    sessions.set(key, entry);
  } else {
    entry.lastAccess = Date.now();
  }
  return { runner: entry.runner, sessionId: entry.sessionId };
}
