"use client";

import Image from "next/image";
import { useState } from "react";
import { generateCoverArt } from "@/app/actions/cover-art";
import AudioSourcePicker, { type LibraryItem } from "./AudioSourcePicker";

export default function CoverArtFlow({ library }: { library: LibraryItem[] }) {
  const [picked, setPicked] = useState<LibraryItem | null>(null);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; path: string } | null>(null);

  const onGenerate = async () => {
    if (!picked) return;
    setError(null);
    setGenerating(true);
    setResult(null);
    try {
      const r = await generateCoverArt(picked.id, prompt.trim() || null);
      if ("error" in r) {
        setError(r.error);
      } else {
        setResult({ url: r.signedUrl, path: r.path });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  if (!picked) {
    return (
      <>
        <AudioSourcePicker
          mode="library"
          library={library}
          onPickLibrary={(item) => setPicked(item)}
        />
        <p className="mt-6 text-[12px] leading-relaxed text-[rgba(252,252,253,0.5)]">
          Cover art is generated for an existing track in your library —
          pick one to start. Gemini composes a square 1:1 image based on
          the song title and an optional style direction.
        </p>
      </>
    );
  }

  return (
    <div className="rounded-[20px] border border-[rgba(252,252,253,0.1)] bg-[rgba(252,252,253,0.03)] p-6">
      {/* Selected track */}
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[rgba(0,218,232,0.12)] text-[#00dae8]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <path d="M9 18V6l11-2v12" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="17" cy="16" r="3" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[1.5px] text-[rgba(252,252,253,0.4)]">
            Cover art for
          </p>
          <p className="truncate text-[14px] text-[#fcfcfd]">
            {picked.original_name}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setPicked(null);
            setResult(null);
            setError(null);
            setPrompt("");
          }}
          className="flex h-9 items-center rounded-full border border-[rgba(252,252,253,0.1)] px-3 text-[12px] text-[rgba(252,252,253,0.6)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]"
        >
          Change
        </button>
      </div>

      {/* Prompt */}
      <label className="block text-[12px] font-medium text-[rgba(252,252,253,0.6)]">
        Style direction <span className="opacity-60">(optional)</span>
      </label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder='e.g. "Foggy mountain skyline at dusk, cyan + magenta gradient, painterly"'
        className="mt-1.5 h-24 w-full resize-none rounded-[10px] border border-[rgba(252,252,253,0.1)] bg-[rgba(252,252,253,0.03)] p-3 text-[13px] text-[#fcfcfd] outline-none placeholder:text-[rgba(252,252,253,0.3)] focus:border-[rgba(252,252,253,0.25)]"
      />

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="flex h-10 items-center gap-2 rounded-full bg-[#00dae8] px-5 text-[13px] font-medium text-[#001316] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {generating && (
            <span className="size-3.5 animate-spin rounded-full border-2 border-[rgba(0,19,22,0.3)] border-t-[#001316]" />
          )}
          {generating ? "Generating…" : result ? "Regenerate" : "Generate"}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-[10px] border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.06)] px-3 py-2 text-[13px] text-[#ff8888]">
          {error}
        </p>
      )}

      {/* Result */}
      {result && (
        <div className="mt-6">
          <div className="overflow-hidden rounded-[16px] border border-[rgba(252,252,253,0.1)] bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.url}
              alt={`Cover art for ${picked.original_name}`}
              className="aspect-square w-full object-cover"
            />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <a
              href={result.url}
              download={`${picked.original_name.replace(/\.[^.]+$/, "")} - cover.png`}
              className="flex h-9 items-center gap-2 rounded-full border border-[rgba(252,252,253,0.1)] px-3 text-[12px] text-[rgba(252,252,253,0.6)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
              Download
            </a>
          </div>
        </div>
      )}

      <p className="mt-6 text-[11px] leading-relaxed text-[rgba(252,252,253,0.5)]">
        Generated by Gemini 2.5 Flash Image. Each generation creates a new
        image at <code className="font-mono">stems/{"{user}"}/{"{job}"}/cover-art-*.png</code>
        and updates the track's <code className="font-mono">cover_art_path</code>.
      </p>
    </div>
  );
}
