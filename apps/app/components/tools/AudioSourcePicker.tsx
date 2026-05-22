"use client";

import { useMemo, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ACCEPTED_AUDIO_EXT, MAX_UPLOAD_BYTES } from "@/lib/separation";

export type LibraryItem = {
  id: string;
  original_name: string;
  input_path: string;
  cover_art_path?: string | null;
};

type Tab = "upload" | "library";

/**
 * Shared input picker for every tool that takes an audio source. Two tabs:
 *
 *  - Upload    drag/drop or file-picker. Calls `onUpload(file)`.
 *  - Library   searchable list of the user's previous completed jobs.
 *              Calls `onPickLibrary(item)`.
 *
 * `mode="library"` hides the Upload tab — used by tools whose input is
 * implicitly "a previous song" (e.g. Cover Art).
 */
export default function AudioSourcePicker({
  mode = "audio",
  library,
  onUpload,
  onPickLibrary,
  uploading = false,
  uploadError,
}: {
  mode?: "audio" | "library";
  library: LibraryItem[];
  onUpload?: (file: File) => void;
  onPickLibrary: (item: LibraryItem) => void;
  uploading?: boolean;
  uploadError?: string | null;
}) {
  const [tab, setTab] = useState<Tab>(mode === "library" ? "library" : "upload");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return library;
    return library.filter((j) => j.original_name.toLowerCase().includes(q));
  }, [search, library]);

  return (
    <div>
      {mode === "audio" && (
        <div className="mb-4 flex gap-1 rounded-full border border-[rgba(252,252,253,0.06)] bg-[rgba(252,252,253,0.02)] p-1">
          <TabButton
            active={tab === "upload"}
            onClick={() => setTab("upload")}
            label="Upload"
          />
          <TabButton
            active={tab === "library"}
            onClick={() => setTab("library")}
            label={`From Library${library.length ? ` (${library.length})` : ""}`}
          />
        </div>
      )}

      {tab === "upload" && mode === "audio" ? (
        <UploadTab
          onUpload={onUpload!}
          uploading={uploading}
          uploadError={uploadError}
        />
      ) : (
        <LibraryTab
          items={filtered}
          search={search}
          onSearch={setSearch}
          onPick={onPickLibrary}
          empty={
            library.length === 0
              ? "Your separated tracks will show up here once you've run one."
              : "No tracks match that search."
          }
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-8 flex-1 items-center justify-center rounded-full px-3 text-[12px] font-medium transition-colors ${
        active
          ? "bg-[rgba(252,252,253,0.08)] text-[#fcfcfd]"
          : "text-[rgba(252,252,253,0.6)] hover:text-[#fcfcfd]"
      }`}
    >
      {label}
    </button>
  );
}

/* ---------- Upload tab ---------- */

function UploadTab({
  onUpload,
  uploading,
  uploadError,
}: {
  onUpload: (file: File) => void;
  uploading: boolean;
  uploadError?: string | null;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const validate = (file: File): string | null => {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED_AUDIO_EXT.includes(ext))
      return `Unsupported file type. Use ${ACCEPTED_AUDIO_EXT.join(", ")}.`;
    if (file.size > MAX_UPLOAD_BYTES) return "File is too large (max 30 MB).";
    return null;
  };

  const handle = (file: File) => {
    const err = validate(file);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onUpload(file);
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current += 1;
    if (e.dataTransfer.types.includes("Files")) setDragging(true);
  };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) setDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handle(file);
  };

  return (
    <div onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED_AUDIO_EXT.join(",")}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) handle(f);
        }}
        className="hidden"
      />
      <div
        className={`rounded-[20px] border-2 border-dashed p-10 text-center transition-colors ${
          dragging
            ? "border-[#00dae8] bg-[rgba(0,218,232,0.06)]"
            : "border-[rgba(252,252,253,0.12)] bg-[rgba(252,252,253,0.02)]"
        }`}
      >
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[rgba(0,218,232,0.12)] text-[#00dae8]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
            <path d="M12 16V4m0 0 4 4m-4-4-4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
        </div>
        <p className="mt-4 text-[15px] font-medium text-[#fcfcfd]">Drop your song here</p>
        <p className="mt-1 text-[12px] text-[rgba(252,252,253,0.6)]">
          {ACCEPTED_AUDIO_EXT.join(", ")} · max 30 MB
        </p>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="mx-auto mt-5 flex h-10 items-center gap-2 rounded-full bg-[#00dae8] px-5 text-[13px] font-medium text-[#001316] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Choose file"}
        </button>
      </div>
      {(error || uploadError) && (
        <p className="mt-4 text-[13px] text-[#ff6b6b]">{error ?? uploadError}</p>
      )}
    </div>
  );
}

/* ---------- Library tab ---------- */

function LibraryTab({
  items,
  search,
  onSearch,
  onPick,
  empty,
}: {
  items: LibraryItem[];
  search: string;
  onSearch: (v: string) => void;
  onPick: (item: LibraryItem) => void;
  empty: string;
}) {
  return (
    <div className="rounded-[20px] border border-[rgba(252,252,253,0.1)] bg-[rgba(252,252,253,0.02)] p-4">
      <div className="mb-3 flex h-9 items-center gap-2 rounded-full border border-[rgba(252,252,253,0.1)] bg-[rgba(252,252,253,0.03)] px-3 text-[rgba(252,252,253,0.5)] focus-within:border-[rgba(252,252,253,0.2)]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search your library"
          className="w-full bg-transparent text-[13px] text-[#edeef0] outline-none placeholder:text-[rgba(252,252,253,0.5)]"
        />
      </div>

      {items.length === 0 ? (
        <p className="px-1 py-8 text-center text-[12px] text-[rgba(252,252,253,0.5)]">
          {empty}
        </p>
      ) : (
        // Radix's ScrollArea needs a *definite* height on its Root for the
        // Viewport's h-full to resolve and trigger internal scrolling — a
        // bare `max-h-…` leaves the height auto, so the Viewport just grows
        // to content and nothing scrolls. Cap at 360px once we'd overflow.
        <ScrollArea className={items.length > 6 ? "h-[360px]" : ""}>
          <ul className="flex flex-col gap-1 pr-1">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onPick(item)}
                  className="flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-[rgba(252,252,253,0.05)]"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[rgba(0,218,232,0.12)] text-[#00dae8]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                      <path d="M9 18V6l11-2v12" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="17" cy="16" r="3" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-[#fcfcfd]">
                      {item.original_name}
                    </span>
                    <span className="block text-[11px] text-[rgba(252,252,253,0.5)]">
                      Tap to use this track
                    </span>
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-[rgba(252,252,253,0.4)]">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
