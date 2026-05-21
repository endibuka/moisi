import { NextRequest } from "next/server";
import { getOrCreateMuseSession } from "@/lib/muse/agent";
import { saveTurn, type ToolEvent } from "@/lib/muse/conversations";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type Attachment = {
  inputPath: string;
  originalName: string;
  durationSeconds: number | null;
};

type Body = {
  message: string;
  conversationId: string;
  attachment?: Attachment;
};

function humanizeModelError(code: string | undefined, message: string): string {
  if (code === "429" || /quota/i.test(message)) {
    return "Muse hit the Gemini rate limit. If you just added billing, upgrade your API key to the Paid Tier at https://aistudio.google.com/apikey (click your key → Plan → Paid Tier 1). Otherwise wait ~30 seconds and try again.";
  }
  if (/safety|blocked/i.test(message)) {
    return "Gemini refused that request on safety grounds. Try rephrasing.";
  }
  return message;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const { message, conversationId, attachment } = body;
  if (!message?.trim() || !conversationId?.trim()) {
    return new Response("message and conversationId are required", {
      status: 400,
    });
  }
  if (attachment && !attachment.inputPath.startsWith(`${user.id}/`)) {
    return new Response("Attachment path is not yours.", { status: 403 });
  }

  let prompt = message.trim();
  if (attachment) {
    prompt += `\n\n[attached audio | path: ${attachment.inputPath} | name: ${attachment.originalName} | durationSeconds: ${attachment.durationSeconds ?? "unknown"}]`;
  }

  const { runner, sessionId } = await getOrCreateMuseSession(
    conversationId,
    user.id,
  );

  const newMessage = {
    role: "user" as const,
    parts: [{ text: prompt }],
  };

  const encoder = new TextEncoder();
  const write = (controller: ReadableStreamDefaultController, payload: unknown) =>
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

  const stream = new ReadableStream({
    async start(controller) {
      // Accumulate the muse reply text + tool events so we can persist a
      // complete turn after the stream ends.
      let museText = "";
      const toolEvents: ToolEvent[] = [];
      let errored = false;

      try {
        const events = runner.runAsync({
          userId: user.id,
          sessionId,
          newMessage,
          abortSignal: req.signal,
        });
        for await (const event of events) {
          // ADK can yield error events (e.g. Gemini 429 / safety / quota)
          // with `errorMessage` set and `content` missing — surface those.
          if (event.errorMessage) {
            console.error(
              `[muse] model error ${event.errorCode ?? ""}: ${event.errorMessage}`,
            );
            write(controller, {
              type: "error",
              message: humanizeModelError(event.errorCode, event.errorMessage),
            });
            errored = true;
            continue;
          }
          for (const part of event.content?.parts ?? []) {
            if (typeof part.text === "string" && part.text.length > 0) {
              museText += part.text;
              write(controller, { type: "text", text: part.text });
            } else if (part.functionCall) {
              if (part.functionCall.name !== "transfer_to_agent") {
                toolEvents.push({
                  name: part.functionCall.name ?? "tool",
                  status: "calling",
                });
              }
              write(controller, {
                type: "tool_call",
                name: part.functionCall.name,
                args: part.functionCall.args,
              });
            } else if (part.functionResponse) {
              const name = part.functionResponse.name;
              if (name !== "transfer_to_agent") {
                const response = part.functionResponse.response as
                  | { status?: string; message?: string }
                  | undefined;
                // Mark the most recent matching "calling" event as resolved.
                for (let i = toolEvents.length - 1; i >= 0; i--) {
                  if (toolEvents[i].name === name && toolEvents[i].status === "calling") {
                    toolEvents[i] = {
                      name: name ?? "tool",
                      status: response?.status === "error" ? "error" : "done",
                      message: response?.message,
                    };
                    break;
                  }
                }
              }
              write(controller, {
                type: "tool_result",
                name,
                response: part.functionResponse.response,
              });
            }
          }
        }
        write(controller, { type: "done" });
      } catch (err) {
        console.error("[muse] stream error:", err);
        errored = true;
        write(controller, {
          type: "error",
          message: err instanceof Error ? err.message : "Muse failed to respond.",
        });
      } finally {
        controller.close();
      }

      // Persist the turn (best-effort, doesn't block the stream which is
      // already closed). Only save when we actually produced something so a
      // pure error leaves the conversation untouched.
      if (!errored && museText.trim().length > 0) {
        try {
          await saveTurn({
            conversationId,
            userMessage: {
              content: prompt,
              attachmentPath: attachment?.inputPath ?? null,
              attachmentName: attachment?.originalName ?? null,
            },
            museMessage: {
              content: museText,
              toolEvents: toolEvents.length > 0 ? toolEvents : null,
            },
          });
        } catch (err) {
          console.error("[muse] saveTurn threw:", err);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
