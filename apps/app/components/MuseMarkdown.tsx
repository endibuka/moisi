"use client";

import {
  ArrowRight,
  ArrowsClockwise,
  Check,
  Copy,
  MagicWand,
  MusicNotes,
  Question,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  text: string;
  /** While the assistant is still streaming this message — disables destructive actions. */
  streaming?: boolean;
  /** Send a follow-up message on behalf of the user (used by LyricsCard buttons). */
  onSend?: (message: string, opts?: { silent?: boolean }) => void;
};

export default function MuseMarkdown({ text, streaming, onSend }: Props) {
  const components: Components = {
    // Lyric blocks render as a custom card; other fenced code stays as a styled <pre><code>.
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className ?? "");
      const lang = match?.[1];
      const isBlock = Boolean(className?.startsWith("language-"));
      const content = String(children ?? "").replace(/\n$/, "");

      if (isBlock && lang === "lyrics") {
        return (
          <LyricsCard text={content} streaming={streaming} onSend={onSend} />
        );
      }
      if (isBlock && lang === "questions") {
        return (
          <QuestionsCard text={content} streaming={streaming} onSend={onSend} />
        );
      }
      if (isBlock) {
        return (
          <pre className="overflow-x-auto rounded-[10px] border border-[rgba(252,253,255,0.08)] bg-[rgba(252,253,255,0.03)] p-3">
            <code className="text-[12.5px] leading-relaxed text-[#edeef0]" {...props}>
              {children}
            </code>
          </pre>
        );
      }
      return (
        <code
          className="rounded-[4px] bg-[rgba(252,253,255,0.06)] px-1 py-0.5 text-[12.5px] text-[#edeef0]"
          {...props}
        >
          {children}
        </code>
      );
    },
    p({ children }) {
      return <p className="leading-[1.65]">{children}</p>;
    },
    ul({ children }) {
      return <ul className="my-1 list-disc space-y-1 pl-5">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="my-1 list-decimal space-y-1 pl-5">{children}</ol>;
    },
    li({ children }) {
      return <li className="leading-[1.6] marker:text-[rgba(241,247,254,0.4)]">{children}</li>;
    },
    h1({ children }) {
      return <h1 className="mt-3 mb-1 text-[18px] font-medium text-[#fcfcfd]">{children}</h1>;
    },
    h2({ children }) {
      return <h2 className="mt-3 mb-1 text-[16px] font-medium text-[#fcfcfd]">{children}</h2>;
    },
    h3({ children }) {
      return <h3 className="mt-2 mb-1 text-[14px] font-medium text-[#fcfcfd]">{children}</h3>;
    },
    a({ children, href }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[#00dae8] underline-offset-2 hover:underline"
        >
          {children}
        </a>
      );
    },
    blockquote({ children }) {
      return (
        <blockquote className="border-l-2 border-[rgba(0,218,232,0.4)] pl-3 text-[rgba(241,247,254,0.85)]">
          {children}
        </blockquote>
      );
    },
    strong({ children }) {
      return <strong className="font-medium text-[#fcfcfd]">{children}</strong>;
    },
    em({ children }) {
      return <em className="italic text-[rgba(241,247,254,0.92)]">{children}</em>;
    },
    hr() {
      return <hr className="my-3 border-[rgba(252,253,255,0.08)]" />;
    },
  };

  return (
    <div className="markdown-body space-y-2.5">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

function LyricsCard({
  text,
  streaming,
  onSend,
}: {
  text: string;
  streaming?: boolean;
  onSend?: (message: string, opts?: { silent?: boolean }) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — clipboard not available
    }
  };

  const regenerate = () => {
    if (!onSend || streaming) return;
    onSend(
      "Regenerate those lyrics — keep the same brief and structure, but try a different angle, fresh imagery, and different rhyme choices.",
      { silent: true },
    );
  };

  const turnIntoMusic = () => {
    if (!onSend || streaming) return;
    onSend(
      "Turn these lyrics into a full song idea: suggest a key, tempo (BPM), a chord progression for each section, an arrangement (instrumentation per section), and a one-line melody/cadence note per section. Format as a tidy outline.",
      { silent: true },
    );
  };

  return (
    <div className="my-3 overflow-hidden rounded-[20px] border border-[rgba(252,253,255,0.1)] bg-[#0e0f11]">
      <div className="flex items-center justify-between border-b border-[rgba(252,253,255,0.1)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <MusicNotes weight="fill" className="h-3.5 w-3.5 text-[#00dae8]" />
          <span className="text-[12px] font-medium uppercase tracking-[1.2px] text-[rgba(252,252,253,0.6)]">
            Lyrics
          </span>
          {streaming && (
            <span className="ml-1 inline-flex items-center gap-1.5 text-[11px] text-[rgba(252,252,253,0.5)]">
              <span className="size-1.5 animate-pulse rounded-full bg-[#00dae8]" />
              writing
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <CardButton title="Copy lyrics" onClick={copy} disabled={!text.trim()}>
            {copied ? <Check weight="bold" className="h-3 w-3" /> : <Copy weight="fill" className="h-3 w-3" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </CardButton>
          <CardButton
            title="Regenerate"
            onClick={regenerate}
            disabled={streaming || !onSend}
          >
            <ArrowsClockwise weight="bold" className="h-3 w-3" />
            <span>Regenerate</span>
          </CardButton>
          <CardButton
            title="Turn into music"
            onClick={turnIntoMusic}
            disabled={streaming || !onSend}
            primary
          >
            <MagicWand weight="fill" className="h-3 w-3" />
            <span>Turn into music</span>
          </CardButton>
        </div>
      </div>
      <pre className="min-w-0 overflow-x-auto whitespace-pre-wrap break-words px-5 py-4 font-sans text-[14px] leading-[1.7] text-[#fcfcfd]">
        {text || (streaming ? " " : "")}
      </pre>
    </div>
  );
}

type Question = {
  id: string;
  label: string;
  options?: string[];
  multi?: boolean;
  allowOther?: boolean;
  type?: "text";
  placeholder?: string;
};

type QuestionsBlock = {
  intro?: string;
  questions: Question[];
};

function QuestionsCard({
  text,
  streaming,
  onSend,
}: {
  text: string;
  streaming?: boolean;
  onSend?: (message: string, opts?: { silent?: boolean }) => void;
}) {
  const parsed = useMemo<QuestionsBlock | null>(() => {
    try {
      const obj = JSON.parse(text);
      if (!obj || !Array.isArray(obj.questions)) return null;
      return obj as QuestionsBlock;
    } catch {
      return null;
    }
  }, [text]);

  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [otherText, setOtherText] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  if (!parsed) {
    return (
      <div className="my-3 flex items-center gap-2 rounded-[20px] border border-[rgba(252,253,255,0.1)] bg-[#0e0f11] px-4 py-3 text-[12px] text-[rgba(252,252,253,0.6)]">
        <span className="size-1.5 animate-pulse rounded-full bg-[#00dae8]" />
        Preparing questions
      </div>
    );
  }

  const toggle = (q: Question, value: string) => {
    if (submitted) return;
    setSelections((prev) => {
      const cur = prev[q.id] ?? [];
      if (q.multi) {
        return {
          ...prev,
          [q.id]: cur.includes(value)
            ? cur.filter((v) => v !== value)
            : [...cur, value],
        };
      }
      return { ...prev, [q.id]: cur.includes(value) ? [] : [value] };
    });
  };

  const setOther = (qid: string, val: string) => {
    if (submitted) return;
    setOtherText((prev) => ({ ...prev, [qid]: val }));
  };

  const composeAnswer = (q: Question): string => {
    if (q.type === "text") return (otherText[q.id] ?? "").trim();
    const picks = selections[q.id] ?? [];
    const other = (otherText[q.id] ?? "").trim();
    const all = other ? [...picks, other] : picks;
    return all.join(", ");
  };

  const anyAnswered = parsed.questions.some((q) => composeAnswer(q).length > 0);

  const handleSubmit = () => {
    if (submitted || !onSend) return;
    const lines = parsed.questions
      .map((q) => {
        const answer = composeAnswer(q);
        return answer ? `- ${q.label}: ${answer}` : null;
      })
      .filter(Boolean);
    if (lines.length === 0) return;
    setSubmitted(true);
    onSend(`Here are my answers:\n${lines.join("\n")}`, { silent: true });
  };

  return (
    <div className="my-3 overflow-hidden rounded-[20px] border border-[rgba(252,253,255,0.1)] bg-[#0e0f11]">
      <div className="flex items-center justify-between border-b border-[rgba(252,253,255,0.1)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Question weight="fill" className="h-3.5 w-3.5 text-[rgba(252,252,253,0.6)]" />
          <span className="text-[12px] font-medium uppercase tracking-[1.2px] text-[rgba(252,252,253,0.6)]">
            Quick questions
          </span>
          {submitted && (
            <span className="ml-1 text-[11px] text-[#0affa7]">Answered</span>
          )}
        </div>
        {streaming && !submitted && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[rgba(252,252,253,0.5)]">
            <span className="size-1.5 animate-pulse rounded-full bg-[#00dae8]" />
            loading
          </span>
        )}
      </div>

      <div className="min-w-0 space-y-5 px-5 py-5">
        {parsed.intro && (
          <p className="text-[13.5px] leading-relaxed break-words text-[rgba(252,252,253,0.85)]">
            {parsed.intro}
          </p>
        )}

        {parsed.questions.map((q) => {
          const picked = selections[q.id] ?? [];
          return (
            <div key={q.id} className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[1.2px] text-[rgba(252,252,253,0.5)]">
                {q.label}
              </p>

              {q.type === "text" ? (
                <input
                  type="text"
                  value={otherText[q.id] ?? ""}
                  onChange={(e) => setOther(q.id, e.target.value)}
                  placeholder={q.placeholder ?? "Type your answer"}
                  disabled={submitted}
                  className="w-full rounded-full border border-[rgba(252,253,255,0.1)] bg-transparent px-4 py-2 text-[13px] text-[#fcfcfd] placeholder:text-[rgba(252,252,253,0.3)] focus:border-[rgba(252,253,255,0.25)] focus:outline-none disabled:opacity-60"
                />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(q.options ?? []).map((opt) => {
                    const selected = picked.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggle(q, opt)}
                        disabled={submitted}
                        className={`rounded-full border px-3 py-1.5 text-[12.5px] transition-colors disabled:cursor-default ${
                          selected
                            ? "border-[#00dae8] bg-[#00dae8] text-[#001316]"
                            : "border-[rgba(252,253,255,0.1)] bg-transparent text-[rgba(252,252,253,0.78)] hover:border-[rgba(252,253,255,0.25)] hover:bg-white/5 hover:text-white"
                        } ${submitted && !selected ? "opacity-40" : ""}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                  {q.allowOther && (
                    <input
                      type="text"
                      value={otherText[q.id] ?? ""}
                      onChange={(e) => setOther(q.id, e.target.value)}
                      placeholder="Other"
                      disabled={submitted}
                      className="min-w-[120px] flex-1 rounded-full border border-[rgba(252,253,255,0.1)] bg-transparent px-3 py-1.5 text-[12.5px] text-[#fcfcfd] placeholder:text-[rgba(252,252,253,0.3)] focus:border-[rgba(252,253,255,0.25)] focus:outline-none disabled:opacity-60"
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}

        {!submitted && (
          <div className="flex items-center justify-between pt-1">
            <p className="text-[11px] text-[rgba(252,252,253,0.3)]">
              Pick what fits, skip the rest.
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!anyAnswered || !onSend}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#00dae8] px-4 py-1.5 text-[12.5px] font-medium text-[#001316] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[rgba(252,253,255,0.08)] disabled:text-[rgba(252,252,253,0.4)]"
            >
              Send answers
              <ArrowRight weight="bold" className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CardButton({
  children,
  onClick,
  disabled,
  title,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
  primary?: boolean;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  const variant = primary
    ? "bg-[#00dae8] text-[#001316] hover:opacity-90"
    : "text-[rgba(252,252,253,0.6)] hover:bg-white/5 hover:text-white";
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variant}`}
    >
      {children}
    </button>
  );
}

