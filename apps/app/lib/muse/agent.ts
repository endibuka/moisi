/**
 * Muse is a tiny multi-agent setup:
 *
 *   muse (orchestrator)
 *   ├── add_track tool               — handle attached-audio intents directly
 *   └── lyric_writer (sub-agent)     — specialist that drafts song lyrics
 *
 * The orchestrator's job is *routing*: it answers general music questions
 * itself, calls `add_track` when an MP3 is attached, and transfers control
 * to `lyric_writer` whenever the user wants to actually write lyrics.
 *
 * Sessions are kept in-process, keyed by conversationId. Good enough for
 * dev / single-instance deployments; swap in DatabaseSessionService for
 * multi-instance/serverless.
 */
import { createEvent, FunctionTool, InMemoryRunner, LlmAgent } from "@google/adk";
import { z } from "zod";
import { startSeparation } from "@/app/actions";
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

OPTIONAL SUPPORTING TEXT
You may add a short paragraph BEFORE the lyrics fence (≤2 sentences) summarizing the choice you made (key, mood, structure). You may add a short paragraph AFTER the lyrics fence with one or two suggestions for delivery, chord ideas, or alternate lines. Keep both brief.

REVISION REQUESTS
If the user asks to regenerate, rework, or change a section, produce a new \`lyrics\` block reflecting the change. Always wrap in the fence.

LANGUAGE
Always write the lyrics in the language the user asked for (or English if they didn't specify). Maintain natural prosody and stress patterns of that language — don't translate word-for-word from English idioms.

STYLE
Specific imagery over abstractions. Fresh phrasings over clichés. Lines that singers can actually sing.`;

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
    subAgents: [createLyricWriterAgent()],
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
