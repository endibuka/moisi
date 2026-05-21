"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import MuseMarkdown from "@/components/MuseMarkdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import { museKeys } from "@/lib/muse/hooks";
import { ACCEPTED_AUDIO_EXT, MAX_UPLOAD_BYTES } from "@/lib/separation";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  role: "user" | "muse";
  text: string;
  attachment?: { originalName: string } | null;
  toolEvents?: { name: string; status: "calling" | "done" | "error"; message?: string }[];
  pending?: boolean;
};

type Attachment = {
  inputPath: string;
  originalName: string;
  durationSeconds: number | null;
};

function IconSparkle({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.5 13.7 8 19 9.7 13.7 11.4 12 17l-1.7-5.6L5 9.7 10.3 8 12 2.5Z" />
      <path d="M19 14.5 19.9 17 22.5 18l-2.6 1L19 21.5 18.1 19 15.5 18l2.6-1L19 14.5Z" opacity="0.7" />
    </svg>
  );
}

function IconArrowUp({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function IconPlus({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconWave({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2M21 12h0" />
    </svg>
  );
}

function IconMic({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
    </svg>
  );
}

function IconStems({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function IconNote({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function IconPen({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}

function IconSliders({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" />
    </svg>
  );
}

function IconBook({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14ZM4 19.5A2.5 2.5 0 0 0 6.5 22H20" />
    </svg>
  );
}

function IconMore({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

function IconClose({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

const SUGGESTIONS: { label: string; prompt: string; Icon: (p: { className?: string }) => React.JSX.Element }[] = [
  { label: "Write lyrics", prompt: "Help me write lyrics for a song about late-night drives.", Icon: IconPen },
  { label: "Chord ideas", prompt: "Suggest chord progressions for a dreamy indie-pop track in A major.", Icon: IconNote },
  { label: "Mixing tips", prompt: "Give me mixing tips for vocals sitting on top of a busy drum bus.", Icon: IconSliders },
  { label: "Music theory", prompt: "Explain modal interchange in C major with a couple of examples.", Icon: IconBook },
  { label: "More", prompt: "", Icon: IconMore },
];

function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = "metadata";
    a.src = url;
    const done = (v: number | null) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    a.onloadedmetadata = () =>
      done(Number.isFinite(a.duration) ? a.duration : null);
    a.onerror = () => done(null);
  });
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type ServerMessage = {
  id: string;
  role: "user" | "muse";
  content: string;
  attachment_path: string | null;
  attachment_name: string | null;
  tool_events:
    | { name: string; status: "calling" | "done" | "error"; message?: string }[]
    | null;
};

export default function MuseChat({
  userId,
  conversationId: serverConversationId,
  initialMessages = [],
}: {
  userId: string;
  conversationId?: string;
  initialMessages?: ServerMessage[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlConversationId = searchParams.get("c");

  // Stable conversation id sourced from `?c=`; if absent, we generate one and
  // push it into the URL so refresh / back-forward preserves the chat.
  const conversationId = useMemo(() => {
    if (urlConversationId) return urlConversationId;
    if (serverConversationId) return serverConversationId;
    return typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : uid();
  }, [urlConversationId, serverConversationId]);

  useEffect(() => {
    if (!urlConversationId) {
      router.replace(`/muse?c=${conversationId}`, { scroll: false });
    }
  }, [urlConversationId, conversationId, router]);

  // Remounting on conversation change is how we wipe chat state — cleaner
  // than imperatively resetting refs + state inside an effect.
  return (
    <MuseChatInner
      key={conversationId}
      userId={userId}
      conversationId={conversationId}
      initialMessages={initialMessages}
    />
  );
}

function MuseChatInner({
  userId,
  conversationId,
  initialMessages,
}: {
  userId: string;
  conversationId: string;
  initialMessages: ServerMessage[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>(() =>
    initialMessages.map((m) => ({
      id: m.id,
      role: m.role,
      // The user message stored server-side includes the attachment metadata
      // footer we append before sending to Gemini. Strip it before showing.
      text:
        m.role === "user"
          ? m.content.replace(/\n*\[attached audio \|[^\]]*\]/g, "").trim() ||
            m.content
          : m.content,
      attachment: m.attachment_name
        ? { originalName: m.attachment_name }
        : null,
      toolEvents: m.tool_events ?? [],
      pending: false,
    })),
  );
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ---- typewriter buffer for smooth streaming ----
  const targetTextRef = useRef("");
  const displayedLenRef = useRef(0);
  const streamDoneRef = useRef(false);
  const activeMuseIdRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);

  // ---- voice memo (MediaRecorder) + dictation (Web Speech API) ----
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  type SR = {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: ((e: SpeechRecognitionEvent) => void) | null;
    onend: (() => void) | null;
    onerror: ((e: { error: string }) => void) | null;
  };
  type SpeechRecognitionEvent = {
    resultIndex: number;
    results: {
      [index: number]: {
        [index: number]: { transcript: string };
        isFinal: boolean;
      };
      length: number;
    };
  };
  const recognitionRef = useRef<SR | null>(null);
  const dictationBaseRef = useRef<string>("");
  const [listening, setListening] = useState(false);

  const pumpTypewriter = useCallback(() => {
    if (rafRef.current != null) return;
    const tick = () => {
      const museId = activeMuseIdRef.current;
      if (!museId) {
        rafRef.current = null;
        return;
      }
      const target = targetTextRef.current;
      const caughtUp = displayedLenRef.current >= target.length;

      if (!caughtUp) {
        const remaining = target.length - displayedLenRef.current;
        // Catch up over ~12 frames (~200ms); faster when buffer is large.
        const charsPerFrame = Math.max(1, Math.ceil(remaining / 12));
        const nextLen = Math.min(target.length, displayedLenRef.current + charsPerFrame);
        const nextText = target.slice(0, nextLen);
        displayedLenRef.current = nextLen;
        setMessages((prev) =>
          prev.map((m) => (m.id === museId ? { ...m, text: nextText } : m)),
        );
      }

      const done =
        streamDoneRef.current &&
        displayedLenRef.current >= targetTextRef.current.length;
      if (done) {
        setMessages((prev) =>
          prev.map((m) => (m.id === museId ? { ...m, pending: false } : m)),
        );
        activeMuseIdRef.current = null;
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      recognitionRef.current?.stop();
      mediaRecorderRef.current?.stop();
    },
    [],
  );

  async function uploadAudio(file: File) {
    setError(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("File is too large (max 30 MB).");
      return;
    }
    if (!userId) {
      setError("You need to be signed in to attach audio.");
      return;
    }

    setUploading(true);
    try {
      const duration = await readDuration(file);
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${userId}/${crypto.randomUUID()}/${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(path, file, { contentType: file.type || undefined });
      if (uploadError) throw new Error(uploadError.message);

      setAttachment({
        inputPath: path,
        originalName: file.name,
        durationSeconds: duration,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handlePickedFile(file: File) {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED_AUDIO_EXT.includes(ext)) {
      setError(`Unsupported file type. Use ${ACCEPTED_AUDIO_EXT.join(", ")}.`);
      return;
    }
    await uploadAudio(file);
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void handlePickedFile(file);
  }

  async function toggleRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      return;
    }
    if (uploading || streaming) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const ext = mime.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `voice-memo-${Date.now()}.${ext}`, {
          type: mime,
        });
        mediaRecorderRef.current = null;
        setRecording(false);
        void uploadAudio(file);
      };
      mediaRecorderRef.current = rec;
      setRecording(true);
      rec.start();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not access the microphone.",
      );
    }
  }

  function toggleDictation() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => SR;
      webkitSpeechRecognition?: new () => SR;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setError("Voice input isn't supported in this browser — try Chrome.");
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    dictationBaseRef.current = input ? input.trimEnd() + " " : "";
    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (finalText) {
        dictationBaseRef.current =
          (dictationBaseRef.current + finalText).replace(/\s+/g, " ").trimEnd() +
          " ";
      }
      setInput((dictationBaseRef.current + interimText).trimEnd());
    };
    rec.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    rec.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        setError(`Voice input error: ${e.error}`);
      }
      rec.stop();
    };
    recognitionRef.current = rec;
    setListening(true);
    setError(null);
    rec.start();
  }

  async function send(rawText: string, opts?: { silent?: boolean }) {
    if (streaming || uploading) return;
    const text = rawText.trim();
    if (!text && !attachment) return;
    setError(null);

    const museId = uid();
    const museMsg: Message = {
      id: museId,
      role: "muse",
      text: "",
      pending: true,
      toolEvents: [],
    };

    // `silent: true` is used by in-message UI (QuestionsCard's "Send answers",
    // LyricsCard "Regenerate" / "Turn into music") — those already display the
    // user's action visually in the card, so a duplicate user bubble would be
    // noise. Skip the user message; keep the muse placeholder so the stream
    // has a target.
    if (opts?.silent) {
      setMessages((m) => [...m, museMsg]);
    } else {
      const userMsg: Message = {
        id: uid(),
        role: "user",
        text: text || "(attached an audio file)",
        attachment: attachment
          ? { originalName: attachment.originalName }
          : null,
      };
      setMessages((m) => [...m, userMsg, museMsg]);
    }
    setInput("");

    const payload = {
      message: text || "I attached an audio file.",
      conversationId,
      attachment,
    };
    setAttachment(null);
    setStreaming(true);

    // Reset typewriter for this turn.
    targetTextRef.current = "";
    displayedLenRef.current = 0;
    streamDoneRef.current = false;
    activeMuseIdRef.current = museId;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/muse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "Muse failed to respond.");
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const block of events) {
          const line = block.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          let data: {
            type: string;
            text?: string;
            name?: string;
            message?: string;
            response?: unknown;
          };
          try {
            data = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }

          // Hide framework-internal routing calls from the UI.
          if (
            (data.type === "tool_call" || data.type === "tool_result") &&
            data.name === "transfer_to_agent"
          ) {
            continue;
          }

          if (data.type === "text" && data.text) {
            targetTextRef.current += data.text;
            pumpTypewriter();
          } else if (data.type === "tool_call" && data.name) {
            setMessages((m) =>
              m.map((msg) =>
                msg.id === museId
                  ? {
                      ...msg,
                      toolEvents: [
                        ...(msg.toolEvents ?? []),
                        { name: data.name!, status: "calling" },
                      ],
                    }
                  : msg,
              ),
            );
          } else if (data.type === "tool_result" && data.name) {
            const response = data.response as
              | { status?: string; message?: string }
              | undefined;
            const status =
              response?.status === "error" ? "error" : "done";
            setMessages((m) =>
              m.map((msg) => {
                if (msg.id !== museId) return msg;
                const events = msg.toolEvents ?? [];
                const idx = [...events]
                  .reverse()
                  .findIndex(
                    (e) => e.name === data.name && e.status === "calling",
                  );
                if (idx === -1) {
                  return {
                    ...msg,
                    toolEvents: [
                      ...events,
                      {
                        name: data.name!,
                        status,
                        message: response?.message,
                      },
                    ],
                  };
                }
                const realIdx = events.length - 1 - idx;
                const next = events.slice();
                next[realIdx] = {
                  ...next[realIdx],
                  status,
                  message: response?.message,
                };
                return { ...msg, toolEvents: next };
              }),
            );
          } else if (data.type === "error") {
            throw new Error(data.message ?? "Muse failed to respond.");
          }
        }
      }

      streamDoneRef.current = true;
      pumpTypewriter();
      // Refresh the sidebar's chat list + this conversation's cached messages
      // via TanStack Query so a brand-new chat appears, the title updates, and
      // updated_at re-orders the list.
      void queryClient.invalidateQueries({
        queryKey: museKeys.conversations(),
      });
      void queryClient.invalidateQueries({
        queryKey: museKeys.conversation(conversationId),
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Muse failed to respond.";
      setError(errMsg);
      // Stop typewriter and surface the error inline.
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      activeMuseIdRef.current = null;
      targetTextRef.current = "";
      displayedLenRef.current = 0;
      streamDoneRef.current = false;
      setMessages((m) =>
        m.map((message) =>
          message.id === museId
            ? { ...message, pending: false, text: message.text || errMsg }
            : message,
        ),
      );
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  const empty = messages.length === 0;
  const canSend = (!!input.trim() || !!attachment) && !streaming && !uploading;

  const composer = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) void send(input);
      }}
      className="w-full"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_AUDIO_EXT.join(",")}
        onChange={onFileInput}
        className="hidden"
      />
      <div className="relative rounded-[24px] border border-[rgba(252,253,255,0.1)] bg-[rgba(14,15,17,0.8)] backdrop-blur-[12px] transition-colors focus-within:border-[rgba(252,253,255,0.2)]">
        {attachment && (
          <div className="flex items-center justify-between gap-2 border-b border-[rgba(252,253,255,0.1)] px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <IconStems className="h-3.5 w-3.5 shrink-0 text-[#00dae8]" />
              <div className="min-w-0">
                <p className="truncate text-[13px] text-[#fcfcfd]">
                  {attachment.originalName}
                </p>
                <p className="text-[11px] text-[rgba(252,252,253,0.5)]">
                  Audio file · ready to add
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              aria-label="Remove attachment"
              className="flex size-7 items-center justify-center rounded-full text-[rgba(252,252,253,0.6)] transition-colors hover:bg-white/5 hover:text-white"
            >
              <IconClose />
            </button>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) void send(input);
            }
          }}
          placeholder={
            attachment
              ? "What should I do with this track?"
              : "Ask Muse anything about your music…"
          }
          rows={1}
          className="block w-full resize-none bg-transparent px-5 pt-4 pb-2 text-[15px] leading-relaxed text-[#edeef0] placeholder:text-[rgba(229,237,253,0.4)] focus:outline-none"
        />
        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          <div className="flex items-center gap-1">
            <ToolbarButton
              title="Attach audio file"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || streaming || recording}
            >
              {uploading ? (
                <span className="size-3.5 animate-spin rounded-full border-2 border-[rgba(241,247,254,0.3)] border-t-[#edeef0]" />
              ) : (
                <IconPlus />
              )}
            </ToolbarButton>
            <ToolbarButton
              title={recording ? "Stop recording" : "Record voice memo"}
              onClick={() => void toggleRecording()}
              disabled={uploading || streaming}
              active={recording}
            >
              {recording ? (
                <span className="size-2.5 animate-pulse rounded-full bg-[#ff5d5d]" />
              ) : (
                <IconWave />
              )}
            </ToolbarButton>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || streaming}
              className="ml-1 flex items-center gap-1.5 rounded-full border border-[rgba(252,253,255,0.1)] px-2.5 py-1 text-[12px] text-[rgba(252,252,253,0.6)] transition-colors hover:border-[rgba(252,253,255,0.2)] hover:bg-white/5 hover:text-white disabled:opacity-50"
            >
              <IconStems className="h-3.5 w-3.5" />
              <span>Add track</span>
              <span className="text-[10px] font-medium text-[#00dae8]">New</span>
            </button>
          </div>
          <div className="flex items-center gap-1">
            <ToolbarButton
              title={listening ? "Stop dictation" : "Dictate"}
              onClick={() => toggleDictation()}
              active={listening}
            >
              {listening ? (
                <span className="size-2.5 animate-pulse rounded-full bg-[#ff5d5d]" />
              ) : (
                <IconMic />
              )}
            </ToolbarButton>
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send"
              className="ml-1 flex size-8 items-center justify-center rounded-full bg-white text-black transition-opacity hover:opacity-90 disabled:bg-[rgba(252,253,255,0.08)] disabled:text-[rgba(252,252,253,0.4)]"
            >
              {streaming ? (
                <span className="size-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
              ) : (
                <IconArrowUp className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-center text-[12px] text-[#ff6b6b]">{error}</p>
      )}
    </form>
  );

  return (
    <div className="relative flex h-full flex-col">
      {empty ? (
        <div className="relative flex h-full flex-col items-center justify-center px-6">
          <div className="flex items-center gap-2.5 rounded-full border border-[rgba(252,253,255,0.1)] px-3.5 py-1.5 text-[12px]">
            <span className="text-[rgba(252,252,253,0.6)]">Free plan</span>
            <span className="h-3 w-px bg-[rgba(252,253,255,0.1)]" />
            <button
              type="button"
              className="font-medium text-[#00dae8] hover:opacity-90"
            >
              Start free trial
            </button>
          </div>

          <h1 className="mt-7 text-center text-[44px] font-normal leading-[1.1] tracking-[-1.28px] text-[#fcfcfd] sm:text-[52px]">
            What can I help you create?
          </h1>

          <div className="mt-8 w-full max-w-[720px]">{composer}</div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => s.prompt && void send(s.prompt)}
                className="flex items-center gap-2 rounded-full border border-[rgba(252,253,255,0.1)] px-3.5 py-2 text-[13px] text-[rgba(252,252,253,0.78)] transition-colors hover:border-[rgba(252,253,255,0.25)] hover:bg-white/5 hover:text-white"
              >
                <s.Icon className="h-3.5 w-3.5 text-[rgba(252,252,253,0.5)]" />
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <ScrollArea className="relative flex-1" viewportRef={viewportRef}>
            <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-6 pt-10 pb-8">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[80%]">
                      {m.attachment && (
                        <div className="mb-2 ml-auto flex w-fit items-center gap-2 rounded-full border border-[rgba(252,253,255,0.1)] px-3 py-1.5">
                          <IconStems className="h-3.5 w-3.5 text-[rgba(252,252,253,0.6)]" />
                          <span className="text-[12px] text-[rgba(252,252,253,0.85)]">
                            {m.attachment.originalName}
                          </span>
                        </div>
                      )}
                      <div className="rounded-[20px] rounded-br-[8px] bg-[rgba(252,253,255,0.05)] px-4 py-2.5 text-[14px] leading-relaxed text-[#fcfcfd]">
                        {m.text}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex items-start gap-3">
                    <span className="mt-[3px] flex size-6 shrink-0 items-center justify-center rounded-full bg-[#00dae8] text-[#001316]">
                      <IconSparkle className="h-3 w-3" />
                    </span>
                    <div className="flex-1 space-y-2 pt-[2px] text-[14px] leading-[1.65] text-[rgba(252,252,253,0.92)]">
                      {(m.toolEvents ?? []).map((ev, i) => (
                        <div
                          key={`${ev.name}-${i}`}
                          className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[12px] ${
                            ev.status === "error"
                              ? "border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.06)] text-[#ff9b9b]"
                              : "border-[rgba(252,253,255,0.08)] bg-[rgba(252,253,255,0.03)] text-[rgba(241,247,254,0.78)]"
                          }`}
                        >
                          {ev.status === "calling" ? (
                            <span className="size-3 animate-spin rounded-full border-2 border-[rgba(0,218,232,0.25)] border-t-[#00dae8]" />
                          ) : ev.status === "error" ? (
                            <span className="size-1.5 rounded-full bg-[#ff6b6b]" />
                          ) : (
                            <span className="size-1.5 rounded-full bg-[#0affa7]" />
                          )}
                          <span>
                            {ev.name === "add_track"
                              ? ev.status === "calling"
                                ? "Adding track…"
                                : ev.status === "error"
                                ? "Couldn't add track"
                                : "Track added"
                              : ev.name}
                          </span>
                        </div>
                      ))}
                      {m.text ? (
                        <MuseMarkdown
                          text={m.text}
                          streaming={m.pending}
                          onSend={(msg, opts) => void send(msg, opts)}
                        />
                      ) : m.pending ? (
                        <div className="flex items-center gap-1.5">
                          <span className="size-1.5 animate-pulse rounded-full bg-[rgba(241,247,254,0.6)]" />
                          <span className="size-1.5 animate-pulse rounded-full bg-[rgba(241,247,254,0.6)] [animation-delay:150ms]" />
                          <span className="size-1.5 animate-pulse rounded-full bg-[rgba(241,247,254,0.6)] [animation-delay:300ms]" />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ),
              )}
            </div>
          </ScrollArea>
          <div className="relative shrink-0 px-6 pb-6 pt-2">
            <div className="mx-auto max-w-[760px]">{composer}</div>
          </div>
        </>
      )}
    </div>
  );
}

function ToolbarButton({
  children,
  title,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active ? true : undefined}
      onClick={onClick}
      disabled={disabled}
      className={`flex size-8 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
        active
          ? "bg-[rgba(255,93,93,0.12)] text-[#ff8a8a] hover:bg-[rgba(255,93,93,0.18)]"
          : "text-[rgba(252,252,253,0.6)] hover:bg-white/5 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
